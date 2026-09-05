import type { Project, User } from '../types';
import { db, isFirebaseConfigured } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

const STORAGE_KEY_PREFIX = 'coverageai_projects_';
const AUTH_USER_KEY = 'coverageai_demo_user';

const INITIAL_PROJECTS_SEED: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Billing Engine API',
    description: 'Core subscription management, metered invoicing endpoints, and PCI-compliant payment orchestration workflows.',
    targetEnvironmentUrl: 'https://api.staging.acme.corp/billing/v2',
    stats: {
      apiCount: 18,
      requirementCount: 42,
      testCaseCount: 126,
    },
  },
  {
    name: 'Identity & SSO Gateway',
    description: 'Zero-trust token issuance, multi-tenant RBAC verification, and enterprise SAML / OIDC federation specification suite.',
    targetEnvironmentUrl: 'https://auth.staging.acme.corp',
    stats: {
      apiCount: 12,
      requirementCount: 28,
      testCaseCount: 74,
    },
  },
  {
    name: 'Webhook Event Dispatcher',
    description: 'High-throughput event delivery pipeline, signature validation, and dead-letter queue recovery integration specs.',
    targetEnvironmentUrl: 'https://webhooks.staging.acme.corp/v1',
    stats: {
      apiCount: 6,
      requirementCount: 15,
      testCaseCount: 39,
    },
  },
];

// Helper to get local projects
function getLocalProjects(userId: string): Project[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) {
      // Seed default projects for this user if first time
      const seeded: Project[] = INITIAL_PROJECTS_SEED.map((item, idx) => {
        const now = new Date(Date.now() - idx * 3600000 * 18).toISOString();
        return {
          ...item,
          id: `proj_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
          userId,
          createdAt: now,
          updatedAt: now,
        };
      });
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalProjects(userId: string, projects: Project[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Fetch all projects for user
export async function fetchUserProjects(userId: string): Promise<Project[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, 'projects'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const remoteProjects: Project[] = [];
      snapshot.forEach((d) => {
        remoteProjects.push(d.data() as Project);
      });
      // Sort by updatedAt descending
      return remoteProjects.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (err) {
      console.warn('Failed to fetch from Firestore, falling back to local storage:', err);
    }
  }

  // Fallback to local storage
  const projects = getLocalProjects(userId);
  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// Create new project
export async function createProjectRecord(
  userId: string,
  input: {
    name: string;
    description?: string;
    targetEnvironmentUrl?: string;
    oneDriveFolder?: Project['oneDriveFolder'];
  }
): Promise<Project> {
  const now = new Date().toISOString();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const newProject: Project = {
    id,
    userId,
    name: input.name.trim(),
    description: (input.description || '').trim(),
    targetEnvironmentUrl: input.targetEnvironmentUrl?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    stats: {
      apiCount: 0,
      requirementCount: 0,
      testCaseCount: 0,
    },
    oneDriveFolder: input.oneDriveFolder,
  };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'projects', id), newProject);
      return newProject;
    } catch (err) {
      console.warn('Failed to write to Firestore, storing in local fallback:', err);
    }
  }

  const existing = getLocalProjects(userId);
  const updated = [newProject, ...existing];
  setLocalProjects(userId, updated);
  return newProject;
}

// Update existing project
export async function updateProjectRecord(
  userId: string,
  projectId: string,
  input: {
    name: string;
    description?: string;
    targetEnvironmentUrl?: string;
    oneDriveFolder?: Project['oneDriveFolder'];
  }
): Promise<Project> {
  const now = new Date().toISOString();

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'projects', projectId);
      const updates: Record<string, unknown> = {
        name: input.name.trim(),
        description: (input.description || '').trim(),
        targetEnvironmentUrl: input.targetEnvironmentUrl?.trim() || '',
        updatedAt: now,
      };
      if (input.oneDriveFolder !== undefined) {
        updates.oneDriveFolder = input.oneDriveFolder;
      }
      await updateDoc(docRef, updates);
    } catch (err) {
      console.warn('Failed to update in Firestore, falling back locally:', err);
    }
  }

  const existing = getLocalProjects(userId);
  const targetIndex = existing.findIndex((p) => p.id === projectId && p.userId === userId);
  if (targetIndex === -1) {
    throw new Error('Project not found or unauthorized');
  }

  const updatedProject: Project = {
    ...existing[targetIndex],
    name: input.name.trim(),
    description: (input.description || '').trim(),
    targetEnvironmentUrl: input.targetEnvironmentUrl?.trim() || undefined,
    oneDriveFolder: input.oneDriveFolder !== undefined ? input.oneDriveFolder : existing[targetIndex].oneDriveFolder,
    updatedAt: now,
  };

  existing[targetIndex] = updatedProject;
  setLocalProjects(userId, existing);
  return updatedProject;
}

// Attach OneDrive folder metadata to project
export async function updateProjectOneDriveFolder(
  userId: string,
  projectId: string,
  folder: Project['oneDriveFolder']
): Promise<Project> {
  const existing = getLocalProjects(userId);
  const target = existing.find((p) => p.id === projectId && p.userId === userId);
  return updateProjectRecord(userId, projectId, {
    name: target?.name || '',
    description: target?.description,
    targetEnvironmentUrl: target?.targetEnvironmentUrl,
    oneDriveFolder: folder,
  });
}

// Delete project
export async function deleteProjectRecord(userId: string, projectId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (err) {
      console.warn('Failed to delete from Firestore, falling back locally:', err);
    }
  }

  const existing = getLocalProjects(userId);
  const filtered = existing.filter((p) => !(p.id === projectId && p.userId === userId));
  setLocalProjects(userId, filtered);
}

// Demo auth helpers
export function getSavedDemoUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveDemoUser(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(AUTH_USER_KEY);
    } else {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
  } catch (err) {
    console.error('Failed to save demo user session:', err);
  }
}

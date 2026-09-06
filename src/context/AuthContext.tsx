import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '../types';
import {
  auth,
  isFirebaseConfigured,
  microsoftProvider,
} from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getSavedDemoUser, saveDemoUser } from '../lib/mockStorage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemoMode: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithMicrosoft: (preferredEmail?: string) => Promise<void>;
  signInAsDemo: (demoEmail?: string) => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const isDemoMode = !isFirebaseConfigured;

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const providerId = firebaseUser.providerData[0]?.providerId === 'microsoft.com'
            ? 'microsoft.com'
            : 'password';
          
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || 'user@coverageai.dev',
            displayName: firebaseUser.displayName || undefined,
            photoURL: firebaseUser.photoURL || undefined,
            provider: providerId,
          });
        } else {
          // Check if local demo user is saved
          const demoUser = getSavedDemoUser();
          setUser(demoUser);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Local demo mode: check localStorage
      const demoUser = getSavedDemoUser();
      setUser(demoUser);
      setLoading(false);
    }
  }, []);

  const signInWithEmail = async (email: string, pass: string): Promise<void> => {
    if (isFirebaseConfigured && auth) {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      setUser({
        id: res.user.uid,
        email: res.user.email || email,
        displayName: res.user.displayName || undefined,
        photoURL: res.user.photoURL || undefined,
        provider: 'password',
      });
    } else {
      // Demo authentication simulation
      const cleanEmail = email.trim().toLowerCase();
      const existingUser = getSavedDemoUser();
      const demoUser: User = {
        id: existingUser && existingUser.email === cleanEmail
          ? existingUser.id
          : `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: cleanEmail,
        displayName: cleanEmail.split('@')[0],
        provider: 'password',
      };
      saveDemoUser(demoUser);
      setUser(demoUser);
    }
  };

  const signUpWithEmail = async (email: string, pass: string): Promise<void> => {
    if (isFirebaseConfigured && auth) {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      setUser({
        id: res.user.uid,
        email: res.user.email || email,
        displayName: res.user.displayName || undefined,
        photoURL: res.user.photoURL || undefined,
        provider: 'password',
      });
    } else {
      const cleanEmail = email.trim().toLowerCase();
      const demoUser: User = {
        id: `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: cleanEmail,
        displayName: cleanEmail.split('@')[0],
        provider: 'password',
      };
      saveDemoUser(demoUser);
      setUser(demoUser);
    }
  };

  const signInWithMicrosoft = async (preferredEmail?: string): Promise<void> => {
    if (isFirebaseConfigured && auth && microsoftProvider) {
      try {
        if (preferredEmail) {
          microsoftProvider.setCustomParameters({
            prompt: 'select_account',
            login_hint: preferredEmail.trim(),
          });
        }
        const res = await signInWithPopup(auth, microsoftProvider);
        setUser({
          id: res.user.uid,
          email: res.user.email || preferredEmail || 'engineer@enterprise.onmicrosoft.com',
          displayName: res.user.displayName || undefined,
          photoURL: res.user.photoURL || undefined,
          provider: 'microsoft.com',
        });
      } catch (err: any) {
        if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
          throw new Error('Authentication popup was blocked. Please allow popups or use demo mode.');
        }
        throw err;
      }
    } else {
      // Local fallback for Microsoft OAuth simulation
      const cleanEmail = preferredEmail?.trim().toLowerCase();
      const emailToUse = cleanEmail || 'qa.lead@enterprise.onmicrosoft.com';
      const nameParts = emailToUse.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      const msUser: User = {
        id: `usr_ms_${emailToUse.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: emailToUse,
        displayName: `${nameParts} (Microsoft)`,
        provider: 'microsoft.com',
      };
      saveDemoUser(msUser);
      setUser(msUser);
    }
  };

  const signInAsDemo = (demoEmail = 'sarah.chen@fintech.io'): void => {
    const demoUser: User = {
      id: 'usr_sarah_chen',
      email: demoEmail,
      displayName: 'Sarah Chen (Principal QA)',
      provider: 'demo',
    };
    saveDemoUser(demoUser);
    setUser(demoUser);
  };

  const signOutUser = async (): Promise<void> => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    saveDemoUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode,
        signInWithEmail,
        signUpWithEmail,
        signInWithMicrosoft,
        signInAsDemo,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

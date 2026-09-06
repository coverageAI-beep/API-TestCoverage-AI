import { useState } from 'react';
import type { NavigationView } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { OneDriveProvider } from './context/OneDriveContext';
import { ToastProvider } from './components/ui/Toast';
import { AuthCard } from './components/auth/AuthCard';
import { AppShell } from './components/layout/AppShell';
import { ProjectList } from './components/projects/ProjectList';
import { DashboardView } from './components/views/DashboardView';
import { SettingsView } from './components/views/SettingsView';
import { FilesView } from './components/views/FilesView';
import { ApisView } from './components/views/ApisView';
import { RequirementsView } from './components/views/RequirementsView';
import { TestCasesView } from './components/views/TestCasesView';
import { PlaceholderView } from './components/views/PlaceholderView';
import { ShieldCheck, Loader2 } from 'lucide-react';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<NavigationView>('projects');
  const [selectedRequirementsApiId, setSelectedRequirementsApiId] = useState<string | null>(null);
  const [selectedTestCasesApiId, setSelectedTestCasesApiId] = useState<string | null>(null);

  const handleNavigate = (view: NavigationView, payload?: string) => {
    if (view === 'requirements') {
      setSelectedRequirementsApiId(payload || null);
    } else if (view === 'test-cases') {
      setSelectedTestCasesApiId(payload || null);
    }
    setCurrentView(view);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#FAFAFA] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
          <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-stone-500 font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />
          <span>Initializing CoverageAI workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthCard />;
  }

  return (
    <OneDriveProvider>
      <ProjectProvider>
        <AppShell currentView={currentView} onNavigate={handleNavigate}>
          {currentView === 'projects' && (
            <ProjectList onNavigateView={handleNavigate} />
          )}
          {currentView === 'dashboard' && (
            <DashboardView onNavigate={handleNavigate} />
          )}
          {currentView === 'files' && (
            <FilesView onNavigate={handleNavigate} />
          )}
          {currentView === 'apis' && (
            <ApisView onNavigate={handleNavigate} />
          )}
          {currentView === 'requirements' && (
            <RequirementsView
              onNavigate={handleNavigate}
              initialSelectedApiId={selectedRequirementsApiId}
            />
          )}
          {currentView === 'settings' && <SettingsView />}
          {currentView === 'test-cases' && (
            <TestCasesView
              onNavigate={handleNavigate}
              initialSelectedApiId={selectedTestCasesApiId}
            />
          )}
        </AppShell>
      </ProjectProvider>
    </OneDriveProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}

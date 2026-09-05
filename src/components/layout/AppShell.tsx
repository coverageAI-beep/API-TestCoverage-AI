import type { ReactNode } from 'react';
import type { NavigationView } from '../../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  currentView: NavigationView;
  onNavigate: (view: NavigationView) => void;
  children: ReactNode;
}

export function AppShell({ currentView, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] text-stone-900 overflow-hidden font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar Navigation */}
      <Sidebar currentView={currentView} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header currentView={currentView} onNavigate={onNavigate} />

        <main className="flex-1 overflow-y-auto p-10">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

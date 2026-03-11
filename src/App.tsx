import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { LoginView } from './components/LoginView';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import type { User } from './types';
import { gameService } from './services/gameService';
import { Toaster, toast } from 'sonner';
import { supabase } from './supabaseClient';

function App() {
  // Restore session on load
  const [user, setUser] = useState<User | null>(null);
  const [adminInUserMode, setAdminInUserMode] = useState(true);
  const [adminTab, setAdminTab] = useState<'MATCHDAY' | 'SURVIVAL' | 'USERS'>('MATCHDAY');

  const handleLogout = () => {
    gameService.logout();
    setUser(null);
    setAdminInUserMode(false);
  };

  useEffect(() => {
    const init = async () => {
      const u = await gameService.getCurrentUser();
      if (u) setUser(u);
    };
    init();
  }, []);

  const handleToggleView = () => {
    setAdminInUserMode(!adminInUserMode);
  };

  const handleAdminUsers = () => {
    setAdminInUserMode(false);
    setAdminTab('USERS');
  };

  const refreshUser = async () => {
    const u = await gameService.getCurrentUser();
    // Force a new object reference to trigger re-render if properties changed
    if (u) setUser({ ...u });
  };

  // Real-time Notifications & Profile Sync
  useEffect(() => {
    if (!user) return;

    // 1. Global Matchday Notifications
    const globalChannel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchdays'
        },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newResults = payload.new?.results;
          const oldResults = payload.old?.results;
          
          if (newResults && oldResults && Array.isArray(newResults) && Array.isArray(oldResults) && 
              JSON.stringify(newResults) !== JSON.stringify(oldResults)) {
            toast("⚽ Risultati Aggiornati!", {
              description: "Controlla la classifica per vedere i punteggi.",
            });
          }
        }
      )
      .subscribe();

    // 2. Personal Profile Sync (Tokens, Level, Wins)
    const profileChannel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        () => {
          console.log("Profile updated in real-time, refreshing...");
          refreshUser();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user]);

  const showAdminDashboard = user?.role === 'ADMIN' && !adminInUserMode;

  return (
    <Layout
      user={user}
      onLogout={handleLogout}
      onToggleView={handleToggleView}
      isUserMode={adminInUserMode}
      onAdminUsers={handleAdminUsers}
    >
      <Toaster position="top-center" theme="dark" />
      {!user ? (
        <LoginView onLogin={setUser} />
      ) : (
        showAdminDashboard
          ? <AdminDashboard onToggleView={handleToggleView} initialTab={adminTab} />
          : <UserDashboard user={user} onBalanceUpdate={refreshUser} onLogout={handleLogout} />
      )}
    </Layout>
  );
}

export default App;

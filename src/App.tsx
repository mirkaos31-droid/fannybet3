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

  // Real-time Notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'duels',
          filter: `opponent_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('New duel received!', payload);
          toast("⚔️ Nuova Sfida!", {
            description: "Qualcuno ti ha sfidato a duello.",
            action: {
              label: "Vedi",
              onClick: () => window.location.reload() // Or navigate if we had router
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchdays'
        },
        (payload: any) => {
          // Check if results changed
          // @ts-ignore
          if (payload.new && payload.new.results && JSON.stringify(payload.new.results) !== JSON.stringify(payload.old.results)) {
            toast("⚽ Risultati Aggiornati!", {
              description: "Controlla la classifica per vedere i punteggi.",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshUser = async () => {
    const u = await gameService.getCurrentUser();
    // Force a new object reference to trigger re-render if properties changed
    if (u) setUser({ ...u });
  };

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

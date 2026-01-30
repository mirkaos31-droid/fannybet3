import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { LoginView } from './components/LoginView';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import type { User } from './types';
import { gameService } from './services/gameService';

function App() {
  const [user, setUser] = useState<User | null>(null);
  // Default to true so Admins land on Home (User View)
  const [adminInUserMode, setAdminInUserMode] = useState(true);
  const [adminTab, setAdminTab] = useState<'MATCHDAY' | 'SURVIVAL' | 'USERS'>('MATCHDAY');

  const handleLogout = () => {
    gameService.logout();
    setUser(null);
    setAdminInUserMode(false);
  };

  // Restore session on load
  // Restore session on load
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

  const showAdminDashboard = user?.role === 'ADMIN' && !adminInUserMode;

  return (
    <Layout
      user={user}
      onLogout={handleLogout}
      onToggleView={handleToggleView}
      isUserMode={adminInUserMode}
      onAdminUsers={handleAdminUsers}
    >
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

import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';

interface RegisteredUser {
    id: string;
    username: string;
    email: string;
    tokens: number;
    role: string;
    created_at: string;
}

export const UserManagementPanel: React.FC = () => {
    const [users, setUsers] = useState<RegisteredUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [tokenChange, setTokenChange] = useState('0');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const allUsers = await gameService.getAllUsers();
            setUsers(allUsers);
        } catch (err) {
            console.error('Errore nel caricamento user:', err);
            alert('Errore nel caricamento degli utenti');
        } finally {
            setLoading(false);
        }
    };

    const handleAddTokens = async (userId: string, amount: number) => {
        if (!amount) return;
        try {
            await gameService.updateUserTokens(userId, amount);
            await loadUsers();
            setTokenChange('0');
            alert(`✅ ${amount > 0 ? '+' : ''}${amount} token aggiunti`);
        } catch {
            alert('Errore nell\'aggiornamento dei token');
        }
    };

    const handleDeleteUser = async (userId: string, username: string) => {
        if (!confirm(`Sei SICURO di voler eliminare l'account di ${username}? Questa azione non può essere annullata!`)) {
            return;
        }
        try {
            await gameService.deleteUserProfile(userId);
            await loadUsers();
            alert(`❌ Account ${username} eliminato`);
        } catch {
            alert('Errore nell\'eliminazione dell\'account');
        }
    };

    const handleToggleRole = async (userId: string, currentRole: string, username: string) => {
        const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
        if (!confirm(`Vuoi cambiare il ruolo di ${username} da ${currentRole} a ${newRole}?`)) return;

        try {
            await gameService.updateUserRole(userId, newRole);
            await loadUsers();
            alert(`✅ Ruolo aggiornato a ${newRole}`);
        } catch {
            alert('Errore aggiornamento ruolo');
        }
    };

    const handleSync = async () => {
        try {
            await gameService.syncEmails();
            await loadUsers();
            alert('✅ Email sincronizzate');
        } catch {
            alert('Errore sync');
        }
    };

    const filteredUsers = users.filter(u =>
        u.username?.toLowerCase().includes(filter.toLowerCase()) ||
        u.email?.toLowerCase().includes(filter.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-white">Caricamento utenti...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in text-white">
            {/* Header */}
            <div className="border-l-4 border-[#dfff00] pl-6 py-2">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-black italic text-white mb-1">GESTIONE UTENTI</h3>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">{users.length} Account Attivi</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSync}
                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest text-[#dfff00]"
                        >
                            Sync Emails
                        </button>
                        <button
                            onClick={loadUsers}
                            className="px-4 py-2 bg-[#dfff00] text-black border border-[#dfff00] rounded-xl hover:scale-105 transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                            🔄 Aggiorna
                        </button>
                    </div>
                </div>
            </div>

            {/* Search/Filter */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-2">
                <input
                    type="text"
                    placeholder="CERCA UTENTE O EMAIL..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full bg-transparent px-4 py-3 text-white placeholder-gray-600 font-bold uppercase text-sm outline-none"
                />
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-3xl border border-white/10 bg-black/40">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 font-bold uppercase tracking-widest">
                        Nessun utente trovato
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr className="text-gray-400 text-left">
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Utente</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Email</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Tokens</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Ruolo</th>
                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-center">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4 font-black italic text-lg">{user.username}</td>
                                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">{user.email || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1">
                                            <span className="font-black text-[#dfff00] text-lg">{user.tokens}</span>
                                            <span className="text-gray-600 text-[9px] font-black uppercase">FTK</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleRole(user.id, user.role, user.username)}
                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${user.role === 'ADMIN' ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white' : 'bg-[#dfff00]/10 text-[#dfff00] border-[#dfff00]/30 hover:bg-[#dfff00] hover:text-black'}`}
                                        >
                                            {user.role}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2 justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                                                className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-[#dfff00] hover:bg-[#dfff00] hover:text-black transition-all"
                                                title="Tokens"
                                            >
                                                💰
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.username)}
                                                className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                                title="Elimina"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Token Editor */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
                    <div className="bg-[#0a0a0a] border-2 border-[#dfff00] rounded-[30px] p-8 w-full max-w-md shadow-[0_0_50px_rgba(223,255,0,0.2)] space-y-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black italic text-white">
                                GESTIONE TOKEN
                            </h3>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white">✕</button>
                        </div>

                        <div className="text-center">
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Utente Selezionato</p>
                            <p className="text-3xl font-black text-white italic">{filteredUsers.find(u => u.id === selectedUser)?.username}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#dfff00]/70">Modifica Saldo</label>
                            <input
                                type="number"
                                value={tokenChange}
                                onChange={(e) => setTokenChange(e.target.value)}
                                placeholder="0"
                                autoFocus
                                className="w-full bg-black border-2 border-white/10 rounded-xl px-4 py-4 text-center text-white font-black text-2xl focus:border-[#dfff00] outline-none"
                            />
                            <p className="text-[9px] text-gray-500 text-center">Usa valori negativi per sottrarre (es. -50)</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <button
                                onClick={() => setTokenChange('0')}
                                className="py-4 rounded-xl font-black text-xs uppercase tracking-widest border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={() => handleAddTokens(selectedUser, parseInt(tokenChange))}
                                className="py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-[#dfff00] text-black hover:scale-105 transition-all shadow-[0_0_20px_rgba(223,255,0,0.3)]"
                            >
                                Conferma
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

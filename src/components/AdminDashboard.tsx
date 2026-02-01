import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import type { Matchday } from '../types';
import { SurvivalAdminPanel } from './SurvivalAdminPanel';
import { UserManagementPanel } from './UserManagementPanel';

interface AdminDashboardProps {
    onToggleView?: () => void;
    initialTab?: 'MATCHDAY' | 'SURVIVAL' | 'USERS';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onToggleView, initialTab = 'MATCHDAY' }) => {
    const [activeTab, setActiveTab] = useState<'MATCHDAY' | 'SURVIVAL' | 'USERS' | 'SYSTEM'>(initialTab);
    const [matchday, setMatchday] = useState<Matchday | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        gameService.getMatchday().then(setMatchday);
    }, []);

    // Helper to format date for datetime-local input (handling local timezone)
    const formatForInput = (isoString: string) => {
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return "";
            const tzOffset = date.getTimezoneOffset() * 60000;
            const localISODate = new Date(date.getTime() - tzOffset).toISOString();
            return localISODate.slice(0, 16);
        } catch {
            return isoString.slice(0, 16);
        }
    };

    // Handlers
    const handleUpdateMatch = (idx: number, field: 'home' | 'away', val: string) => {
        if (!matchday) return;
        const newMatches = [...matchday.matches];
        newMatches[idx] = { ...newMatches[idx], [field]: val.toUpperCase() };
        setMatchday({ ...matchday, matches: newMatches });
        gameService.updateMatch(idx, newMatches[idx]);
    };

    const handleUpdateJackpot = (val: string) => {
        if (!matchday) return;
        const num = parseInt(val) || 0;
        setMatchday({ ...matchday, superJackpot: num });
        gameService.updateSuperJackpot(num);
    };

    if (!matchday) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#dfff00] p-6 text-black z-[1000]">
                <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter mb-8">ADMIN CONSOLE</h1>
                <div className="bg-black text-[#dfff00] p-10 rounded-[40px] shadow-[20px_20px_0px_rgba(0,0,0,0.2)] text-center max-w-md w-full border-4 border-black">
                    <p className="font-bold uppercase tracking-widest text-sm mb-8 opacity-70">Nessuna giornata attiva detected.</p>
                    <button
                        onClick={async () => {
                            if (!window.confirm("Attivare nuova giornata?")) return;
                            setLoading(true);
                            const res = await gameService.createMatchday();
                            if (res.success) {
                                const md = await gameService.getMatchday();
                                setMatchday(md);
                            }
                            setLoading(false);
                        }}
                        disabled={loading}
                        className="w-full bg-[#dfff00] text-black py-5 rounded-2xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-[8px_8px_0px_black] border-2 border-black"
                    >
                        {loading ? 'WAIT...' : 'INITIALIZE SYSTEM'}
                    </button>
                    {onToggleView && (
                        <button onClick={onToggleView} className="mt-8 text-xs font-black uppercase tracking-widest border-b border-[#dfff00]/30 pb-1">
                            ← BACK TO HOME
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] -mx-4 -mt-4 md:-mx-8 md:-mt-8 p-4 md:p-10 animate-fade-in text-white relative">
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/10 pb-8">
                    <div className="flex flex-col md:flex-row items-center gap-8 w-full md:w-auto">
                        <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white">ADMIN CONSOLE</h2>
                        <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 w-full md:w-auto overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('MATCHDAY')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'MATCHDAY' ? 'bg-[#dfff00] text-black shadow-[0_0_20px_rgba(223,255,0,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                ⚽ 1X2 GESTIONE
                            </button>
                            <button
                                onClick={() => setActiveTab('SURVIVAL')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'SURVIVAL' ? 'bg-[#dfff00] text-black shadow-[0_0_20px_rgba(223,255,0,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                ☠️ SURVIVAL
                            </button>
                            <button
                                onClick={() => setActiveTab('USERS')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'USERS' ? 'bg-[#dfff00] text-black shadow-[0_0_20px_rgba(223,255,0,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                👥 UTENTI
                            </button>
                            <button
                                onClick={() => setActiveTab('SYSTEM')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'SYSTEM' ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                ⚙️ SYSTEM
                            </button>
                        </div>
                    </div>
                    {onToggleView && (
                        <button onClick={onToggleView} className="w-full md:w-auto bg-transparent text-[#dfff00] px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#dfff00]/10 hover:scale-105 active:scale-95 transition-all border border-[#dfff00] shadow-[0_0_15px_rgba(223,255,0,0.1)]">
                            RETURN HOME
                        </button>
                    )}
                </div>

                {activeTab === 'MATCHDAY' ? (
                    <div className="space-y-6 animate-fade-in">
                        {/* Global Config Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-transparent text-white p-5 md:p-8 rounded-[24px] border-2 border-[#dfff00] shadow-[0_0_20px_rgba(223,255,0,0.1)] space-y-4 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-[#dfff00]/5 -z-10 group-hover:bg-[#dfff00]/10 transition-colors duration-500"></div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-[#dfff00]/80">💰 Super Jackpot</label>
                                    <input
                                        type="number"
                                        value={matchday.superJackpot}
                                        onChange={(e) => handleUpdateJackpot(e.target.value)}
                                        className="bg-black/50 border border-white/10 rounded-xl px-5 py-3 w-full text-white font-black text-3xl outline-none focus:border-[#dfff00] focus:shadow-[0_0_15px_rgba(223,255,0,0.2)] transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-[#dfff00]/80">⏰ Deadline Giornata (Ora Locale)</label>
                                    <div className="relative">
                                        <input
                                            type="datetime-local"
                                            value={formatForInput(matchday.deadline)}
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                const localDate = new Date(val);
                                                const isoDate = localDate.toISOString();
                                                setMatchday({ ...matchday, deadline: isoDate });
                                                await gameService.updateDeadline(isoDate);
                                                const md = await gameService.getMatchday();
                                                setMatchday(md);
                                            }}
                                            className="bg-black/50 border border-white/10 rounded-xl px-5 py-3 w-full text-white font-black text-lg outline-none focus:border-[#dfff00] focus:shadow-[0_0_15px_rgba(223,255,0,0.2)] transition-all cursor-pointer"
                                        />
                                        <div className="absolute top-1/2 right-6 -translate-y-1/2 pointer-events-none text-2xl opacity-50">📅</div>
                                    </div>
                                    <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest text-white">Sincronizzazione orario attiva</p>

                                    <div className="mt-3 flex items-center gap-3">
                                        {matchday.betsLocked ? (
                                            <>
                                                <span className="px-3 py-1 rounded-full bg-red-600 text-black font-black text-[10px] uppercase">Scommesse CHIUSE</span>
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Sbloccare le scommesse per questa giornata?')) return;
                                                        const res = await gameService.setBetLock(false);
                                                        if (res && res.success) {
                                                            const md = await gameService.getMatchday();
                                                            setMatchday(md);
                                                            alert('Scommesse sbloccate.');
                                                        } else {
                                                            alert('Errore: ' + (res?.message || 'Operazione fallita'));
                                                        }
                                                    }}
                                                    className="px-3 py-2 rounded-xl bg-amber-600 text-black font-black uppercase text-xs tracking-widest hover:bg-amber-500 transition-all"
                                                >
                                                    Sblocca Inserimenti
                                                </button>
                                            </>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-green-600 text-black font-black text-[10px] uppercase">Scommesse APERTE</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-transparent p-5 md:p-8 rounded-[24px] border-2 border-white/20 hover:border-white/40 transition-colors shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                                <h3 className="text-white text-2xl font-black italic uppercase tracking-tighter mb-5">Azioni Rapide</h3>
                                <div className="flex flex-col sm:flex-row gap-4 w-full">
                                    <button
                                        onClick={async () => {
                                            if (confirm("Reset completo giornata?")) {
                                                await gameService.resetMatchday();
                                                const md = await gameService.getMatchday();
                                                setMatchday(md);
                                            }
                                        }}
                                        className="flex-1 bg-transparent text-red-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/50 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all"
                                    >
                                        ⚠ Reset
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (confirm("Archiviare giornata? Questo PROCESSERÀ AUTOMATICAMENTE anche il round Survival!")) {
                                                const res = await gameService.archiveMatchday();
                                                let msg = res.message;
                                                if (res.survivalStats) {
                                                    msg += `\n\n💀 SURVIVAL:\n- Eliminati: ${res.survivalStats.eliminated}\n- Avanzati: ${res.survivalStats.advanced}`;
                                                }
                                                alert(msg);
                                                const md = await gameService.getMatchday();
                                                setMatchday(md);
                                            }
                                        }}
                                        className="flex-1 bg-transparent text-[#dfff00] py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-[#dfff00]/50 hover:bg-[#dfff00] hover:text-black hover:border-[#dfff00] hover:shadow-[0_0_20px_rgba(223,255,0,0.4)] transition-all"
                                    >
                                        📂 Archivia & Processa
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-transparent rounded-[24px] p-5 md:p-8 border-2 border-white/10 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#dfff00] to-transparent opacity-50"></div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-6 text-white flex items-center gap-4">
                                Match Editor <span className="text-[10px] font-bold bg-[#dfff00] text-black px-2 py-0.5 rounded-full not-italic tracking-normal">Active</span>
                            </h3>
                            <div className="grid gap-4">
                                {matchday.matches.map((m, idx) => (
                                    <div key={idx} className="bg-white/5 p-4 md:p-6 rounded-2xl border border-white/5 hover:border-[#dfff00]/30 transition-all flex flex-col lg:flex-row items-center gap-5 group">
                                        <div className="flex items-center gap-3 w-full lg:w-auto">
                                            <span className="text-3xl font-black italic text-white/10 group-hover:text-[#dfff00]/20 font-mono transition-colors">#{idx + 1}</span>
                                            <div className="lg:hidden bg-black/40 px-3 py-1 rounded-full text-[9px] font-black uppercase text-gray-400 border border-white/5 flex-1 text-center">
                                                {m.league}
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                                            <input
                                                type="text"
                                                value={m.home}
                                                onChange={(e) => handleUpdateMatch(idx, 'home', e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-5 py-3 text-white font-black text-lg text-center md:text-left focus:border-[#dfff00] outline-none transition-colors"
                                            />
                                            <span className="text-[#dfff00] font-black italic text-xs opacity-40 text-center">VS</span>
                                            <input
                                                type="text"
                                                value={m.away}
                                                onChange={(e) => handleUpdateMatch(idx, 'away', e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-5 py-3 text-white font-black text-lg text-center md:text-right focus:border-[#dfff00] outline-none transition-colors"
                                            />
                                        </div>

                                        <div className="hidden lg:block bg-black/40 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 border border-white/5 min-w-[100px] text-center">
                                            {m.league}
                                        </div>

                                        {/* Result Buttons */}
                                        <div className="flex gap-2 bg-black/40 p-2 rounded-xl border border-white/10 w-full lg:w-auto">
                                            {['1', 'X', '2'].map(res => (
                                                <button
                                                    key={res}
                                                    onClick={() => {
                                                        gameService.updateMatchResult(idx, res);
                                                        const newResults = [...matchday.results];
                                                        newResults[idx] = res;
                                                        setMatchday({ ...matchday, results: newResults });
                                                    }}
                                                    className={`h-14 lg:h-11 w-full lg:w-11 rounded-lg font-black text-lg transition-all ${matchday.results[idx] === res
                                                        ? 'bg-[#dfff00] text-black shadow-[0_0_12px_rgba(223,255,0,0.4)] scale-105'
                                                        : 'text-gray-500 hover:text-white hover:bg-white/10'
                                                        }`}
                                                >
                                                    {res}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    gameService.updateMatchResult(idx, null);
                                                    const newResults = [...matchday.results];
                                                    newResults[idx] = null;
                                                    setMatchday({ ...matchday, results: newResults });
                                                }}
                                                className="h-14 lg:h-11 w-14 lg:w-11 rounded-lg bg-transparent border border-white/5 flex items-center justify-center text-gray-600 hover:text-red-500 hover:border-red-500/50 transition-all"
                                            >
                                                ↺
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'USERS' ? (
                    <div className="bg-transparent rounded-[30px] p-4 md:p-10 border-2 border-white/10 relative overflow-hidden">
                        <UserManagementPanel />
                    </div>
                ) : activeTab === 'SYSTEM' ? (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-transparent rounded-[30px] p-10 border-2 border-red-500/20 relative overflow-hidden text-center">
                            <div className="max-w-xl mx-auto space-y-8">
                                <div className="space-y-4">
                                    <h3 className="text-4xl font-black italic text-red-500 uppercase tracking-tighter">RESET TOTALE SISTEMA</h3>
                                    <p className="text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                                        Questa azione <span className="text-red-500">eliminerà permanentemente</span> tutte le scommesse, i duelli, le stagioni survival e le giornate create.
                                        Inoltre, resetterà i token e le statistiche di <span className="text-white">tutti gli utenti</span> ai valori predefiniti per il lancio ufficiale.
                                    </p>
                                </div>

                                <div className="bg-red-500/5 p-6 rounded-3xl border border-red-500/10">
                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-4">⚠ ATTENZIONE: AZIONE IRREVERSIBILE ⚠</p>
                                    <button
                                        onClick={async () => {
                                            const secret = prompt("Per confermare il reset totale, scrivi 'RESET' (senza virgolette):");
                                            if (secret !== 'RESET') return;

                                            setLoading(true);
                                            const res = await gameService.resetSystem();
                                            setLoading(false);

                                            if (res.success) {
                                                alert(res.message);
                                                window.location.reload();
                                            } else {
                                                alert("Errore durante il reset: " + res.message);
                                            }
                                        }}
                                        disabled={loading}
                                        className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-red-500 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(239,68,68,0.3)] border border-red-400/30"
                                    >
                                        {loading ? 'RESETTING...' : 'ESIGUI RESET DI LANCIO'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-transparent rounded-[30px] p-4 md:p-10 border-2 border-white/10 relative overflow-hidden">
                        <SurvivalAdminPanel />
                    </div>
                )}
            </div>
            {/* Status Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-md p-4 z-50 flex items-center justify-center gap-6 border-t border-white/10">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#dfff00] shadow-[0_0_10px_#dfff00]"></span>
                    <span className="text-[#dfff00] text-[10px] font-black uppercase tracking-[0.3em] opacity-80">System Online</span>
                </div>
                <div className="w-px h-4 bg-white/10 hidden md:block"></div>
                <span className="hidden md:block text-gray-600 text-[9px] font-black uppercase tracking-[0.2em]">Secure Admin Connection</span>
            </div>
        </div>
    );
};

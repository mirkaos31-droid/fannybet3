import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import type { SurvivalSeason, SurvivalPlayer } from '../types';

export const SurvivalAdminPanel: React.FC = () => {
    const [season, setSeason] = useState<SurvivalSeason | null>(null);
    const [players, setPlayers] = useState<SurvivalPlayer[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await gameService.getSurvivalState();
        setSeason(data.season);
        setPlayers(data.players);
    };



    const handleCloseSeason = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!season) return;
        if (!window.confirm('Chiudere la stagione e proclamare il vincitore?')) return;

        setLoading(true);
        setMsg(null);
        try {
            const res = await gameService.closeSurvivalSeason(season.id);
            console.log('Close season response:', res);
            if (res.success) {
                setMsg({ type: 'success', text: res.message });
                loadData();
            } else {
                setMsg({ type: 'error', text: res.message });
            }
        } catch (err) {
            console.error(err);
            setMsg({ type: 'error', text: 'Errore interno.' });
        } finally {
            setLoading(false);
        }
    };

    const handleNewSeason = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!window.confirm('Creare una nuova stagione Survival?')) return;

        setLoading(true);
        setMsg(null);
        try {
            const res = await gameService.startNewSurvivalSeason();
            if (res.success) {
                setMsg({ type: 'success', text: res.message });
                loadData();
            } else {
                setMsg({ type: 'error', text: res.message });
            }
        } catch (err) {
            console.error("Error creating new season:", err);
            setMsg({ type: 'error', text: 'Errore imprevisto durante la creazione.' });
        } finally {
            setLoading(false);
        }
    };

    const aliveCount = players.filter(p => p.status === 'ALIVE').length;
    const deadCount = players.filter(p => p.status !== 'ALIVE').length;

    if (!season) {
        return (
            <div className="glass-panel text-center py-12 border-dashed border-white/10">
                <h3 className="text-2xl font-display font-bold mb-4">🗡️ SURVIVAL MODE</h3>
                <p className="text-gray-400 mb-8 max-w-md mx-auto italic">Non ci sono stagioni attive al momento. Vuoi iniziarne una nuova e aprire le iscrizioni?</p>
                <button
                    onClick={(e) => handleNewSeason(e)}
                    disabled={loading}
                    className="bg-black text-[#dfff00] px-10 py-4 rounded-full font-black text-xl hover:scale-105 transition-all shadow-[8px_8px_0px_black] border-2 border-black disabled:opacity-50"
                >
                    {loading ? 'ATTENDI...' : '➕ CREA NUOVA STAGIONE'}
                </button>
            </div>
        );
    }

    return (
        <div className="glass-panel space-y-4">
            <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[#dfff00]/20">
                <h3 className="text-3xl font-black italic text-white flex items-center gap-4 tracking-tighter">
                    🗡️ SURVIVAL MODE
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${season.status === 'OPEN' ? 'bg-[#dfff00] text-black border-[#dfff00]' : 'bg-transparent text-gray-500 border-gray-500'}`}>
                        {season.status}
                    </span>
                </h3>
                <button
                    onClick={loadData}
                    className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-[#dfff00]/30 hover:bg-[#dfff00] hover:text-black hover:border-[#dfff00] transition-all"
                    title="Aggiorna dati"
                >
                    <span className="text-xl group-hover:rotate-180 transition-transform duration-500">↻</span>
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Refresh</span>
                </button>
            </div>

            {msg && (
                <div className={`p-4 rounded-2xl border-2 text-xs font-black uppercase tracking-widest mb-6 ${msg.type === 'success' ? 'bg-[#dfff00]/10 border-[#dfff00] text-[#dfff00]' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                    {msg.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-black/40 border-2 border-[#dfff00] p-4 rounded-3xl text-center shadow-[0_0_20px_rgba(223,255,0,0.1)] relative overflow-hidden group hover:scale-[1.02] transition-transform">
                    <div className="absolute inset-0 bg-[#dfff00]/5 group-hover:bg-[#dfff00]/10 transition-colors"></div>
                    <div className="text-[9px] text-[#dfff00] font-black uppercase tracking-[0.3em] mb-1 opacity-80">Montepremi Accumulato</div>
                    <div className="text-3xl font-black text-white italic tracking-tighter drop-shadow-lg">{season.prizePool} <span className="text-xl not-italic opacity-40 ml-1">FTK</span></div>
                </div>
                <div className="bg-black/40 border-2 border-[#dfff00]/50 p-4 rounded-3xl text-center group hover:border-[#dfff00] transition-colors">
                    <div className="text-[9px] text-green-400 font-black uppercase tracking-[0.3em] mb-1 opacity-80">Sopravvissuti</div>
                    <div className="text-3xl font-black text-white italic tracking-tighter">{aliveCount}</div>
                </div>
                <div className="bg-black/40 border-2 border-red-500/50 p-4 rounded-3xl text-center group hover:border-red-500 transition-colors">
                    <div className="text-[9px] text-red-500 font-black uppercase tracking-[0.3em] mb-1 opacity-80">Eliminati</div>
                    <div className="text-3xl font-black text-white italic tracking-tighter opacity-50 group-hover:opacity-100 transition-opacity">{deadCount}</div>
                </div>
            </div>

            {season.status !== 'COMPLETED' && (
                <div className="flex justify-end mb-8">
                    {/* Pulsante Processa rimosso come richiesto (ora automatico) */}
                    <button
                        onClick={(e) => handleCloseSeason(e)}
                        disabled={loading || aliveCount > 1}
                        className="bg-transparent hover:bg-red-600 text-red-500 hover:text-white border-2 border-red-600 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 flex items-center gap-2"
                    >
                        <span>💀</span> CHIUDI STAGIONE
                    </button>
                </div>
            )}

            {/* Player List / Command View */}
            <div className="mt-8 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold tracking-tight">SITUAZIONE PARTECIPANTI</h4>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">{players.length} GIOCATORI</span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-white/5">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-white/5 text-gray-400 uppercase text-[10px] font-bold">
                            <tr>
                                <th className="px-4 py-3">Utente</th>
                                <th className="px-4 py-3 text-center">Stato</th>
                                <th className="px-4 py-3">Pick Attuale</th>
                                <th className="px-4 py-3">Team Usati</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {players.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-600 italic">Nessun partecipante iscritto</td>
                                </tr>
                            ) : (
                                players.map(p => (
                                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-4 font-semibold text-white">{p.username}</td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-[9px] font-black leading-none ${p.status === 'ALIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-500'}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {p.currentPick ? (
                                                <span className="text-black font-mono font-black uppercase py-0.5 px-2 bg-[#dfff00] rounded border border-black/20">{p.currentPick}</span>
                                            ) : (
                                                <span className="text-gray-600 text-xs italic">Nessun pick</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {p.usedTeams.length > 0 ? (
                                                    p.usedTeams.map((team, idx) => (
                                                        <span key={idx} className="text-[10px] bg-black/40 text-gray-500 px-1.5 py-0.5 rounded border border-white/5">{team}</span>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-700">-</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {season.status === 'COMPLETED' && (
                <button onClick={(e) => handleNewSeason(e)} disabled={loading} className="bg-black text-[#dfff00] w-full py-4 rounded-2xl font-black mt-4 hover:scale-[1.02] transition-all shadow-[6px_6px_0px_rgba(0,0,0,0.2)] border-2 border-black">
                    ➕ CREA NUOVA STAGIONE
                </button>
            )}
        </div>
    );
};

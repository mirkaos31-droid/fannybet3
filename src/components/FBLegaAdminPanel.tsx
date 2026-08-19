import { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import { fbLegaService } from '../services/fbLegaService';

import type { FBLeague, Matchday } from '../types';
import { toast } from 'sonner';
import { Trophy, Play, Gift, Loader2, Settings2 } from 'lucide-react';

const PRIZE_PRESETS: Record<string, { label: string; desc: string; dist: number[] }> = {
    top1: { label: '🥇 Solo 1°', desc: '100% al primo', dist: [1.0] },
    top2: { label: '🥇🥈 1° e 2°', desc: '70% primo · 30% secondo', dist: [0.7, 0.3] },
    top3: { label: '🥇🥈🥉 Top 3', desc: '50% primo · 30% secondo · 20% terzo', dist: [0.5, 0.3, 0.2] },
};

export const FBLegaAdminPanel = () => {
    const [leagues, setLeagues] = useState<FBLeague[]>([]);
    const [matchday, setMatchday] = useState<Matchday | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Create form states
    const [newName, setNewName] = useState('');
    const [newFee, setNewFee] = useState(1);
    const [newDuration, setNewDuration] = useState(5);
    const [underdogEnabled, setUnderdogEnabled] = useState(false);
    const [comebackEnabled, setComebackEnabled] = useState(false);
    const [prizePreset, setPrizePreset] = useState<string>('top2');

    // Edit prize dist state per league
    const [editingPrizeDist, setEditingPrizeDist] = useState<number | null>(null);


    useEffect(() => {
        loadLeagues();
    }, []);

    const loadLeagues = async () => {
        try {
            setLoading(true);
            const [leaguesData, mdData] = await Promise.all([
                gameService.getLeagues(),
                gameService.getMatchday()
            ]);
            setLeagues(leaguesData);
            setMatchday(mdData);
        } catch {
            toast.error('Errore nel caricamento delle leghe');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLeague = async () => {
        if (!newName) {
            toast.error('Inserisci un nome per la lega');
            return;
        }

        try {
            setLoading(true);
            const result = await gameService.createLeague({
                name: newName,
                entry_fee: newFee,
                duration: newDuration,
                scoring_rules: {
                    "1": 1,
                    "X": 2,
                    "2": 1,
                    "underdog_enabled": underdogEnabled,
                    "monthly_comeback_enabled": comebackEnabled
                },
                prize_dist: PRIZE_PRESETS[prizePreset].dist
            });

            if (result.success) {
                toast.success('Lega creata con successo!');
                setShowCreateForm(false);
                setNewName('');
                setUnderdogEnabled(false);
                setComebackEnabled(false);
                setPrizePreset('top2');
                loadLeagues();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || 'Errore durante la creazione');
        } finally {
            setLoading(false);
        }
    };

    const handleResolveRound = async (leagueId: number) => {
        const league = leagues.find(l => l.id === leagueId);
        if (!league) return;
        
        if (!confirm(`Vuoi calcolare i punti per il Round ${league.current_round + 1} della lega "${league.name}"?`)) return;

        try {
            setActionLoading(leagueId);
            
            // 1. Get the matchdays for this league to find the correct ID for the current_round + 1
            const leagueMatchdays = await fbLegaService.getLeagueMatchdays(leagueId);
            const nextRound = league.current_round + 1;
            const targetMD = leagueMatchdays.find((m: any) => m.round_number === nextRound);


            if (!targetMD) {
                toast.error(`Impossibile trovare la giornata per il Round ${nextRound}`);
                return;
            }

            const result = await gameService.resolveRound(leagueId, targetMD.matchday_id);
            if (result.success) {
                toast.success(`${result.message} (${result.resolved_count} pronostici processati)`);
                loadLeagues();
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            toast.error(error.message || 'Errore durante la risoluzione');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDistributePrizes = async (leagueId: number) => {
        if (!confirm('Questa azione chiuderà la lega e distribuirà i premi ai vincitori. Procedere?')) return;

        try {
            setActionLoading(leagueId);
            const result = await gameService.distributePrizes(leagueId);
            if (result.success) {
                toast.success(result.message);
                loadLeagues();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || 'Errore durante la distribuzione');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdatePrizeDist = async (leagueId: number, presetKey: string) => {
        try {
            setActionLoading(leagueId);
            const result = await gameService.updateLeaguePrizeDist(leagueId, PRIZE_PRESETS[presetKey].dist);
            if (result.success) {
                toast.success(result.message);
                setEditingPrizeDist(null);
                loadLeagues();
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || 'Errore aggiornamento distribuzione');
        } finally {
            setActionLoading(null);
        }
    };

    const getPresetKeyFromDist = (dist: number[]): string => {
        if (!dist || dist.length === 0) return 'top1';
        if (dist.length === 1) return 'top1';
        if (dist.length === 3) return 'top3';
        return 'top2';
    };

    const PrizeDistSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
        <div className="grid grid-cols-3 gap-2">
            {Object.entries(PRIZE_PRESETS).map(([key, preset]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${value === key
                            ? 'border-[#dfff00] bg-[#dfff00]/10 shadow-[0_0_12px_rgba(223,255,0,0.15)]'
                            : 'border-white/10 bg-black/30 hover:border-white/20'
                        }`}
                >
                    <div className="text-sm mb-1">{preset.label}</div>
                    <div className={`text-[9px] font-bold uppercase tracking-wider ${value === key ? 'text-[#dfff00]' : 'text-gray-500'
                        }`}>{preset.desc}</div>
                </button>
            ))}
        </div>
    );


    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-[#bfff00]" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black italic uppercase text-white">Gestione FB Lega</h3>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="px-6 py-2 bg-[#dfff00] text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all"
                >
                    {showCreateForm ? 'Annulla' : '+ Nuova Lega'}
                </button>
            </div>

            {showCreateForm && (
                <div className="bg-white/5 border-2 border-[#dfff00]/30 rounded-3xl p-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h4 className="text-white font-black uppercase italic mb-6">Crea Nuovo Campionato</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-500">Nome Lega</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-black"
                                placeholder="E.g. Serie A Elite"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-500">Entry Fee (FTK)</label>
                            <input
                                type="number"
                                value={newFee}
                                onChange={(e) => setNewFee(parseInt(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-black"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-500">Durata (Giornate)</label>
                            <input
                                type="number"
                                value={newDuration}
                                onChange={(e) => setNewDuration(parseInt(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-black"
                            />
                        </div>
                    </div>

                    {/* Prize Distribution Selector */}
                    <div className="mt-6">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 block">
                            🏆 Distribuzione Premi
                        </label>
                        <PrizeDistSelector value={prizePreset} onChange={setPrizePreset} />
                    </div>

                    <div className="mt-6 flex flex-wrap gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={underdogEnabled}
                                    onChange={(e) => setUnderdogEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-[#dfff00] transition-all"></div>
                                <div className="absolute left-1 top-1 w-3 h-3 bg-white/40 rounded-full peer-checked:left-6 peer-checked:bg-black transition-all"></div>
                            </div>
                            <span className="text-[10px] font-black uppercase text-gray-400 group-hover:text-white transition-colors">Bonus Underdog (+2 PT)</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={comebackEnabled}
                                    onChange={(e) => setComebackEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-[#dfff00] transition-all"></div>
                                <div className="absolute left-1 top-1 w-3 h-3 bg-white/40 rounded-full peer-checked:left-6 peer-checked:bg-black transition-all"></div>
                            </div>
                            <span className="text-[10px] font-black uppercase text-gray-400 group-hover:text-white transition-colors">Rimonta del Mese (+10 PT)</span>
                        </label>
                    </div>

                    <div className="mt-8 p-4 bg-[#5d8aa8]/10 rounded-2xl border border-[#5d8aa8]/20">
                        <p className="text-[9px] text-[#5d8aa8] font-black uppercase tracking-wider mb-2">Regole Applicate Automaticamente:</p>
                        <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-bold text-gray-400">
                            <li>🎯 1 PT / Goal</li>
                            <li>❌ X = 2 PT</li>
                            <li>⚡ Strike = +3 PT</li>
                            <li>🌟 En Plein = +10 PT</li>
                        </ul>
                    </div>
                    <button
                        onClick={handleCreateLeague}
                        className="w-full mt-8 py-4 bg-[#dfff00] text-black rounded-2xl font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(223,255,0,0.2)]"
                    >
                        Inizia Campionato
                    </button>
                </div>
            )}

            <div className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Match Jolly Attivo:</span>
                    {matchday?.jollyMatchIndex !== undefined ? (
                        <span className="px-3 py-1 bg-[#5d8aa8]/20 text-[#5d8aa8] text-[10px] font-black rounded-full border border-[#5d8aa8]/30 uppercase">
                            Partita #{matchday.jollyMatchIndex + 1} ⭐
                        </span>
                    ) : (
                        <span className="text-red-500 text-[10px] font-bold uppercase italic">Nessuno Impostato (Usa Match Editor)</span>
                    )}
                </div>
                <div className="text-[9px] text-gray-600 font-bold uppercase italic">Verranno assegnati +2 PT extra</div>
            </div>

            {leagues.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                    <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Nessuna lega attiva nel database.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {leagues.map(league => (
                        <div key={league.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-xl ${league.status === 'COMPLETED' ? 'bg-gray-800' : 'bg-[#5d8aa8]/20'}`}>
                                        <Trophy className={league.status === 'COMPLETED' ? 'text-gray-500' : 'text-[#5d8aa8]'} size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-black uppercase italic text-lg">{league.name}</h4>
                                        <div className="flex gap-3 mt-1 flex-wrap">
                                            <span className="text-[9px] font-bold uppercase text-gray-500">Status: <span className="text-[#bfff00]">{league.status}</span></span>
                                            <span className="text-[9px] font-bold uppercase text-gray-500">Round: <span className="text-white">{league.current_round}/{league.duration_matchdays}</span></span>
                                            <span className="text-[9px] font-bold uppercase text-gray-500">Pool: <span className="text-white">{league.prize_pool} FTK</span></span>
                                            <span className="text-[9px] font-bold uppercase text-gray-500">Premi: <span className="text-[#dfff00]">{PRIZE_PRESETS[getPresetKeyFromDist(league.prize_distribution)]?.label || 'Custom'}</span></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto flex-wrap">
                                    {league.status !== 'COMPLETED' && (
                                        <button
                                            onClick={() => setEditingPrizeDist(editingPrizeDist === league.id ? null : league.id)}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-gray-400 rounded-xl font-black uppercase text-[10px] tracking-widest hover:border-[#dfff00]/30 hover:text-[#dfff00] transition-all"
                                        >
                                            <Settings2 size={14} />
                                            Premi
                                        </button>
                                    )}
                                    <button
                                        disabled={actionLoading === league.id || league.status === 'COMPLETED' || league.current_round >= league.duration_matchdays}
                                        onClick={() => handleResolveRound(league.id)}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#5d8aa8] text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 disabled:opacity-30 transition-all"
                                    >
                                        {actionLoading === league.id ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                                        Risolvi Round
                                    </button>

                                    <button
                                        disabled={actionLoading === league.id || league.status === 'COMPLETED'}
                                        onClick={() => handleDistributePrizes(league.id)}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#bfff00] text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:brightness-110 disabled:opacity-30 transition-all"
                                    >
                                        {actionLoading === league.id ? <Loader2 className="animate-spin" size={14} /> : <Gift size={14} />}
                                        Chiudi & Paga
                                    </button>
                                </div>
                            </div>

                            {/* Inline prize dist editor */}
                            {editingPrizeDist === league.id && (
                                <div className="pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 block">
                                        🏆 Modifica Distribuzione Premi
                                    </label>
                                    <PrizeDistSelector
                                        value={getPresetKeyFromDist(league.prize_distribution)}
                                        onChange={(key) => handleUpdatePrizeDist(league.id, key)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
};

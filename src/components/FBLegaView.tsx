import React, { useState, useEffect } from 'react';
import { Shield, Users, ChevronRight, PlusCircle, ArrowLeft, Loader2, Coins } from 'lucide-react';
import { gameService } from '../services/gameService';
import type { FBLeague } from '../types';
import { toast } from 'sonner';
import { LeagueDetailView } from './LeagueDetailView';

const PRIZE_PRESETS: Record<string, { label: string; desc: string; dist: number[] }> = {
    top1: { label: '🥇 Solo 1°', desc: '100% al primo', dist: [1.0] },
    top2: { label: '🥇🥈 1° e 2°', desc: '70% primo · 30% secondo', dist: [0.7, 0.3] },
    top3: { label: '🥇🥈🥉 Top 3', desc: '50% primo · 30% secondo · 20% terzo', dist: [0.5, 0.3, 0.2] },
};

export const FBLegaView: React.FC = () => {
    const [leagues, setLeagues] = useState<FBLeague[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'DISCOVER' | 'MY_LEAGUES' | 'CREATE'>('DISCOVER');
    const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);

    // Create Form State
    const [newLeague, setNewLeague] = useState({
        name: '',
        entryFee: 10,
        duration: 5,
        bonusX: 1
    });
    const [prizePreset, setPrizePreset] = useState<string>('top2');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const leaguesData = await gameService.getLeagues();
            setLeagues(leaguesData);
        } catch (error) {
            console.error('Error loading FB Lega data:', error);
            toast.error('Errore nel caricamento delle leghe');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLeague = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const scoring_rules = { "1": 1, "X": newLeague.bonusX, "2": 1 };
            const result = await gameService.createLeague({
                name: newLeague.name,
                entry_fee: newLeague.entryFee,
                duration: newLeague.duration,
                scoring_rules,
                prize_dist: PRIZE_PRESETS[prizePreset].dist
            });
            if (result.success) {
                toast.success(result.message);
                setView('DISCOVER');
                loadData();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || 'Errore durante la creazione');
        }
    };

    const handleJoinLeague = async (leagueId: number) => {
        try {
            const result = await gameService.joinLeague(leagueId);
            if (result.success) {
                toast.success(result.message);
                loadData();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || 'Errore durante l\'iscrizione');
        }
    };

    if (selectedLeagueId) {
        return <LeagueDetailView leagueId={selectedLeagueId} onBack={() => setSelectedLeagueId(null)} />;
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#5d8aa8] mb-4" size={48} />
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Sincronizzazione Interstellare...</p>
            </div>
        );
    }

    if (view === 'CREATE') {
        return (
            <div className="animate-fade-in max-w-2xl mx-auto pb-20 px-4">
                <button onClick={() => setView('DISCOVER')} className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={16} /> <span className="text-[10px] font-black uppercase">Annulla</span>
                </button>

                <h2 className="text-3xl font-black italic text-white uppercase mb-8">Configura Nuova Lega</h2>

                <form onSubmit={handleCreateLeague} className="glass-panel p-8 border-white/5 space-y-6">
                    <div>
                        <label className="block text-gray-500 font-black uppercase text-[10px] mb-2 tracking-widest">Nome del Campionato</label>
                        <input
                            type="text" required
                            value={newLeague.name}
                            onChange={e => setNewLeague({ ...newLeague, name: e.target.value })}
                            placeholder="Es: LEGA DEI CAMPIONI"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-black uppercase placeholder:text-gray-700"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-500 font-black uppercase text-[10px] mb-2 tracking-widest">Entry Fee (FTK)</label>
                            <input
                                type="number" required min="1"
                                value={newLeague.entryFee}
                                onChange={e => setNewLeague({ ...newLeague, entryFee: parseInt(e.target.value) })}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-black uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-500 font-black uppercase text-[10px] mb-2 tracking-widest">Durata (RD)</label>
                            <input
                                type="number" required min="1" max="38"
                                value={newLeague.duration}
                                onChange={e => setNewLeague({ ...newLeague, duration: parseInt(e.target.value) })}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-black uppercase"
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-[#bfff00]/5 border border-[#bfff00]/10 rounded-2xl">
                        <label className="block text-[#bfff00] font-black uppercase text-[10px] mb-4 tracking-[0.2em] italic">Bonus Speciale: Segno X</label>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-[10px] font-black uppercase">Punti assegnati per ogni 'X' indovinata:</span>
                            <select
                                value={newLeague.bonusX}
                                onChange={e => setNewLeague({ ...newLeague, bonusX: parseInt(e.target.value) })}
                                className="bg-black border border-[#bfff00]/30 rounded-lg px-4 py-2 text-[#bfff00] font-black"
                            >
                                <option value={1}>1 PT (Standard)</option>
                                <option value={2}>2 PT (Bonus)</option>
                                <option value={3}>3 PT (Extreme)</option>
                            </select>
                        </div>
                    </div>

                    {/* Prize Distribution Selector */}
                    <div className="mt-6">
                        <label className="block text-gray-500 font-black uppercase text-[10px] mb-3 tracking-widest">🏆 Distribuzione Premi</label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(PRIZE_PRESETS).map(([key, preset]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setPrizePreset(key)}
                                    className={`p-3 rounded-xl border-2 text-center transition-all ${prizePreset === key
                                        ? 'border-[#bfff00] bg-[#bfff00]/10 shadow-[0_0_12px_rgba(191,255,0,0.15)]'
                                        : 'border-white/10 bg-black/30 hover:border-white/20'
                                        }`}
                                >
                                    <div className="text-sm mb-1">{preset.label}</div>
                                    <div className={`text-[9px] font-bold uppercase tracking-wider ${prizePreset === key ? 'text-[#bfff00]' : 'text-gray-500'
                                        }`}>{preset.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 bg-[#bfff00] text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(191,255,0,0.3)]"
                    >
                        Inizializza Campionato
                    </button>
                </form>
            </div>
        );
    }

    // Filter leagues
    const displayedLeagues = view === 'DISCOVER'
        ? leagues.filter(l => l.status === 'OPEN')
        : leagues.filter(l => l.is_member && l.status !== 'COMPLETED');

    return (
        <div className="animate-fade-in pb-20 px-1 md:px-0">
            {/* Hub Header */}
            <div className="relative mb-12 overflow-hidden rounded-[3rem] p-12 bg-gradient-to-br from-[#1a2c38] to-[#0a0a0c] border border-white/5 card-scudetto-active">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-1 bg-[#5d8aa8] rounded-full"></div>
                        <span className="text-[#5d8aa8] font-black uppercase tracking-[0.4em] text-[10px]">Circuito Ufficiale</span>
                    </div>
                    <h2 className="text-4xl md:text-7xl font-black italic tracking-tighter text-white uppercase leading-[0.8]">
                        FB LEGA<br />
                        <span className="text-[#5d8aa8]">CHAMPIONSHIP</span>
                    </h2>
                    <p className="mt-6 text-gray-500 font-bold uppercase text-[10px] md:text-xs max-w-md leading-relaxed tracking-wider">
                        La competizione definitiva. 10 partite, regole speciali e una scalata verso il titolo interstellare.
                    </p>
                </div>
            </div>

            {/* Hub Navigation / Dashboard Entry */}

            {/* Tabs */}
            <div className="flex justify-center gap-1 mb-8">
                <button
                    onClick={() => setView('DISCOVER')}
                    className={`px-8 py-3 rounded-l-full font-black text-xs uppercase tracking-widest border transition-all ${view === 'DISCOVER'
                        ? 'bg-[#2c5a78] border-[#2c5a78] text-white shadow-[0_0_15px_rgba(44,90,120,0.5)]'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:border-[#2c5a78]/30'
                        }`}
                >
                    Scopri
                </button>
                <button
                    onClick={() => setView('MY_LEAGUES')}
                    className={`px-8 py-3 rounded-r-full font-black text-xs uppercase tracking-widest border transition-all ${view === 'MY_LEAGUES'
                        ? 'bg-[#2c5a78] border-[#2c5a78] text-white shadow-[0_0_15px_rgba(44,90,120,0.5)]'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:border-[#2c5a78]/30'
                        }`}
                >
                    Le Mie Leghe
                </button>
            </div>

            {/* League List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto px-4">
                {displayedLeagues.length === 0 ? (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                        <Users size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-500 font-black uppercase tracking-widest text-sm">
                            Nessun campionato orbita in questa zona.
                        </p>
                    </div>
                ) : (
                    displayedLeagues.map(league => (
                        <div
                            key={league.id}
                            onClick={() => setSelectedLeagueId(league.id)}
                            className="glass-card card-lega-alieno p-6 group cursor-pointer hover:translate-y-[-4px] transition-all"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-[#2c5a78]/20 rounded-2xl group-hover:bg-[#2c5a78]/30 transition-colors border border-[#2c5a78]/30">
                                    <Shield size={24} className="text-[#5d8aa8]" />
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black tracking-widest text-gray-500 uppercase">Entry</span>
                                    <div className="flex items-center gap-1 text-[#5d8aa8] font-black italic">
                                        <Coins size={14} />
                                        <span>{league.entry_fee} FTK</span>
                                    </div>
                                </div>
                            </div>

                            <h3 className="text-xl font-black italic text-white uppercase mb-2 group-hover:text-[#5d8aa8] transition-colors">
                                {league.name}
                            </h3>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                                    <span>Progresso</span>
                                    <span className="text-white">{league.current_round} / {league.duration_matchdays} RD</span>
                                </div>
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#5d8aa8] to-[#bfff00] transition-all duration-1000"
                                        style={{ width: `${(league.current_round / league.duration_matchdays) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                                        <Users size={12} className="text-gray-500" />
                                    </div>
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{league.participant_count || 0} Partecipanti</span>
                                </div>

                                {view === 'DISCOVER' && !league.is_member ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleJoinLeague(league.id);
                                        }}
                                        className="px-4 py-2 bg-[#5d8aa8] text-white text-[10px] font-black uppercase rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(93,138,168,0.3)]"
                                    >
                                        Iscriviti
                                    </button>
                                ) : (
                                    <ChevronRight className="text-gray-600 group-hover:text-[#5d8aa8] transition-colors" />
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create League Button - visible to all */}
            {view === 'DISCOVER' && (
                <div className="mt-12 flex justify-center">
                    <button
                        onClick={() => setView('CREATE')}
                        className="flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[#bfff00] font-black uppercase text-xs tracking-[0.2em] hover:bg-[#bfff00]/10 hover:border-[#bfff00]/30 transition-all"
                    >
                        <PlusCircle size={18} />
                        Crea Nuovo Campionato
                    </button>
                </div>
            )}
        </div>
    );
};

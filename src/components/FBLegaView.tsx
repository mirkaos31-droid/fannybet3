import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Users, ChevronRight, PlusCircle, ArrowLeft, Loader2, Coins, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { gameService } from '../services/gameService';
import { fbLegaService } from '../services/fbLegaService';
import type { FBLeague } from '../types';
import { toast } from 'sonner';
import { LeagueDetailView } from './LeagueDetailView';

const SERIE_A_TOTAL_ROUNDS = 38;

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

    // Serie A round tracking
    const [completedRounds, setCompletedRounds] = useState<number>(0);
    const remainingRounds = SERIE_A_TOTAL_ROUNDS - completedRounds;

    // Create Form State
    const [newLeague, setNewLeague] = useState({
        name: '',
        entryFee: 10,
        duration: 5,
        bonusX: 1
    });
    const [prizePreset, setPrizePreset] = useState<string>('top2');
    const [untilEndOfSeason, setUntilEndOfSeason] = useState(false);

    // 4-tranche payment config
    const [showTranches, setShowTranches] = useState(false);
    const [tranches, setTranches] = useState<[number, number, number, number]>([0, 0, 0, 0]);

    const computeDefaultTranches = useCallback((duration: number): [number, number, number, number] => {
        const base = Math.floor(duration / 4);
        const rem = duration % 4;
        return [base + (rem > 0 ? 1 : 0), base + (rem > 1 ? 1 : 0), base + (rem > 2 ? 1 : 0), base];
    }, []);

    useEffect(() => {
        loadData();
        fbLegaService.getCompletedMatchdaysCount()
            .then(count => setCompletedRounds(count))
            .catch(() => {});
    }, []);

    // Auto-ricalcola le rate quando cambia la durata o si apre il pannello
    useEffect(() => {
        if (showTranches) {
            setTranches(computeDefaultTranches(newLeague.duration));
        }
    }, [newLeague.duration, showTranches, computeDefaultTranches]);

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

        if (showTranches) {
            const total = tranches.reduce((a, b) => a + b, 0);
            if (total !== newLeague.duration) {
                toast.error(`La somma dei 4 gruppi (${total}) deve essere uguale alla durata (${newLeague.duration} giornate)`);
                return;
            }
            if (tranches.some(t => t <= 0)) {
                toast.error('Ogni gruppo deve avere almeno 1 giornata');
                return;
            }
        }

        try {
            const paymentConfig = showTranches
                ? { payment_tranches: tranches, payment_mode: 'installments' }
                : { payment_mode: 'full' };

            const scoring_rules = {
                "1": 1,
                "X": newLeague.bonusX,
                "2": 1,
                "until_end_of_season": untilEndOfSeason,
                "completed_rounds_at_creation": completedRounds,
                ...paymentConfig
            };
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
                setUntilEndOfSeason(false);
                setShowTranches(false);
                setNewLeague({ name: '', entryFee: 10, duration: 5, bonusX: 1 });
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
                window.dispatchEvent(new Event('tokens-updated'));
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
                <Loader2 className="animate-spin text-[#bfff00] mb-4" size={48} />
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
                                onChange={e => setNewLeague({ ...newLeague, entryFee: parseInt(e.target.value) || 0 })}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-black uppercase"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-gray-500 font-black uppercase text-[10px] tracking-widest">Durata (RD)</label>
                                {untilEndOfSeason && (
                                    <span className="text-[8px] font-black text-[#bfff00] uppercase tracking-wider bg-[#bfff00]/10 px-2 py-0.5 rounded-full border border-[#bfff00]/20">
                                        Fine Serie A
                                    </span>
                                )}
                            </div>
                            <input
                                type="number" required min="1" max={remainingRounds}
                                value={newLeague.duration}
                                onChange={e => {
                                    setNewLeague({ ...newLeague, duration: parseInt(e.target.value) || 0 });
                                    setUntilEndOfSeason(false);
                                }}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white font-black uppercase"
                            />
                        </div>
                    </div>

                    {/* Info barra Serie A */}
                    <div className="px-3 py-2 bg-black/30 rounded-xl border border-white/5 flex items-center gap-4 flex-wrap">
                        <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Serie A 26/27:</span>
                        <span className="text-[9px] font-bold text-gray-400">Completate: <span className="text-white">{completedRounds}</span></span>
                        <span className="text-[9px] font-bold text-gray-400">Rimanenti: <span className="text-[#bfff00]">{remainingRounds}</span></span>
                        <span className="text-[9px] font-bold text-gray-400">Totale: <span className="text-white">{SERIE_A_TOTAL_ROUNDS}</span></span>
                    </div>

                    {/* Presets Durata Rapidi */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mr-1">Preset:</span>
                        {[5, 10].map(d => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => { setNewLeague({ ...newLeague, duration: d }); setUntilEndOfSeason(false); }}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${newLeague.duration === d && !untilEndOfSeason ? 'bg-[#bfff00]/20 text-[#bfff00] border-[#bfff00]/40' : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/10'}`}
                            >
                                {d} Turni
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => { setNewLeague({ ...newLeague, duration: remainingRounds }); setUntilEndOfSeason(true); }}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                                untilEndOfSeason
                                    ? 'bg-[#bfff00] text-black border-[#bfff00] shadow-[0_0_12px_rgba(191,255,0,0.4)]'
                                    : 'bg-white/5 text-gray-300 border-white/10 hover:border-[#bfff00]/40 hover:text-[#bfff00]'
                            }`}
                        >
                            <span>🏆 Fine Campionato ({remainingRounds} RD rimanenti)</span>
                        </button>
                    </div>

                    {/* Pagamento a Rate — 4 Gruppi */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowTranches(!showTranches)}
                            className={`w-full flex items-center justify-between px-5 py-3 rounded-xl border transition-all ${
                                showTranches
                                    ? 'bg-[#5d8aa8]/15 border-[#5d8aa8]/40 text-[#5d8aa8]'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span>💳</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">Pagamento a Rate (4 Fasi)</span>
                                {showTranches && <span className="text-[8px] bg-[#5d8aa8]/20 text-[#5d8aa8] px-2 py-0.5 rounded-full border border-[#5d8aa8]/30 font-black uppercase">Attivo</span>}
                            </div>
                            {showTranches ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showTranches && (
                            <div className="mt-3 p-5 bg-[#5d8aa8]/10 border border-[#5d8aa8]/20 rounded-2xl space-y-4">
                                <p className="text-[9px] text-[#5d8aa8] font-black uppercase tracking-wider">
                                    Ogni fase ha lo stesso costo: <strong>{newLeague.entryFee} FTK</strong> × 4 fasi = <strong>{newLeague.entryFee * 4} FTK</strong> totali.
                                    La somma delle fasi deve essere <strong>{newLeague.duration}</strong> giornate.
                                </p>

                                <div className="grid grid-cols-4 gap-3">
                                    {([0, 1, 2, 3] as const).map(i => {
                                        const labels = ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'];
                                        const startGN = completedRounds + tranches.slice(0, i).reduce((a, b) => a + b, 0) + 1;
                                        const endGN = startGN + tranches[i] - 1;
                                        return (
                                            <div key={i} className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block text-center">{labels[i]}</label>
                                                <input
                                                    type="number" min="1"
                                                    value={tranches[i]}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setTranches(prev => { const n = [...prev] as [number,number,number,number]; n[i] = val; return n; });
                                                    }}
                                                    className="w-full bg-black/40 border border-[#5d8aa8]/30 rounded-xl px-2 py-3 text-white font-black text-center text-lg"
                                                />
                                                <div className="text-[8px] text-center font-bold text-gray-600">
                                                    {tranches[i] > 0 ? `GN ${startGN}–${endGN}` : '—'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {(() => {
                                    const total = tranches.reduce((a, b) => a + b, 0);
                                    const ok = total === newLeague.duration && tranches.every(t => t > 0);
                                    const diff = total - newLeague.duration;
                                    return (
                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                                            ok ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-red-900/20 border-red-500/30 text-red-400'
                                        }`}>
                                            {ok ? (
                                                <span className="text-[9px] font-black uppercase tracking-wider">✅ Valido — {newLeague.duration} giornate totali</span>
                                            ) : (
                                                <><AlertTriangle size={12} /><span className="text-[9px] font-black uppercase tracking-wider">Totale: {total} / {newLeague.duration} — {diff > 0 ? `${diff} di troppo` : `mancano ${Math.abs(diff)}`}</span></>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
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
            <div className="relative mb-12 overflow-hidden rounded-[3rem] p-8 md:p-14 bg-gradient-to-br from-[#0c1a10] to-[#0a0a0c] border border-[#bfff00]/20 card-scudetto-active">
                <div className="relative z-10 flex flex-col items-center text-center">
                    <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black italic tracking-tighter uppercase leading-[0.82]">
                        <span className="text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]">FANTA 1X2</span><br />
                        <span className="text-[#bfff00] drop-shadow-[0_0_35px_rgba(191,255,0,0.45)]">CHAMPIONSHIP</span>
                    </h2>
                    <p className="mt-6 text-gray-400 font-bold uppercase text-[10px] md:text-xs max-w-md leading-relaxed tracking-wider mx-auto">
                        il campionato più divertente che ci sia.
                    </p>
                </div>
            </div>

            {/* Hub Navigation / Dashboard Entry */}

            {/* Tabs */}
            <div className="flex justify-center gap-1 mb-8">
                <button
                    onClick={() => setView('DISCOVER')}
                    className={`px-8 py-3 rounded-l-full font-black text-xs uppercase tracking-widest border transition-all ${view === 'DISCOVER'
                        ? 'bg-[#bfff00] border-[#bfff00] text-black shadow-[0_0_20px_rgba(191,255,0,0.4)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-[#bfff00]/40 hover:text-white'
                        }`}
                >
                    Scopri
                </button>
                <button
                    onClick={() => setView('MY_LEAGUES')}
                    className={`px-8 py-3 rounded-r-full font-black text-xs uppercase tracking-widest border transition-all ${view === 'MY_LEAGUES'
                        ? 'bg-[#bfff00] border-[#bfff00] text-black shadow-[0_0_20px_rgba(191,255,0,0.4)]'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-[#bfff00]/40 hover:text-white'
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
                    displayedLeagues.map(league => {
                        const displayRound = league.status === 'COMPLETED' ? league.current_round : Math.min(league.current_round + 1, league.duration_matchdays);
                        return (
                            <div
                                key={league.id}
                                onClick={() => setSelectedLeagueId(league.id)}
                                className="glass-card card-lega-alieno p-6 group cursor-pointer hover:translate-y-[-4px] transition-all"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-3 bg-[#bfff00]/10 rounded-2xl group-hover:bg-[#bfff00]/20 transition-colors border border-[#bfff00]/20">
                                        <Shield size={24} className="text-[#bfff00]" />
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black tracking-widest text-gray-500 uppercase">
                                            {league.scoring_rules?.payment_mode === 'installments' ? 'Rata' : 'Entry'}
                                        </span>
                                        <div className="flex items-center gap-1 text-[#bfff00] font-black italic">
                                            <Coins size={14} />
                                            <span>{league.entry_fee} FTK</span>
                                        </div>
                                        {league.scoring_rules?.payment_mode === 'installments' && (
                                            <span className="text-[8px] font-black text-[#5d8aa8] uppercase tracking-wider">
                                                4 Rate
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-xl font-black italic text-white uppercase mb-2 group-hover:text-[#bfff00] transition-colors">
                                    {league.name}
                                </h3>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                                        <span>Progresso</span>
                                        <span className="text-white">{displayRound} / {league.duration_matchdays} RD</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#bfff00]/60 to-[#bfff00] shadow-[0_0_10px_rgba(191,255,0,0.5)] transition-all duration-1000"
                                            style={{ width: `${(displayRound / league.duration_matchdays) * 100}%` }}
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
                                            className="px-4 py-2 bg-[#bfff00] text-black text-[10px] font-black uppercase rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(191,255,0,0.3)]"
                                        >
                                            Iscriviti
                                        </button>
                                    ) : (
                                        <ChevronRight className="text-gray-600 group-hover:text-[#bfff00] transition-colors" />
                                    )}
                                </div>
                            </div>
                        );
                    })
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

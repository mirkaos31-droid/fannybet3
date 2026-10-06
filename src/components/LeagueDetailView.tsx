import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, ArrowLeft, Loader2, Info, ClipboardCheck, ChevronRight, Lock, CreditCard } from 'lucide-react';
import { gameService } from '../services/gameService';
import type { FBLeague, FBLeagueParticipant, Matchday, User } from '../types';
import { toast } from 'sonner';
import { LeaderboardModal } from './LeaderboardModal';
import { PredictionsModal } from './PredictionsModal';
import { LeagueRulesModal } from './LeagueRulesModal';
import { LeagueArchiveModal } from './LeagueArchiveModal';
import { supabase } from '../supabaseClient';
import { useBonusNotifications } from '../hooks/useBonusNotifications';

interface LeagueDetailViewProps {
    leagueId: number;
    onBack: () => void;
}

export const LeagueDetailView: React.FC<LeagueDetailViewProps> = ({ leagueId, onBack }) => {
    const [data, setData] = useState<{
        league: FBLeague;
        participants: FBLeagueParticipant[];
    } | null>(null);
    const [matchday, setMatchday] = useState<Matchday | null>(null);
    const [leaderboardMatchday, setLeaderboardMatchday] = useState<Matchday | null>(null);
    const [myPicks, setMyPicks] = useState<string[]>(new Array(10).fill(''));
    const [mySecretMatch, setMySecretMatch] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    const [archiveMatchdays, setArchiveMatchdays] = useState<{ matchday_id: number; round_number: number }[]>([]);
    const [historicalParticipants, setHistoricalParticipants] = useState<FBLeagueParticipant[]>([]);
    const [selectedHistoryMd, setSelectedHistoryMd] = useState<{ matchday: Matchday; round: number } | null>(null);

    const [activeModal, setActiveModal] = useState<'NONE' | 'LEADERBOARD' | 'PREDICTIONS' | 'RULES' | 'HISTORICAL_LEADERBOARD' | 'ARCHIVE_LIST'>('NONE');

    // [NEW] History Management for Modals
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            const modalInState = event.state?.activeModal || 'NONE';
            setActiveModal(modalInState);
        };

        // Initialize history state if not present
        if (!window.history.state) {
            window.history.replaceState({ activeModal: 'NONE' }, '');
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const updateModal = (newModal: typeof activeModal) => {
        if (newModal === activeModal) return;
        window.history.pushState({ activeModal: newModal }, '');
        setActiveModal(newModal);
    };

    // Bonus Notifications Hook - deve essere chiamato sempre, prima di qualsiasi return condizionale
    useBonusNotifications({
        leagueId,
        userId: user?.id,
        participants: data?.participants || [],
        matchdayId: leaderboardMatchday?.id || matchday?.id
    });

    const loadLeagueData = useCallback(async () => {
        try {
            setLoading(true);
            const [details, mdData, currentUser] = await Promise.all([
                gameService.getLeagueDetails(leagueId),
                gameService.getMatchday(),
                gameService.getCurrentUser()
            ]);

            setMatchday(mdData);
            setUser(currentUser);

            // Fetch LIVE leaderboard and merge with participants installments_paid
            const liveParticipants = await gameService.getLeagueLeaderboardLive(leagueId);
            const participantsWithInstallments = liveParticipants.map(lp => {
                const raw = details.participants.find(p => p.user_id === lp.user_id);
                return {
                    ...lp,
                    installments_paid: raw?.installments_paid ?? 1,
                    avatar_url: raw?.avatar_url
                };
            });
            setData({
                league: details.league,
                participants: participantsWithInstallments
            });

            // Fetch all matchdays for this league to determine the correct active round matchday details
            const allMds = await gameService.getLeagueMatchdays(leagueId);
            const activeRoundNum = details.league.current_round + 1;
            const activeRoundInfo = allMds.find(m => m.round_number === activeRoundNum);

            let activeRoundMd = mdData;
            if (activeRoundInfo) {
                if (mdData && activeRoundInfo.matchday_id === mdData.id) {
                    activeRoundMd = mdData;
                } else {
                    activeRoundMd = await gameService.getMatchdayById(activeRoundInfo.matchday_id);
                }
            }
            setLeaderboardMatchday(activeRoundMd);

            if (currentUser && mdData) {
                const picks = await gameService.getMyPicks(leagueId, currentUser.id);
                const currentMdPick = picks.find(p => p.matchday_id === mdData.id);
                if (currentMdPick) {
                    setMyPicks(currentMdPick.predictions);
                    setMySecretMatch(currentMdPick.secret_match_index ?? null);
                } else {
                    setMyPicks(Array(10).fill(''));
                    setMySecretMatch(null);
                }
            }

            // Fetch archive list
            if (details.league.current_round > 0) {
                const pastMds = allMds.filter(m => m.round_number <= details.league.current_round);
                setArchiveMatchdays(pastMds);
            }
        } catch (error) {
            console.error('Error loading league details:', error);
            toast.error('Errore nel caricamento dei dati');
        } finally {
            setLoading(false);
        }
    }, [leagueId]);

    useEffect(() => {
        loadLeagueData();
    }, [loadLeagueData]);

    // LIVE UPDATE LISTENER
    useEffect(() => {
        if (!leagueId) return;

        // Listen for changes in matchday results (when admin updates scores)
        const channel = supabase
            .channel(`live-scores-${leagueId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matchdays'
                },
                async (payload) => {
                    console.log('Matchday updated, refreshing leaderboard...', payload);
                    // Reload ONLY the leaderboard for efficiency
                    try {
                        const liveParticipants = await gameService.getLeagueLeaderboardLive(leagueId);
                        setData(prev => prev ? { ...prev, participants: liveParticipants } : null);
                    } catch (err) {
                        console.error('Error refreshing live leaderboard:', err);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [leagueId]);

    const handleSavePicks = async () => {
        if (!matchday) return;
        if (myPicks.some(p => p === '')) {
            toast.error('Compila tutti i 10 pronostici!');
            return;
        }

        try {
            setSaving(true);
            const result = await gameService.submitPicks(leagueId, matchday.id, myPicks, mySecretMatch);
            if (result.success) {
                // Success Notification for League
                if (user) {
                    await supabase.from('notifications').insert([{
                        user_id: user.id,
                        title: '🏁 Pronostici Lega Inviati',
                        message: `Hai salvato i tuoi 10 pronostici per il Fanta 1X2. In bocca al lupo!`,
                        type: 'success'
                    }]);
                }
                toast.success(result.message);
                updateModal('NONE');
                loadLeagueData(); // Refresh to see updated status
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || 'Errore durante il salvataggio');
        } finally {
            setSaving(false);
        }
    };

    const [payingInstallment, setPayingInstallment] = useState(false);

    const handlePayInstallment = async () => {
        if (!user || !data) return;
        try {
            setPayingInstallment(true);
            const result = await gameService.payInstallment(leagueId);
            if (result.success) {
                toast.success(result.message);
                await loadLeagueData();
                window.dispatchEvent(new Event('tokens-updated'));
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            const err = error as { message?: string };
            toast.error(err.message || 'Errore durante il pagamento della rata');
        } finally {
            setPayingInstallment(false);
        }
    };

    const handleShowHistory = async (mdId: number, roundNum: number) => {
        try {
            setLoading(true);
            const [histParticipants, fullMatchday] = await Promise.all([
                gameService.getHistoricalLeaderboard(leagueId, mdId),
                gameService.getMatchdayById(mdId)
            ]);

            if (!fullMatchday) {
                toast.error('Dati giornata non trovati');
                return;
            }

            const mergedHist = histParticipants.map(hp => {
                const raw = data?.participants.find(p => p.user_id === hp.user_id);
                return {
                    ...hp,
                    avatar_url: raw?.avatar_url
                };
            });
            setHistoricalParticipants(mergedHist);
            setSelectedHistoryMd({ matchday: fullMatchday, round: roundNum });
            updateModal('HISTORICAL_LEADERBOARD');
        } catch (err) {
            console.error('Error loading history:', err);
            toast.error('Errore nel caricamento dell\'archivio');
        } finally {
            setLoading(false);
        }
    };

    if (loading || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#5d8aa8] mb-4" size={48} />
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Analisi Dati Lega...</p>
            </div>
        );
    }

    const { league, participants } = data;

    // Dynamically adjust participants for the current live leaderboard view
    const displayParticipants = [...participants].sort((a, b) => b.total_points - a.total_points);

    const isParticipant = participants.some(p => p.user_id === user?.id);
    const bonusX = (league.scoring_rules as Record<string, number>)?.X || 1;

    // Installments mode helpers
    const isInstallmentsMode = league.scoring_rules?.payment_mode === 'installments';
    const tranches = ((league.scoring_rules?.payment_tranches as number[]) || [0, 0, 0, 0]);
    const myParticipant = participants.find(p => p.user_id === user?.id);
    const myInstallmentsPaid = myParticipant?.installments_paid ?? 1;
    const currentRoundNum = league.current_round + 1;

    const getPhaseForRound = (roundNum: number): number => {
        if (!tranches || tranches.length !== 4) return 1;
        const t1 = tranches[0] || 0;
        const t2 = tranches[1] || 0;
        const t3 = tranches[2] || 0;
        if (roundNum <= t1) return 1;
        if (roundNum <= t1 + t2) return 2;
        if (roundNum <= t1 + t2 + t3) return 3;
        return 4;
    };
    const currentPhase = getPhaseForRound(currentRoundNum);

    // Helper for pick count
    const filledPicksCount = myPicks.filter(p => p !== '').length;

    return (
        <div className="animate-fade-in max-w-7xl mx-auto pb-20 px-4 mt-4">
            {/* Minimalist Navigation */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#bfff00] transition-colors group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-black uppercase text-[10px] tracking-[0.2em] italic">Circuito Leghe</span>
                </button>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-[#bfff00]/10 border border-[#bfff00]/20 rounded-full">
                    <span className="text-[#bfff00] text-[9px] font-black uppercase tracking-widest">
                        Round {league.current_round + 1} / {league.duration_matchdays}
                    </span>
                </div>
            </div>

            {/* Compact Header Card */}
            <div className="glass-card card-lega-alieno card-scudetto-active p-8 md:p-12 border-none overflow-hidden relative mb-8">
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-1 bg-[#bfff00] rounded-full"></div>
                        <span className="text-gray-400 font-black uppercase text-[10px] tracking-[0.4em]">Campionato Ufficiale</span>
                        <div className="w-10 h-1 bg-[#bfff00] rounded-full"></div>
                    </div>

                    <h2 className="text-6xl md:text-[6.5rem] font-black italic text-white uppercase tracking-tighter mb-8 leading-none border-b-[10px] border-[#bfff00] pb-6 px-6 drop-shadow-2xl">
                        {league.name}
                    </h2>

                    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 mt-2">
                        <div className="flex flex-col items-center">
                            <span className="text-[#bfff00] font-black italic text-4xl md:text-6xl mb-1 drop-shadow-[0_0_15px_rgba(191,255,0,0.4)]">
                                {league.prize_pool} FTK
                            </span>
                            <span className="text-gray-500 text-[9px] font-black uppercase tracking-[0.3em]">Montepremi Totale</span>
                        </div>

                        <div className="w-16 h-px md:w-px md:h-16 bg-white/10"></div>

                        <div className="flex flex-col items-center">
                            <span className="text-white font-black italic text-3xl md:text-5xl mb-1">
                                {participants.length}
                            </span>
                            <span className="text-gray-500 text-[9px] font-black uppercase tracking-[0.3em]">Membri</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Installments Plan Card (if enabled) */}
            {isInstallmentsMode && isParticipant && (
                <div className="mb-6 p-6 rounded-3xl bg-[#111115] border border-white/10 overflow-hidden relative">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#5d8aa8]/20 border border-[#5d8aa8]/40 flex items-center justify-center text-[#5d8aa8]">
                                <CreditCard size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-white font-black italic uppercase text-sm tracking-wider">
                                        Piano Rate Campionato
                                    </h4>
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#5d8aa8]/20 text-[#5d8aa8] border border-[#5d8aa8]/30">
                                        4 Rate da {league.entry_fee} FTK
                                    </span>
                                </div>
                                <p className="text-gray-400 text-[10px] font-bold">
                                    Hai saldato <span className="text-white font-black">{myInstallmentsPaid} su 4</span> rate. Fase in corso: <span className="text-[#bfff00] font-black">Fase {currentPhase}</span>.
                                </p>
                            </div>
                        </div>

                        {myInstallmentsPaid < 4 && (
                            <button
                                onClick={handlePayInstallment}
                                disabled={payingInstallment}
                                className="px-5 py-2.5 bg-[#5d8aa8] hover:bg-[#6fa0c2] active:scale-95 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(93,138,168,0.3)] flex items-center gap-2 self-start md:self-auto disabled:opacity-50"
                            >
                                {payingInstallment ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <CreditCard size={14} />
                                )}
                                <span>Salda Rata {myInstallmentsPaid + 1} ({league.entry_fee} FTK)</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-white/5">
                        {([1, 2, 3, 4] as const).map(phaseNum => {
                            const isPaid = myInstallmentsPaid >= phaseNum;
                            const isCurrent = currentPhase === phaseNum;
                            let startR = 1;
                            for (let i = 0; i < phaseNum - 1; i++) startR += (tranches[i] || 0);
                            const endR = startR + (tranches[phaseNum - 1] || 0) - 1;

                            return (
                                <div
                                    key={phaseNum}
                                    className={`p-3 rounded-2xl border transition-all ${
                                        isPaid
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                            : isCurrent
                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                            : 'bg-white/[0.02] border-white/5 text-gray-500'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider">
                                            Fase {phaseNum}
                                        </span>
                                        {isPaid ? (
                                            <span className="text-[8px] font-black uppercase bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30">
                                                ✓ Saldata
                                            </span>
                                        ) : isCurrent ? (
                                            <span className="text-[8px] font-black uppercase bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                                                In Corso
                                            </span>
                                        ) : (
                                            <span className="text-[8px] font-black uppercase opacity-60">
                                                Rata {phaseNum}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[9px] font-bold text-gray-400">
                                        {tranches[phaseNum - 1] > 0 ? `GN ${startR}–${endR}` : '—'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 1. HORIZONTAL RULES BAR (Thin, under header) */}
            <button
                onClick={() => updateModal('RULES')}
                className="w-full mb-4 group flex items-center justify-between px-6 py-3 bg-[#111113] hover:bg-[#152415] border border-white/10 transition-all duration-300"
            >
                <div className="flex items-center gap-3">
                    <Info size={16} className="text-[#bfff00]" />
                    <span className="text-white font-black italic uppercase text-xs tracking-wider">Regolamento della Lega</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-[8px] font-black uppercase tracking-widest group-hover:text-gray-400 transition-colors">Vedi Dettagli</span>
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                </div>
            </button>

            {/* 2. MAIN ACTIONS GRID (3 Columns on Desktop) */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {/* LA SCHEDINA */}
                <button
                    onClick={() => updateModal('PREDICTIONS')}
                    className={`card-interstellar-action group relative h-56 md:h-72 p-5 md:p-8 transition-all duration-300 overflow-hidden text-left ${filledPicksCount === 10
                        ? 'border-[#bfff00]/30'
                        : 'border-white/5'
                        }`}
                >
                    <div className="technical-corner corner-tl"></div>
                    <div className="technical-corner corner-tr"></div>
                    <div className="technical-corner corner-bl"></div>
                    <div className="technical-corner corner-br"></div>

                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:opacity-20 transition-opacity">
                        <ClipboardCheck size={160} className="text-[#bfff00]" />
                    </div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 rounded-lg transition-colors bg-[#bfff00]/15">
                                <ClipboardCheck size={20} className="text-[#bfff00]" />
                            </div>
                            <div className="text-[10px] md:text-xs font-black text-white px-3 py-1 bg-black/60 rounded-full border border-white/10">
                                {filledPicksCount}/10
                            </div>
                        </div>
                        <div>
                            <h3 className="text-white font-black italic uppercase text-lg md:text-2xl leading-none mb-1">Schedina</h3>
                            <p className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest truncate">
                                {filledPicksCount === 10 ? 'Pronta!' : 'Inserisci segni'}
                            </p>
                        </div>
                    </div>
                </button>

                {/* CLASSIFICA */}
                <button
                    onClick={() => updateModal('LEADERBOARD')}
                    className="card-interstellar-action group relative h-56 md:h-72 p-5 md:p-8 transition-all duration-300 overflow-hidden text-left"
                >
                    <div className="technical-corner corner-tl"></div>
                    <div className="technical-corner corner-tr"></div>
                    <div className="technical-corner corner-bl"></div>
                    <div className="technical-corner corner-br"></div>

                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:opacity-20 transition-opacity">
                        <Trophy size={160} className="text-[#bfff00]" />
                    </div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-[#bfff00]/10 rounded-lg group-hover:bg-[#bfff00]/20 transition-colors">
                                <Trophy size={20} className="text-[#bfff00]" />
                            </div>
                            <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <h3 className="text-white font-black italic uppercase text-lg md:text-2xl leading-none mb-1">Classifica</h3>
                            <p className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest truncate">Vedi Distacchi</p>
                        </div>
                    </div>
                </button>

                {/* ARCHIVIO */}
                <button
                    onClick={() => updateModal('ARCHIVE_LIST')}
                    className="card-interstellar-action group relative h-48 md:h-60 p-5 md:p-8 transition-all duration-300 overflow-hidden text-left col-span-2 lg:col-span-1"
                >
                    <div className="technical-corner corner-tl"></div>
                    <div className="technical-corner corner-tr"></div>
                    <div className="technical-corner corner-bl"></div>
                    <div className="technical-corner corner-br"></div>

                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:opacity-20 transition-opacity">
                        <Lock size={160} className="text-[#bfff00]" />
                    </div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-[#bfff00]/10 rounded-lg group-hover:bg-[#bfff00]/20 transition-colors border border-[#bfff00]/30 shadow-[0_0_15px_rgba(191,255,0,0.2)]">
                                <Lock size={20} className="text-[#bfff00]" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[#bfff00] text-[10px] font-black uppercase tracking-tight">
                                    {archiveMatchdays.length}
                                </span>
                                <span className="text-[#bfff00] text-[9px] font-black uppercase tracking-widest opacity-80">
                                    giornate archiviate
                                </span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-white font-black italic uppercase text-lg md:text-2xl leading-none mb-1">Archivio</h3>
                            <p className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest truncate">Dati Storici</p>
                        </div>
                    </div>
                </button>
            </div>


            {/* MODALS */}

            {/* 1. LEADERBOARD MODAL (LIVE) */}
            <LeaderboardModal
                isOpen={activeModal === 'LEADERBOARD'}
                onClose={() => window.history.back()}
                participants={displayParticipants}
                currentUserId={user?.id}
                leagueId={league.id}
                matchday={matchday}
                title="Classifica Generale"
            />

            {/* 2. HISTORICAL LEADERBOARD MODAL */}
            {selectedHistoryMd && (
                <LeaderboardModal
                    isOpen={activeModal === 'HISTORICAL_LEADERBOARD'}
                    onClose={() => window.history.back()}
                    participants={historicalParticipants}
                    currentUserId={user?.id}
                    leagueId={league.id}
                    matchday={selectedHistoryMd.matchday}
                    title={`Classifica Giornata ${selectedHistoryMd.round}`}
                    showBackButton={true}
                />
            )}

            {/* 2. PREDICTIONS MODAL */}
            <PredictionsModal
                isOpen={activeModal === 'PREDICTIONS'}
                onClose={() => window.history.back()}
                matchday={matchday}
                myPicks={myPicks}
                secretMatchIndex={mySecretMatch}
                onPickChange={(idx, sign) => {
                    const newPicks = [...myPicks];
                    newPicks[idx] = sign;
                    setMyPicks(newPicks);
                }}
                onSecretMatchChange={(idx) => setMySecretMatch(idx)}
                onSave={handleSavePicks}
                saving={saving}
                installmentWarning={isInstallmentsMode && isParticipant ? {
                    requiredInstallment: currentPhase,
                    fee: league.entry_fee,
                    isPaid: myInstallmentsPaid >= currentPhase,
                    onPay: handlePayInstallment,
                    isPaying: payingInstallment
                } : undefined}
            />

            {/* 3. RULES MODAL */}
            <LeagueRulesModal
                isOpen={activeModal === 'RULES'}
                onClose={() => window.history.back()}
                bonusX={bonusX}
            />

            {/* 4. ARCHIVE LIST MODAL */}
            <LeagueArchiveModal
                isOpen={activeModal === 'ARCHIVE_LIST'}
                onClose={() => window.history.back()}
                matchdays={archiveMatchdays}
                onSelectMatchday={handleShowHistory}
            />

            {/* Footer Notice if not joined */}
            {!isParticipant && (
                <div className="mt-8 p-6 bg-[#5d8aa8]/10 border border-[#5d8aa8]/20 rounded-3xl text-center">
                    <p className="text-gray-400 font-black uppercase tracking-widest text-xs italic">
                        Devi essere iscritto per visualizzare i tuoi pronostici e scalare la classifica interstellare.
                    </p>
                </div>
            )}
        </div>
    );
};

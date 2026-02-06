import React, { useEffect, useState, useCallback } from 'react';
import { gameService } from '../services/gameService';
import type { Matchday, Bet, User, ViewMode } from '../types';
import { BettingInterface } from './BettingInterface';
import { FanniesView } from './FanniesView';
import { NavigationBar } from './NavigationBar';
import { LeaderboardView } from './LeaderboardView';
import { SurvivalView } from './SurvivalView';
import { BottomNavBar } from './BottomNavBar';
import { ProfileView } from './ProfileView';
import { RegulationsModal } from './RegulationsModal';
import { RequestTokensModal } from './RequestTokensModal';
import { Zap, Eye, Trophy, Skull, Swords } from 'lucide-react';
import { DuelArenaView } from './DuelArenaView';
import { DashboardSkeleton } from './skeletons/DashboardSkeleton';

interface UserDashboardProps {
    user: User | null;
    onBalanceUpdate?: () => void;
    onLogout?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, onBalanceUpdate, onLogout }) => {
    const [matchday, setMatchday] = useState<Matchday | null>(null);
    const [userBet, setUserBet] = useState<Bet | undefined>(undefined);
    const [view, setView] = useState<ViewMode>('HOME');
    const [survivalStatus, setSurvivalStatus] = useState<'ALIVE' | 'ELIMINATED' | 'WINNER' | null>(null);
    const [showProfile, setShowProfile] = useState(false);
    const [showRegulations, setShowRegulations] = useState(false);
    const [showRequestTokens, setShowRequestTokens] = useState(false);

    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const md = await gameService.getMatchday();
        setMatchday(md);
        if (user) {
            const bet = await gameService.getUserBet(user.username);
            setUserBet(bet);

            const { players } = await gameService.getSurvivalState();
            const me = players.find(p => p.username === user.username);
            if (me) setSurvivalStatus(me.status);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
    }, [loadData, view]); // Reload when view changes too (to refresh bets)

    useEffect(() => {
        // Reset classes
        document.body.classList.remove('gold-arena', 'bronze-arena');

        if (view === 'SPY') {
            document.body.classList.add('gold-arena');
        } else if (view === 'DUEL_ARENA') {
            document.body.classList.add('bronze-arena');
        }

        return () => document.body.classList.remove('gold-arena', 'bronze-arena');
    }, [view]);

    const handleBetPlaced = () => {
        loadData();
        if (onBalanceUpdate) onBalanceUpdate();
    };

    if (loading && view === 'HOME') {
        return <DashboardSkeleton />;
    }

    if (!matchday && view === 'BETTING') {
        return (
            <div className="text-center py-20 animate-fade-in">
                <h3 className="text-2xl font-bold text-white mb-2">NESSUNA GIORNATA ATTIVA</h3>
                <p className="text-gray-400">L'Admin sta preparando le nuove partite. Torna più tardi!</p>
                <button onClick={() => setView('HOME')} className="mt-6 text-brand-orange underline">Torna alla Home</button>
            </div>
        );
    }

    if (!matchday && view === 'SPY') {
        return (
            <div className="text-center py-20 animate-fade-in">
                <h3 className="text-2xl font-bold text-white mb-2">NESSUNA GIORNATA ATTIVA</h3>
                <p className="text-gray-400">Non ci sono ancora scommesse da spiare.</p>
                <button onClick={() => setView('HOME')} className="mt-6 text-brand-orange underline">Torna alla Home</button>
            </div>
        );
    }

    // Default loading only if loading initially? No, if no matchday, we render Home differently?
    // User dashboard stats need matchday...

    // Fallback for Stats Header if no matchday
    const jackpotDisplay = matchday ? matchday.superJackpot : 1000;
    const potDisplay = matchday ? matchday.currentPot : 0;

    return (
        <>
            {/* Nav & Modals */}
            {showProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-fade-in" onClick={() => setShowProfile(false)}></div>
                    <div className="w-full max-w-4xl relative z-10 animate-scale-in">
                        <ProfileView
                            user={user}
                            onClose={() => setShowProfile(false)}
                            onLogout={onLogout}
                            onProfileUpdate={onBalanceUpdate}
                        />
                    </div>
                </div>
            )}

            <RegulationsModal isOpen={showRegulations} onClose={() => setShowRegulations(false)} />
            <RequestTokensModal isOpen={showRequestTokens} onClose={() => setShowRequestTokens(false)} currentTokens={user?.tokens || 0} />

            <div className={`space-y-6 md:space-y-12 animate-fade-in no-scrollbar pb-24 md:pb-10`}>
                {/* Custom Image Background - HOME only */}
                {view === 'HOME' && (
                    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#050505]">
                        <div
                            className="absolute inset-0 opacity-50 bg-cover bg-center bg-no-repeat"
                            style={{ backgroundImage: `url('/fibra.jpg')` }}
                        ></div>

                        {/* Depth Layer: Vignette and Spotlight */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.03)_0%,transparent_70%)]"></div>

                        {/* Mesh Glow Lights */}
                        <div className="mesh-glow bg-brand-purple/10 -top-48 -left-48 animate-pulse-slow"></div>
                        <div className="mesh-glow bg-brand-orange/5 bottom-0 -right-48 animate-float"></div>
                    </div>
                )}
                {/* Requested Hero Section - ONLY ON HOME */}
                {view === 'HOME' && (
                    <div className="relative pt-[6.4rem] pb-6 md:pt-[7.2rem] md:pb-16 text-center animate-fade-in px-2">
                        <p className="text-white font-mono text-[8px] md:text-base uppercase tracking-[0.6em] mb-1 md:mb-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]">benvenuto su</p>
                        <h1 className="!text-[5.2rem] sm:!text-[9.1rem] md:!text-[19.5rem] font-display font-black italic tracking-tighter leading-[0.72] bg-gradient-to-br from-brand-teal via-brand-purple-vibrant to-brand-purple-vibrant bg-clip-text text-transparent drop-shadow-[0_0_120px_rgba(157,0,255,0.9)] transform-gpu scale-[1.02] md:scale-[1.05]">
                            FANNY<br className="md:hidden" /> BET
                        </h1>

                        <div className="mt-1 md:mt-8 flex justify-center gap-2">
                            <div className="h-[1px] w-6 md:w-20 bg-gradient-to-r from-transparent via-brand-teal/50 to-transparent"></div>
                            <div className="h-[1px] w-6 md:w-20 bg-gradient-to-r from-transparent via-brand-purple-vibrant/50 to-transparent"></div>
                        </div>
                    </div>
                )}

                {/* View titles for other pages */}
                {view !== 'HOME' && (
                    <div className="py-4 md:py-12 text-center animate-fade-in px-2">
                        <h1 className="text-2xl sm:text-4xl md:text-8xl font-display font-black italic tracking-tighter uppercase text-white/90 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                            {view === 'BETTING' && '1X2 MODE'}
                            {view === 'SPY' && 'I FANNIES'}
                            {view === 'LEADERBOARD' && 'CLASSIFICHE'}
                            {view === 'SURVIVAL' && 'SURVIVAL MODE'}
                            {view === 'DUEL_ARENA' && 'SFIDE'}
                        </h1>
                    </div>
                )}

                {/* Optimized Stats (Affiancate su mobile) - ONLY ON HOME */}
                {view === 'HOME' && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-12 px-2 md:px-0 max-w-5xl mx-auto items-stretch">
                            {/* MONTEPREMI CARD */}
                            <div className="card-perforated border-gold-real !py-4 md:!py-8 px-2 md:px-12 text-center group transition-all duration-500 hover:scale-105 shadow-[0_0_48px_rgba(255,204,0,0.25)] hover:shadow-[0_0_80px_rgba(255,204,0,0.5)] flex flex-col justify-center">
                                <span className="text-brand-gold text-[10px] md:text-[16px] tracking-[0.6em] font-black uppercase mb-1 block opacity-95 relative z-10">MONTE PREMI</span>
                                <div className="text-4xl md:text-7xl font-display font-black text-brand-gold drop-shadow-[0_0_28px_rgba(255,204,0,0.7)] relative z-10 font-digital">
                                    {potDisplay}<span className="text-[12px] md:text-2xl opacity-40 ml-1 font-mono">FTK</span>
                                </div>
                            </div>

                            {/* SUPER JACKPOT CARD */}
                            <div className="card-perforated card-neon-animated !py-4 md:!py-8 px-2 md:px-12 text-center group transition-all duration-500 hover:scale-105 flex flex-col justify-center">
                                <span className="text-white text-[9px] md:text-[14px] tracking-[0.6em] font-black uppercase mb-1 block opacity-70 relative z-10">SUPER JACKPOT</span>
                                <div className="text-3xl md:text-6xl font-display font-black text-cyan-400 drop-shadow-[0_0_25px_rgba(0,255,255,0.7)] relative z-10 font-digital">
                                    {jackpotDisplay}<span className="text-[11px] md:text-2xl opacity-70 text-cyan-200 ml-1 font-mono">FTK</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {view !== 'HOME' && (
                    <div className="flex justify-center sticky top-12 md:top-6 z-20 px-2 md:px-4">
                        <div className="liquid-glass !p-1 md:!p-1.5 !rounded-full inline-block backdrop-blur-[40px] border-white/10 shadow-3xl">
                            <NavigationBar
                                currentView={view}
                                onNavigate={(v) => {
                                    if (v === 'PROFILE') {
                                        setShowProfile(true);
                                    } else {
                                        setView(v);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Navigation Cards - Redesigned Asymmetric Grid */}
                {view === 'HOME' && (
                    <div className="grid grid-cols-4 gap-3 md:gap-8 animate-fade-in px-2 md:px-0 pb-16 items-start">
                        {/* 1x2 MODE (LEFT LONG) */}
                        <button
                            onClick={() => setView('BETTING')}
                            className="glass-card card-acid-green col-span-2 row-span-2 group h-[26rem] sm:h-[45rem] md:h-[62rem] flex flex-col justify-center items-center text-center relative overflow-hidden touch-target animate-float-slow hover:rotate-1 w-full"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#bfff00]/5 blur-[60px] rounded-full group-hover:bg-[#bfff00]/10 transition-all duration-700"></div>
                            <div className="mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Zap size={40} className="text-acid-glow md:w-20 md:h-20" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-sm sm:text-2xl md:text-5xl font-black italic tracking-tighter text-white/90 uppercase">1x2 Mode</h3>
                            <p className="text-gray-600 text-[7px] sm:text-xs md:text-sm mt-1 uppercase tracking-[0.2em] font-black group-hover:text-[#bfff00] transition-colors">Gioca ora.</p>
                        </button>

                        {/* SURVIVAL MODE (TOP RIGHT) */}
                        <button
                            onClick={() => setView('SURVIVAL')}
                            className="glass-card card-bright-red col-span-2 group h-[13.5rem] sm:h-[24rem] md:h-[34rem] flex flex-col justify-center items-center text-center relative overflow-hidden touch-target animate-float [animation-delay:1s] hover:-rotate-1 w-full"
                        >
                            {survivalStatus === 'ALIVE' && (
                                <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-red-500 text-black text-[8px] font-black animate-pulse">
                                    IN VITA
                                </div>
                            )}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ff2200]/5 blur-[60px] rounded-full group-hover:bg-[#ff2200]/10 transition-all duration-700"></div>
                            <div className="mb-1 md:mb-4 group-hover:scale-110 transition-transform duration-500">
                                <Skull size={32} className="text-[#ff2200] md:w-16 md:h-16" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-[12px] sm:text-xl md:text-3xl font-black italic tracking-tighter text-white/90 uppercase">Survival</h3>
                            <p className="text-gray-600 text-[6px] sm:text-[9px] md:text-xs mt-0.5 uppercase tracking-[0.2em] font-black group-hover:text-[#ff2200] transition-colors">entra nell'arena.</p>
                        </button>

                        {/* I FANNIES (MID RIGHT LEFT) */}
                        <button
                            onClick={() => setView('SPY')}
                            className="glass-card card-bright-yellow col-span-1 group h-[11.5rem] sm:h-[20rem] md:h-[26rem] flex flex-col justify-center items-center text-center relative overflow-hidden touch-target animate-float-fast [animation-delay:0.5s] hover:rotate-1 w-full"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ffee00]/5 blur-[60px] rounded-full group-hover:bg-[#ffee00]/10 transition-all duration-700"></div>
                            <div className="mb-0.5 md:mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Eye size={24} className="text-[#ffee00] md:w-12 md:h-12" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-[10px] sm:text-base md:text-xl font-black italic tracking-tighter text-white/90 uppercase">Fannies</h3>
                        </button>

                        {/* CLASSIFICHE (MID RIGHT RIGHT) */}
                        <button
                            onClick={() => setView('LEADERBOARD')}
                            className="glass-card card-vibrant-purple border-brand-purple/50 col-span-1 group h-[11.5rem] sm:h-[20rem] md:h-[26rem] flex flex-col justify-center items-center text-center relative overflow-hidden touch-target animate-float-slow [animation-delay:0.8s] hover:-rotate-1 w-full shadow-[0_0_20px_rgba(157,0,255,0.2)] hover:shadow-[0_0_40px_rgba(157,0,255,0.4)] transition-all"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#9d00ff]/5 blur-[60px] rounded-full group-hover:bg-[#9d00ff]/10 transition-all duration-700"></div>
                            <div className="mb-0.5 md:mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Trophy size={24} className="text-brand-purple-vibrant md:w-12 md:h-12" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-[10px] sm:text-base md:text-xl font-black italic tracking-tighter text-white/90 uppercase">Classifica</h3>
                        </button>

                        {/* ARENA DELLE SFIDE (BOTTOM FULL WIDTH) */}
                        <div className="col-span-4">
                            <button
                                onClick={() => setView('DUEL_ARENA')}
                                className="glass-card card-bronze group h-[11.5rem] sm:h-[20rem] md:h-[34rem] flex flex-col justify-center items-center text-center relative overflow-hidden touch-target animate-float [animation-delay:1.5s] hover:scale-[1.01] w-full"
                            >
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#b45309]/5 blur-[60px] rounded-full group-hover:bg-[#b45309]/10 transition-all duration-700"></div>
                                <div className="mb-1 md:mb-4 group-hover:rotate-12 transition-transform duration-500">
                                    <Swords size={32} className="text-[#b45309] md:w-16 md:h-16" strokeWidth={2.5} />
                                </div>
                                <h3 className="text-[12px] sm:text-xl md:text-3xl font-black italic tracking-tighter text-white/90 uppercase">Sfide</h3>
                                <p className="text-gray-600 text-[6px] sm:text-[9px] md:text-xs mt-0.5 uppercase tracking-[0.2em] font-black group-hover:text-[#b45309] transition-colors">duello 1vs1.</p>
                            </button>
                        </div>
                    </div>
                )}

                {/* Sub-views */}
                {view === 'BETTING' && matchday && (
                    <div className="relative animate-fade-in">
                        <BettingInterface
                            matchday={matchday}
                            userBet={userBet}
                            user={user}
                            onBetPlaced={handleBetPlaced}
                            onViewChange={setView}
                        />
                    </div>
                )}

                {view === 'SPY' && matchday && (
                    <div className="relative animate-fade-in">
                        <FanniesView matchday={matchday} />
                    </div>
                )}

                {view === 'LEADERBOARD' && (
                    <div className="relative animate-fade-in">
                        <LeaderboardView matchday={matchday} />
                    </div>
                )}

                {view === 'SURVIVAL' && (
                    <div className="relative animate-fade-in">
                        <SurvivalView
                            user={user}
                            activeMatchday={matchday}
                            onBack={() => setView('HOME')}
                            onBalanceUpdate={() => { if (onBalanceUpdate) onBalanceUpdate(); loadData(); }}
                        />
                    </div>
                )}

                {view === 'DUEL_ARENA' && (
                    <div className="relative animate-fade-in">
                        <DuelArenaView />
                    </div>
                )}

                <div className="fixed bottom-1 right-1 text-[8px] font-mono text-white/10 select-none pointer-events-none z-[1000]">
                    v2026.02.06.1612
                </div>
            </div>

            {/* Bottom Navigation Bar - HOME view only */}
            {view === 'HOME' && (
                <BottomNavBar
                    onRegulations={() => setShowRegulations(true)}
                    onRequestTokens={() => setShowRequestTokens(true)}
                    onProfile={() => setShowProfile(true)}
                />
            )}
        </>
    );
};

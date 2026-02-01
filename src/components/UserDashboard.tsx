import React, { useEffect, useState } from 'react';
import { gameService } from '../services/gameService';
import type { Matchday, Bet, User, ViewMode } from '../types';
import { BettingInterface } from './BettingInterface';
import { FanniesView } from './FanniesView';
import { NavigationBar } from './NavigationBar';
import { LeaderboardView } from './LeaderboardView';
import { SurvivalView } from './SurvivalView';
import { DuelArenaView } from './DuelArenaView';
import { BottomNavBar } from './BottomNavBar';
import { ProfileView } from './ProfileView';
import { RegulationsModal } from './RegulationsModal';
import { RequestTokensModal } from './RequestTokensModal';
import { HomeCardsGrid } from './cards/HomeCardsGrid';
import fibraImg from '../assets/fibra.jpg';

interface UserDashboardProps {
    user: User | null;
    onBalanceUpdate?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, onBalanceUpdate }) => {
    const [matchday, setMatchday] = useState<Matchday | null>(null);
    const [userBet, setUserBet] = useState<Bet | undefined>(undefined);
    const [view, setView] = useState<ViewMode>('HOME');
    const [survivalStatus, setSurvivalStatus] = useState<'ALIVE' | 'ELIMINATED' | 'WINNER' | null>(null);
    const [showProfile, setShowProfile] = useState(false);
    const [showRegulations, setShowRegulations] = useState(false);
    const [showRequestTokens, setShowRequestTokens] = useState(false);

    const loadData = async () => {
        const md = await gameService.getMatchday();
        setMatchday(md);
        if (user) {
            const bet = await gameService.getUserBet(user.username);
            setUserBet(bet);

            const { players } = await gameService.getSurvivalState();
            const me = players.find(p => p.username === user.username);
            if (me) setSurvivalStatus(me.status);
        }
    };

    useEffect(() => {
        loadData();
    }, [user, view]); // Reload when view changes too (to refresh bets)

    useEffect(() => {
        if (view === 'SPY') {
            document.body.classList.add('gold-arena');
        } else {
            document.body.classList.remove('gold-arena');
        }
        return () => document.body.classList.remove('gold-arena');
    }, [view]);

    const handleBetPlaced = () => {
        loadData();
        if (onBalanceUpdate) onBalanceUpdate();
    };

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
    const potDisplay = matchday ? matchday.currentPot : 0; // Or fetch rollover?

    // We can just proceed, but handle stats carefully

    return (
        <>
            {showProfile && (
                <div className="fixed inset-0 z-45 overflow-y-auto">
                    <div className="min-h-screen flex items-start justify-center pt-8 pb-24">
                        <ProfileView user={user} onClose={() => setShowProfile(false)} />
                    </div>
                </div>
            )}

            <RegulationsModal isOpen={showRegulations} onClose={() => setShowRegulations(false)} />
            <RequestTokensModal isOpen={showRequestTokens} onClose={() => setShowRequestTokens(false)} currentTokens={user?.tokens || 0} />

            <div className={`space-y-6 md:space-y-12 animate-fade-in no-scrollbar pb-24 md:pb-10`}>
                {/* 3D Carbon Fiber Background - HOME only */}
                {view === 'HOME' && (
                    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
                        {/* Fiber Background (imported and bundled) */}
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${fibraImg})` }}
                        />

                        {/* Dark overlay to make background darker */}
                        <div className="absolute inset-0 bg-black/60 mix-blend-multiply pointer-events-none"></div>

                        {/* Depth Layer: Vignette and Spotlight (kept) */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.02)_0%,transparent_70%)]"></div>

                        {/* Mesh Glow Lights */}
                        <div className="mesh-glow bg-brand-purple/10 -top-48 -left-48 animate-pulse-slow"></div>
                        <div className="mesh-glow bg-brand-orange/5 bottom-0 -right-48 animate-float"></div>
                    </div>
                )}
                {/* Requested Hero Section - ONLY ON HOME */}
                {view === 'HOME' && (
                    <div className="relative py-4 md:py-16 text-center animate-fade-in px-2">
                        <p className="text-gray-500 font-mono text-[8px] md:text-sm uppercase tracking-[0.4em] mb-1 md:mb-2 opacity-60">benvenuto su</p>
                        <h1 className="text-4xl sm:text-6xl md:text-[11rem] font-display font-black italic tracking-tighter leading-[0.85] bg-gradient-to-br from-brand-teal via-brand-purple-vibrant to-brand-purple-vibrant bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(157,0,255,0.5)]">
                            FANNY<br className="md:hidden" /> BET
                        </h1>

                        <div className="mt-2 md:mt-8 flex justify-center gap-2">
                            <div className="h-[1px] w-6 md:w-20 bg-gradient-to-r from-transparent via-brand-teal/50 to-transparent"></div>
                            <div className="h-[1px] w-6 md:w-20 bg-gradient-to-r from-transparent via-brand-purple-vibrant/50 to-transparent"></div>
                        </div>
                    </div>
                )}

                {/* View titles for other pages */}
                {view !== 'HOME' && (
                    <div className="py-4 md:py-12 text-center animate-fade-in px-2">
                        <h1 className="text-2xl sm:text-4xl md:text-8xl font-display font-black italic tracking-tighter uppercase text-white/90 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                            {view === 'BETTING' && '1X2 ARENA'}
                            {view === 'SPY' && 'EYE OF THE SPY'}
                            {view === 'LEADERBOARD' && 'RANKINGS'}
                            {view === 'SURVIVAL' && 'SURVIVAL MODE'}
                        </h1>
                    </div>
                )}

                {/* Optimized Stats (Affiancate su mobile) - ONLY ON HOME */}
                {view === 'HOME' && (
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-12 px-2 md:px-0 max-w-5xl mx-auto">
                        <div className="glass-card card-gold !py-2 md:!py-4 px-3 md:px-12 text-center relative overflow-hidden group shadow-[0_0_40px_rgba(255,204,0,0.2)] hover:shadow-[0_0_60px_rgba(255,204,0,0.4)] transition-all duration-500 hover:scale-105">
                            <span className="text-brand-gold text-[8px] md:text-[12px] tracking-[0.6em] font-black uppercase mb-1 block opacity-90">MONTE PREMI</span>
                            <div className="text-2xl md:text-5xl font-mono font-black text-brand-gold drop-shadow-[0_0_20px_rgba(255,204,0,0.6)]">
                                {potDisplay}<span className="text-[8px] md:text-lg opacity-40 ml-1">FTK</span>
                            </div>
                        </div>

                        <div className="glass-card card-diamond !py-2 md:!py-4 px-3 md:px-12 text-center relative overflow-hidden group shadow-[0_0_40px_rgba(185,242,255,0.2)] hover:shadow-[0_0_60px_rgba(185,242,255,0.4)] transition-all duration-500 hover:scale-105 bg-gradient-to-br from-brand-diamond/10 via-white/[0.01] to-brand-diamond/5 backdrop-blur-xl">
                            {/* Diamante sparkle effects */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-brand-diamond/[0.2] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                            <span className="text-brand-diamond text-[8px] md:text-[12px] tracking-[0.6em] font-black uppercase mb-1 block opacity-90 relative z-10">SUPER JACKPOT</span>
                            <div className="text-2xl md:text-5xl font-mono font-black text-brand-diamond drop-shadow-[0_0_25px_rgba(185,242,255,0.7)] relative z-10 animate-pulse-jackpot">
                                {jackpotDisplay}<span className="text-[8px] md:text-lg opacity-50 ml-1">FTK</span>
                            </div>
                        </div>
                    </div>
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

                {/* Navigation Cards */}
                {view === 'HOME' && (
                    <HomeCardsGrid setView={setView} survivalStatus={survivalStatus} />
                )}

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

import React, { useEffect, useState } from 'react';
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
                <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/90 backdrop-blur-sm">
                    <div className="min-h-screen flex items-start justify-center pt-24 pb-24">
                        <ProfileView user={user} onClose={() => setShowProfile(false)} onLogout={onLogout} />
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
                    <div className="relative py-2 md:py-16 text-center animate-fade-in px-2">
                        <p className="text-gray-500 font-mono text-[7px] md:text-sm uppercase tracking-[0.4em] mb-0.5 md:mb-2 opacity-60">benvenuto su</p>
                        <h1 className="text-4xl sm:text-6xl md:text-[11rem] font-display font-black italic tracking-tighter leading-[0.8] bg-gradient-to-br from-brand-teal via-brand-purple-vibrant to-brand-purple-vibrant bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(157,0,255,0.5)]">
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
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-12 px-2 md:px-0 max-w-5xl mx-auto">
                        <div className="glass-card card-gold !py-1.5 md:!py-4 px-2 md:px-12 text-center relative overflow-hidden group shadow-[0_0_40px_rgba(255,204,0,0.2)] hover:shadow-[0_0_60px_rgba(255,204,0,0.4)] transition-all duration-500 hover:scale-105">
                            <span className="text-brand-gold text-[7px] md:text-[12px] tracking-[0.6em] font-black uppercase mb-0.5 block opacity-90">MONTE PREMI</span>
                            <div className="text-xl md:text-5xl font-mono font-black text-brand-gold drop-shadow-[0_0_20px_rgba(255,204,0,0.6)]">
                                {potDisplay}<span className="text-[7px] md:text-lg opacity-40 ml-1">FTK</span>
                            </div>
                        </div>

                        <div className="glass-card card-diamond !py-1.5 md:!py-4 px-2 md:px-12 text-center relative overflow-hidden group shadow-[0_0_40px_rgba(185,242,255,0.2)] hover:shadow-[0_0_60px_rgba(185,242,255,0.4)] transition-all duration-500 hover:scale-105">
                            {/* Diamond Facet sparkle effects handled by CSS after */}
                            <span className="text-white text-[7px] md:text-[12px] tracking-[0.6em] font-black uppercase mb-0.5 block opacity-70 relative z-10">SUPER JACKPOT</span>
                            <div className="text-xl md:text-5xl font-mono font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] relative z-10">
                                {jackpotDisplay}<span className="text-[7px] md:text-lg opacity-50 ml-1">FTK</span>
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
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-6 animate-fade-in px-1 md:px-0 pb-10">
                        <button
                            onClick={() => setView('BETTING')}
                            className="glass-card card-acid-green group h-32 sm:h-64 md:h-96 flex flex-col justify-center items-center text-center relative overflow-hidden touch-target"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#bfff00]/5 blur-[60px] rounded-full group-hover:bg-[#bfff00]/10 transition-all duration-700"></div>
                            <div className="mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Zap size={32} className="text-acid-glow md:w-12 md:h-12" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-[10px] sm:text-base md:text-xl font-black italic tracking-tighter text-white/90 uppercase">1x2 Mode</h3>
                            <p className="text-gray-600 text-[5px] sm:text-[7px] md:text-[9px] mt-0.5 uppercase tracking-[0.2em] font-black group-hover:text-[#bfff00] transition-colors">Gioca.</p>
                        </button>

                        <button
                            onClick={() => setView('SPY')}
                            className="glass-card card-bright-yellow group h-32 sm:h-64 md:h-96 flex flex-col justify-center items-center text-center relative overflow-hidden touch-target"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ffee00]/5 blur-[60px] rounded-full group-hover:bg-[#ffee00]/10 transition-all duration-700"></div>
                            <div className="mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Eye size={32} className="text-[#ffee00] md:w-12 md:h-12" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-[10px] sm:text-base md:text-xl font-black italic tracking-tighter text-white/90 uppercase">I fannies</h3>
                            <p className="text-gray-600 text-[5px] sm:text-[7px] md:text-[9px] mt-0.5 uppercase tracking-[0.2em] font-black group-hover:text-[#ffee00] transition-colors">esplora.</p>
                        </button>

                        <button
                            onClick={() => setView('LEADERBOARD')}
                            className="glass-card card-purple group h-32 sm:h-64 md:h-96 flex flex-col justify-center items-center text-center relative overflow-hidden touch-target"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#9d00ff]/5 blur-[60px] rounded-full group-hover:bg-[#9d00ff]/10 transition-all duration-700"></div>
                            <div className="mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Trophy size={32} className="text-brand-purple md:w-12 md:h-12" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-[10px] sm:text-base md:text-xl font-black italic tracking-tighter text-white/90 uppercase">Classifiche</h3>
                            <p className="text-gray-600 text-[5px] sm:text-[7px] md:text-[9px] mt-0.5 uppercase tracking-[0.2em] font-black group-hover:text-[#9d00ff] transition-colors">controlla.</p>
                        </button>

                        <button
                            onClick={() => setView('SURVIVAL')}
                            className="glass-card card-bright-red group h-32 sm:h-64 md:h-96 flex flex-col justify-center items-center text-center relative overflow-hidden touch-target"
                        >
                            {survivalStatus === 'ALIVE' && (
                                <div className="absolute top-1 right-1 z-10 px-1 py-0.5 rounded bg-red-500 text-black text-[5px] font-black animate-pulse">
                                    IN VITA
                                </div>
                            )}
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ff2200]/5 blur-[60px] rounded-full group-hover:bg-[#ff2200]/10 transition-all duration-700"></div>
                            <div className="mb-1 md:mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Skull size={32} className="text-[#ff2200] md:w-12 md:h-12" strokeWidth={2.5} />
                            </div>
                            <h3 className="text-[10px] sm:text-base md:text-xl font-black italic tracking-tighter text-white/90 uppercase">Survival mode</h3>
                            <p className="text-gray-600 text-[5px] sm:text-[7px] md:text-[9px] mt-0.5 uppercase tracking-[0.2em] font-black group-hover:text-[#ff2200] transition-colors">entra nell'arena.</p>
                        </button>

                        <button
                            onClick={() => setView('DUEL_ARENA')}
                            className="glass-card card-bronze col-span-2 lg:col-span-1 group h-24 sm:h-64 md:h-96 flex flex-row lg:flex-col justify-center items-center text-center relative overflow-hidden touch-target"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#b45309]/5 blur-[60px] rounded-full group-hover:bg-[#b45309]/10 transition-all duration-700"></div>
                            <div className="mr-4 lg:mr-0 lg:mb-2 group-hover:scale-110 transition-transform duration-500">
                                <Swords size={32} className="text-[#b45309] md:w-12 md:h-12" strokeWidth={2.5} />
                            </div>
                            <div className="text-left lg:text-center">
                                <h3 className="text-sm sm:text-base md:text-xl font-black italic tracking-tighter text-white/90 uppercase">Sfide</h3>
                                <p className="text-gray-600 text-[6px] sm:text-[7px] md:text-[9px] mt-0.5 uppercase tracking-[0.2em] font-black group-hover:text-[#b45309] transition-colors">sfida tutti.</p>
                            </div>
                        </button>
                    </div>
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

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
import { Zap, Eye, Trophy, Skull, Shield } from 'lucide-react';
import { FBLegaView } from './FBLegaView';
import { CardGallery } from './CardGallery';
import { WorldCupView } from './WorldCupView';
import { DashboardSkeleton } from './skeletons/DashboardSkeleton';
import { ErrorBoundary } from './ErrorBoundary';

const SectionHeader: React.FC<{ title: string; subtitle?: string; color?: string }> = ({ title, subtitle, color = "border-white/10" }) => (
    <div className={`flex flex-col mb-4 md:mb-8 border-l-4 ${color} pl-4 md:pl-6 py-1 md:py-2`}>
        <div className="flex items-center gap-3">
            <h2 className="text-xl md:text-4xl font-black italic tracking-tighter text-white/90 uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                {title}
            </h2>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
        </div>
        {subtitle && (
            <p className="text-[9px] md:text-sm font-black uppercase tracking-[0.3em] text-gray-500 mt-1">
                {subtitle}
            </p>
        )}
    </div>
);

interface UserDashboardProps {
    user: User | null;
    onBalanceUpdate?: () => void;
    onLogout?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, onBalanceUpdate, onLogout }) => {
    const [matchday, setMatchday] = useState<Matchday | null>(null);
    const [userBets, setUserBets] = useState<Bet[]>([]);
    const [view, setView] = useState<ViewMode>('HOME');
    const [survivalStatus, setSurvivalStatus] = useState<'ALIVE' | 'ELIMINATED' | 'WINNER' | null>(null);
    const [isSurvivalOpen, setIsSurvivalOpen] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showRegulations, setShowRegulations] = useState(false);
    const [showRequestTokens, setShowRequestTokens] = useState(false);
    const [showWorldCupRules, setShowWorldCupRules] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isExploding, setIsExploding] = useState(false);

    // Per riattivare la modalità Mondiali in dashboard, impostare questa costante a true
    const showWorldCup = false;

    const loadData = useCallback(async () => {
        setLoading(true);
        const md = await gameService.getMatchday();
        setMatchday(md);
        if (user) {
            const bets = await gameService.getUserBets(user.username);
            setUserBets(bets);

            const { season, players } = await gameService.getSurvivalState();
            const me = players.find(p =>
                (p.userId && user.id && p.userId.toString().toLowerCase() === user.id.toString().toLowerCase()) ||
                (p.username && user.username && p.username.toLowerCase() === user.username.toLowerCase())
            );
            if (me) setSurvivalStatus(me.status);

            // Check if registrations are open
            if (season && season.status === 'OPEN') {
                const deadline = season.startMatchdayDeadline ? new Date(season.startMatchdayDeadline) : null;
                setIsSurvivalOpen(!deadline || new Date() < deadline);
            } else {
                setIsSurvivalOpen(false);
            }
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        document.body.classList.remove('gold-arena', 'bronze-arena', 'lega-arena', 'world-cup-arena');
        if (view === 'SPY') {
            document.body.classList.add('gold-arena');
        } else if (view === 'FB_LEGA') {
            document.body.classList.add('lega-arena');
        } else if (view === 'WORLD_CUP') {
            document.body.classList.add('world-cup-arena');
        }
        return () => document.body.classList.remove('gold-arena', 'bronze-arena', 'lega-arena', 'world-cup-arena');
    }, [view]);

    const handleBetPlaced = () => {
        loadData();
        if (onBalanceUpdate) onBalanceUpdate();
    };

    if (loading && view === 'HOME') {
        return <DashboardSkeleton />;
    }

    if (!matchday && (view === 'BETTING' || view === 'SPY')) {
        return (
            <div className="text-center py-20 animate-fade-in">
                <h3 className="text-2xl font-bold text-white mb-2">NESSUNA GIORNATA ATTIVA</h3>
                <p className="text-gray-400">
                    {view === 'BETTING' ? "L'Admin sta preparando le nuove partite. Torna più tardi!" : "Don't have any bets to spy yet."}
                </p>
                <button onClick={() => setView('HOME')} className="mt-6 text-brand-orange underline">Torna alla Home</button>
            </div>
        );
    }

    const jackpotDisplay = matchday ? matchday.superJackpot : 0;
    const potDisplay = matchday ? matchday.currentPot : 0;

    return (
        <>
            <div className="noise-overlay"></div>
            {showProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-fade-in" onClick={() => setShowProfile(false)}></div>
                    <div className="w-full max-w-4xl relative z-10 animate-scale-in max-h-[90vh] overflow-y-auto no-scrollbar rounded-2xl">
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
            {showWorldCupRules && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowWorldCupRules(false)}></div>
                    <div className="relative z-10 w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#05070d]/95 p-6 shadow-[0_0_80px_rgba(0,0,0,0.75)]">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-300">Regolamento Mondiali</p>
                                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">Mondiali 2026</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowWorldCupRules(false)}
                                className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:border-white/20 hover:bg-white/10"
                            >Chiudi</button>
                        </div>
                        <div className="space-y-4 text-sm text-gray-300 leading-7">
                            <p className="text-gray-200">Questa modalità Mondiali è pensata per utenti reali e si attiva solo quando l'Admin decide di far partire il torneo.</p>
                            <ul className="space-y-3 pl-5 list-disc text-gray-300">
                                <li><span className="font-semibold text-white">Iscrizione:</span> gli utenti reali si registrano cliccando su <span className="text-cyan-300">Partecipa al Mondiale</span> e vengono salvati nel gruppo di attesa.</li>
                                <li><span className="font-semibold text-white">Avvio torneo:</span> l'Admin genera i gironi con i partecipanti reali e aggiunge bot solo se necessario per completare i gruppi da 4.</li>
                                <li><span className="font-semibold text-white">Gironi e clash:</span> i partecipanti vengono distribuiti in gruppi e giocano una serie di matchday predefiniti.</li>
                                <li><span className="font-semibold text-white">Pronostici:</span> per ogni giornata scegli la tua schedina e assegna un <span className="text-cyan-300">jolly</span> a una partita importante.</li>
                                <li><span className="font-semibold text-white">Risoluzione:</span> l'Admin inserisce i risultati reali, risolve la giornata e aggiorna la classifica interna.</li>
                                <li><span className="font-semibold text-white">Nota:</span> finché il torneo non è avviato, la modalità resta in attesa; quando i Mondiali saranno pronti verrà attivata dal team.</li>
                            </ul>
                            <p className="text-gray-400">Questa card apre il regolamento rapido, ma il flusso rimane gestito dall'Admin per l'avvio effettivo del torneo.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`space-y-6 md:space-y-12 animate-fade-in no-scrollbar pb-24 md:pb-10`}>
                {/* Fallback to global body background with minimal embossed neon blue style */}

                {view === 'FB_LEGA' && (
                    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#020508]">
                        <div
                            className="absolute -inset-[10%] opacity-[0.55] bg-cover bg-center bg-no-repeat scale-[0.8]"
                            style={{ backgroundImage: `url('/lega_bg.png')` }}
                        ></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a25]/60 via-transparent to-[#020508]/90"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,5,8,0.85)_100%)]"></div>
                        <div className="mesh-glow bg-[#5d8aa8]/25 -top-48 -right-48 animate-pulse-slow"></div>
                        <div className="mesh-glow bg-[#00ffaa]/5 bottom-0 -left-48 animate-float-slow"></div>
                    </div>
                )}



                {view === 'HOME' && (
                    <div className="relative pt-[6.4rem] pb-6 md:pt-[7.2rem] md:pb-16 text-center animate-fade-in px-2">
                        <p className="text-white font-mono text-[8px] md:text-base uppercase tracking-[0.6em] mb-1 md:mb-3 opacity-60">benvenuto su</p>
                        <h1 className="!text-[4.94rem] sm:!text-[8.65rem] md:!text-[18.5rem] font-display font-black italic tracking-tighter leading-[0.72] bg-gradient-to-br from-brand-teal via-brand-purple-vibrant to-brand-purple-vibrant bg-clip-text text-transparent drop-shadow-[0_0_120px_rgba(157,0,255,0.5)] transform-gpu scale-[1.02] md:scale-[1.05] relative">
                            FANNY<br className="md:hidden" /> BET
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] translate-x-[-200%] animate-shimmer pointer-events-none opacity-30"></div>
                        </h1>
                        <div className="mt-1 md:mt-8 flex justify-center gap-2">
                            <div className="h-[1px] w-6 md:w-20 bg-gradient-to-r from-transparent via-brand-teal/50 to-transparent"></div>
                            <div className="h-[1px] w-6 md:w-20 bg-gradient-to-r from-transparent via-brand-purple-vibrant/50 to-transparent"></div>
                        </div>
                    </div>
                )}

                {view !== 'HOME' && (
                    <div className="py-4 md:py-12 text-center animate-fade-in px-2">
                        <h1 className="text-2xl sm:text-4xl md:text-8xl font-display font-black italic tracking-tighter uppercase text-white/90 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                            {view === 'BETTING' && '1X2 MODE'}
                            {view === 'SPY' && 'I FANNIES'}
                            {view === 'LEADERBOARD' && 'CLASSIFICHE'}
                            {view === 'SURVIVAL' && 'SURVIVAL MODE'}
                            {view === 'FB_LEGA' && 'FB LEGA'}
                            {view === 'WORLD_CUP' && 'WORLD CUP'}
                            {view === 'CARDS' && 'ARCHIVIO CARD'}
                        </h1>
                    </div>
                )}

                {view !== 'HOME' && (
                    <div className="flex justify-center sticky top-10 md:top-6 z-20 px-2 md:px-4">
                        <div className="liquid-glass !p-0.5 md:!p-1.5 !rounded-full inline-block backdrop-blur-[40px] border-white/10 shadow-3xl">
                            <NavigationBar
                                currentView={view}
                                onNavigate={(v) => {
                                    if (v === 'PROFILE') setShowProfile(true);
                                    else setView(v);
                                }}
                                isAdmin={user?.role === 'ADMIN'}
                            />
                        </div>
                    </div>
                )}

                {view === 'HOME' && (
                    <div className="max-w-5xl mx-auto w-full px-2 space-y-8 md:space-y-16">
                        {/* SECTION 1: EVENTI SPECIALI - visible to all users */}
                        {showWorldCup && (
                            <div className="space-y-6">
                                <SectionHeader title="EVENTI SPECIALI" subtitle="Tornei Internazionali" color="border-white/30" />
                                <div className="grid grid-cols-4 gap-3 md:gap-8">
                                    <button
                                        onClick={() => {
                                            setIsExploding(true);
                                            setTimeout(() => {
                                                setView('WORLD_CUP');
                                                setIsExploding(false);
                                            }, 800);
                                        }}
                                        style={{ animationDelay: '0.05s' }}
                                        className={`glass-card card-white-glow col-span-4 group h-[12rem] sm:h-[20rem] md:h-[24rem] flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 animate-[popIn_0.5s_ease-out_both] ${isExploding ? 'animate-card-explode' : ''}`}
                                    >
                                        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded bg-[#00f3ff]/20 border border-[#00f3ff]/30 text-[#00f3ff] text-[10px] font-black animate-pulse uppercase italic shadow-[0_0_15px_rgba(0,243,255,0.3)]"> NUOVA MODALITÀ </div>
                                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00f3ff]/5 blur-[60px] rounded-full group-hover:bg-[#00f3ff]/10 transition-all duration-700"></div>
                                        <div className="mb-2 md:mb-4 group-hover:scale-105 transition-transform duration-500">
                                            <img 
                                                src="/world_cup_logo.png" 
                                                alt="Mondiali 2026 Logo" 
                                                className="w-16 h-16 sm:w-24 sm:h-24 md:w-36 md:h-36 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] filter brightness-105 group-hover:brightness-110 transition-all"
                                            />
                                        </div>
                                        <h3 className="text-sm sm:text-2xl md:text-4xl font-black italic tracking-tighter text-white/90 uppercase">Mondiali 2026</h3>
                                        <p className="text-gray-500 text-[6px] sm:text-[10px] md:text-sm mt-1 uppercase tracking-[0.2em] font-black group-hover:text-[#00f3ff] transition-colors">USA, Messico e Canada: il grande torneo tra fannies.</p>
                                    </button>
                                </div>
                                <div className="col-span-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowWorldCupRules(true)}
                                        className="w-full rounded-3xl border-2 border-cyan-400/50 bg-black/20 px-4 py-3 text-left transition-all duration-300 hover:border-cyan-300 hover:bg-cyan-400/5 hover:shadow-[0_0_30px_rgba(34,211,238,0.25)]"
                                    >
                                        <p className="text-sm sm:text-base font-black text-cyan-300 uppercase tracking-[0.2em]">Regolamento Mondiali</p>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* SECTION 2: MODALITÀ 1X2 */}
                        <div className="space-y-6">
                            <SectionHeader title="MODALITÀ 1X2" subtitle="Montepremi & Classifica Globale" color="border-acid-green/30" />
                            <div className="grid grid-cols-4 gap-3 md:gap-8">
                                {/* SLIM CYBER-HEADER (Pot & Jackpot) */}
                                <div className="col-span-4 relative group">
                                    <div className="liquid-glass border-white/5 relative overflow-hidden group hover:border-white/10 transition-all duration-700 w-full shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                                        <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 via-transparent to-cyan-400/5 opacity-50"></div>
                                        <div className="grid grid-cols-2 divide-x divide-white/10 relative z-10">
                                            <div className="py-3 md:py-6 px-4 md:px-12 flex items-center justify-between group/pot">
                                                <div className="flex flex-col">
                                                    <span className="text-brand-gold text-[7px] md:text-[12px] tracking-[0.4em] font-black uppercase opacity-60">MONTE PREMI</span>
                                                    <div className="text-xl md:text-5xl font-display font-black text-brand-gold drop-shadow-[0_0_15px_rgba(255,204,0,0.5)] font-digital flex items-baseline gap-1">
                                                        {potDisplay}<span className="text-[8px] md:text-xl opacity-40 font-mono">FTK</span>
                                                    </div>
                                                </div>
                                                <div className="hidden md:block w-12 h-12 rounded-full border border-brand-gold/20 flex items-center justify-center group-hover/pot:scale-110 transition-transform">
                                                    <Trophy size={20} className="text-brand-gold/40" />
                                                </div>
                                            </div>
                                            <div className="py-3 md:py-6 px-4 md:px-12 flex items-center justify-between group/sj">
                                                <div className="flex flex-col">
                                                    <span className="text-cyan-400 text-[7px] md:text-[12px] tracking-[0.4em] font-black uppercase opacity-60">SUPER JACKPOT</span>
                                                    <div className="text-xl md:text-5xl font-display font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] font-digital flex items-baseline gap-1">
                                                        {jackpotDisplay}<span className="text-[8px] md:text-xl opacity-40 font-mono">FTK</span>
                                                    </div>
                                                </div>
                                                <div className="hidden md:block w-12 h-12 rounded-full border border-cyan-400/20 flex items-center justify-center group-hover/sj:scale-110 transition-transform">
                                                    <Zap size={20} className="text-cyan-400/40" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20 animate-scanline opacity-20"></div>
                                    </div>
                                </div>

                                {/* 1x2 MODE BUTTON */}
                                <button
                                    onClick={() => setView('BETTING')}
                                    style={{ animationDelay: '0.1s' }}
                                    className="glass-card card-acid-green col-span-2 group h-[12rem] sm:h-[20rem] md:h-[26rem] flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 animate-[popIn_0.5s_ease-out_both]"
                                >
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#bfff00]/5 blur-[60px] rounded-full group-hover:bg-[#bfff00]/10 transition-all duration-700"></div>
                                    <div className="mb-2 group-hover:scale-110 transition-transform duration-500">
                                        <Zap size={40} className="text-acid-glow md:w-20 md:h-20" strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-sm sm:text-2xl md:text-5xl font-black italic tracking-tighter text-white/90 uppercase">Gioca 1x2</h3>
                                    <p className="text-gray-600 text-[7px] sm:text-xs md:text-sm mt-1 uppercase tracking-[0.2em] font-black group-hover:text-[#bfff00] transition-colors">vai alla schedina</p>
                                </button>

                                {/* CLASSIFICA BUTTON */}
                                <button
                                    onClick={() => setView('LEADERBOARD')}
                                    style={{ animationDelay: '0.2s' }}
                                    className="glass-card card-purple col-span-2 group h-[12rem] sm:h-[20rem] md:h-[26rem] flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 animate-[popIn_0.5s_ease-out_both]"
                                >
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#9d00ff]/5 blur-[60px] rounded-full group-hover:bg-[#9d00ff]/10 transition-all duration-700"></div>
                                    <div className="mb-2 group-hover:scale-110 transition-transform duration-500">
                                        <Trophy size={40} className="text-brand-purple-vibrant md:w-16 md:h-16" strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-sm sm:text-2xl md:text-5xl font-black italic tracking-tighter text-white/90 uppercase">Classifica</h3>
                                    <p className="text-gray-600 text-[7px] sm:text-xs md:text-sm mt-1 uppercase tracking-[0.2em] font-black group-hover:text-brand-purple-vibrant transition-colors">1x2 ranking</p>
                                </button>

                                {/* I FANNIES (SPY) */}
                                <button
                                    onClick={() => setView('SPY')}
                                    style={{ animationDelay: '0.3s' }}
                                    className="glass-card card-bright-yellow col-span-4 group h-[9rem] sm:h-[14.5rem] md:h-[18rem] flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 animate-[popIn_0.5s_ease-out_both]"
                                >
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ffee00]/5 blur-[60px] rounded-full group-hover:bg-[#ffee00]/10 transition-all duration-700"></div>
                                    <div className="flex items-center gap-6">
                                        <div className="group-hover:scale-110 transition-transform duration-500">
                                            <Eye size={32} className="text-[#ffee00] md:w-16 md:h-16" strokeWidth={2.5} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-sm sm:text-xl md:text-3xl font-black italic tracking-tighter text-white/90 uppercase leading-none">I Fannies</h3>
                                            <p className="text-gray-600 text-[7px] sm:text-[9px] md:text-xs mt-1 uppercase tracking-[0.2em] font-black group-hover:text-[#ffee00] transition-colors">guarda le giocate degli altri.</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* SECTION 2: ARENA & LEGHE */}
                        <div className="space-y-6 pb-20">
                            <SectionHeader title="ARENA & COMPETIZIONI" subtitle="Survival & Campionati FB Lega" color="border-brand-orange/30" />
                            <div className="grid grid-cols-4 gap-3 md:gap-8">
                                <button
                                    onClick={() => setView('SURVIVAL')}
                                    style={{ animationDelay: '0.4s' }}
                                    className="glass-card card-bright-red col-span-2 group h-[16rem] sm:h-[28rem] md:h-[36rem] flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 animate-[popIn_0.5s_ease-out_both]"
                                >
                                    {survivalStatus === 'ALIVE' && (
                                        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded bg-green-500/20 border border-green-500/30 text-green-500 text-[10px] font-black animate-pulse uppercase italic"> IN VITA </div>
                                    )}
                                    {isSurvivalOpen && !survivalStatus && (
                                        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 text-[10px] font-black animate-pulse uppercase italic shadow-[0_0_15px_rgba(234,179,8,0.3)]"> ISCRIZIONI APERTE </div>
                                    )}
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ff2200]/5 blur-[60px] rounded-full group-hover:bg-[#ff2200]/10 transition-all duration-700"></div>
                                    <div className="mb-2 md:mb-4 group-hover:scale-110 transition-transform duration-500">
                                        <Skull size={36} className="text-[#ff2200] md:w-20 md:h-20" strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-sm sm:text-2xl md:text-4xl font-black italic tracking-tighter text-white/90 uppercase">Survival</h3>
                                    <p className="text-gray-600 text-[7px] sm:text-xs md:text-sm mt-1 uppercase tracking-[0.2em] font-black group-hover:text-[#ff2200] transition-colors">l'ultimo che resta.</p>
                                </button>
                                <button
                                    onClick={() => setView('FB_LEGA')}
                                    style={{ animationDelay: '0.5s' }}
                                    className="glass-card card-lega-alieno col-span-2 group h-[16rem] sm:h-[28rem] md:h-[36rem] flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-500 animate-[popIn_0.5s_ease-out_both]"
                                >
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#5d8aa8]/20 blur-[60px] rounded-full group-hover:opacity-100 transition-all duration-700"></div>
                                    <div className="mb-2 md:mb-4 group-hover:rotate-12 transition-transform duration-500">
                                        <Shield size={36} className="text-[#5d8aa8] md:w-20 md:h-20 drop-shadow-[0_0_12px_rgba(93,138,168,0.9)] group-hover:text-acid-glow transition-colors" strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-sm sm:text-2xl md:text-4xl font-black italic tracking-tighter text-white/90 uppercase">FB Lega</h3>
                                    <p className="text-gray-500 text-[6px] sm:text-[10px] md:text-sm mt-1 uppercase tracking-[0.2em] font-black group-hover:text-acid-glow transition-colors">partecipa o crea la tua lega.</p>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sub-views */}
                {view === 'BETTING' && matchday && (
                    <div className="relative animate-fade-in">
                        <BettingInterface matchday={matchday} userBets={userBets} user={user} onBetPlaced={handleBetPlaced} onViewChange={setView} />
                    </div>
                )}
                {view === 'SPY' && matchday && (
                    <div className="relative animate-fade-in group">
                        <ErrorBoundary>
                            <FanniesView matchday={matchday} />
                        </ErrorBoundary>
                    </div>
                )}
                {view === 'LEADERBOARD' && (
                    <div className="relative animate-fade-in">
                        <LeaderboardView matchday={matchday} />
                    </div>
                )}
                {view === 'SURVIVAL' && (
                    <div className="relative animate-fade-in">
                        <SurvivalView user={user} activeMatchday={matchday} onBack={() => setView('HOME')} onBalanceUpdate={() => { if (onBalanceUpdate) onBalanceUpdate(); loadData(); }} />
                    </div>
                )}
                {view === 'FB_LEGA' && (
                    <div className="relative animate-fade-in">
                        <FBLegaView />
                    </div>
                )}
                {view === 'WORLD_CUP' && (
                    <div className="relative animate-fade-in">
                        <ErrorBoundary>
                            <WorldCupView onBack={() => setView('HOME')} user={user} />
                        </ErrorBoundary>
                    </div>
                )}
                {view === 'CARDS' && (
                    <div className="relative animate-fade-in">
                        <CardGallery onBack={() => setView('HOME')} />
                    </div>
                )}
            </div>

            <div className="fixed bottom-1 right-1 text-[8px] font-mono text-white/10 select-none pointer-events-none z-[1000]">
                v2026.02.06.1612
            </div>

            {view === 'HOME' && (
                <BottomNavBar
                    onRegulations={() => setShowRegulations(true)}
                    onCards={() => setView('CARDS')}
                    onProfile={() => setShowProfile(true)}
                />
            )}

            {isExploding && (
                <>
                    <div className="explosion-flash-overlay" />
                    <div className="explosion-shockwave" />
                    <div className="explosion-particles" />
                </>
            )}
        </>
    );
};

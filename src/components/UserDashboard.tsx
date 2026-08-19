import React, { useEffect, useState, useCallback } from 'react';
import { gameService } from '../services/gameService';
import type { Matchday, User, ViewMode } from '../types';
import { NavigationBar } from './NavigationBar';
import { SurvivalView } from './SurvivalView';
import { BottomNavBar } from './BottomNavBar';
import { ProfileView } from './ProfileView';
import { RegulationsModal } from './RegulationsModal';
import { RequestTokensModal } from './RequestTokensModal';
import { Skull, Shield } from 'lucide-react';
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
    const [view, setView] = useState<ViewMode>('HOME');
    const [survivalStatus, setSurvivalStatus] = useState<'ALIVE' | 'ELIMINATED' | 'WINNER' | null>(null);
    const [isSurvivalOpen, setIsSurvivalOpen] = useState(false);
    const [survivalPrizePool, setSurvivalPrizePool] = useState<number | null>(null);
    const [fbLegaPrizePool, setFbLegaPrizePool] = useState<number | null>(null);
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

            // Set Survival Prize Pool
            setSurvivalPrizePool(season?.prizePool || 0);

            // Set FB Lega Prize Pool
            try {
                const leagues = await gameService.getLeagues();
                // Sum the prize_pool of active leagues the user is part of
                const userLeagues = leagues.filter(l => l.is_member && l.status !== 'COMPLETED');
                if (userLeagues.length > 0) {
                    const totalPot = userLeagues.reduce((sum, l) => sum + (l.prize_pool || 0), 0);
                    setFbLegaPrizePool(totalPot);
                } else {
                    // Sum the prize pools of all open leagues
                    const openLeagues = leagues.filter(l => l.status === 'OPEN');
                    const openPot = openLeagues.reduce((sum, l) => sum + (l.prize_pool || 0), 0);
                    setFbLegaPrizePool(openPot);
                }
            } catch (error) {
                console.error('Error loading FB leagues prize pools:', error);
                setFbLegaPrizePool(0);
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

                        {/* SECTION: ARENA & LEGHE */}
                        <div className="space-y-6 pb-20">
                            <SectionHeader title="ARENA & COMPETIZIONI" subtitle="Survival & Campionati FB Lega" color="border-brand-orange/30" />
                            
                            {/* Montepremi (Prize Pools) badges */}
                            <div className="grid grid-cols-4 gap-3 md:gap-8 mb-2">
                                <div className="col-span-2">
                                    <div className="pot-badge-survival py-2 md:py-3 px-4 rounded-[1.25rem] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 border bg-black/40 backdrop-blur-md transition-all duration-300">
                                        <span className="text-[8px] sm:text-[10px] md:text-xs font-black text-red-500 uppercase tracking-[0.2em] drop-shadow-[0_0_8px_rgba(255,34,0,0.4)]">
                                            MONTEPREMI
                                        </span>
                                        <span className="text-[11px] sm:text-sm md:text-base font-mono font-black text-white glow-red">
                                            {survivalPrizePool !== null ? `${survivalPrizePool} TK` : '0 TK'}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <div className="pot-badge-lega py-2 md:py-3 px-4 rounded-[1.25rem] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 border bg-black/40 backdrop-blur-md transition-all duration-300">
                                        <span className="text-[8px] sm:text-[10px] md:text-xs font-black text-[#5d8aa8] uppercase tracking-[0.2em] drop-shadow-[0_0_8px_rgba(93,138,168,0.4)]">
                                            MONTEPREMI
                                        </span>
                                        <span className="text-[11px] sm:text-sm md:text-base font-mono font-black text-white glow-sky">
                                            {fbLegaPrizePool !== null ? `${fbLegaPrizePool} TK` : '0 TK'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-3 md:gap-8">
                                <button
                                    onClick={() => setView('SURVIVAL')}
                                    style={{ animationDelay: '0.4s' }}
                                    className="glass-card card-bright-red col-span-2 group h-[16rem] sm:h-[28rem] md:h-[36rem] flex flex-col justify-end items-center text-center pb-6 sm:pb-10 md:pb-12 relative overflow-hidden transition-all duration-500 animate-[popIn_0.5s_ease-out_both]"
                                >
                                    {survivalStatus === 'ALIVE' && (
                                        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded bg-green-500/20 border border-green-500/30 text-green-500 text-[10px] font-black animate-pulse uppercase italic"> IN VITA </div>
                                    )}
                                    {isSurvivalOpen && !survivalStatus && (
                                        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 text-[10px] font-black animate-pulse uppercase italic shadow-[0_0_15px_rgba(234,179,8,0.3)]"> ISCRIZIONI APERTE </div>
                                    )}
                                    {/* Background Image / integration */}
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-100 group-hover:scale-105 opacity-70 group-hover:opacity-90" 
                                        style={{ backgroundImage: "url('/Survival.png')" }}
                                    />
                                    {/* Dark overlays to blend image perfectly into the dark dashboard look */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#020508] via-transparent to-[#020508]/20 z-0"></div>
                                    <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors duration-500 z-0"></div>
                                    
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ff2200]/5 blur-[60px] rounded-full group-hover:bg-[#ff2200]/10 transition-all duration-700 z-0"></div>
                                    
                                    <div className="relative z-10 w-full px-4">
                                        <p className="text-gray-300 text-[6px] sm:text-[10px] md:text-sm uppercase tracking-[0.2em] font-black group-hover:text-[#ff2200] transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                                            l'ultimo che resta.
                                        </p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setView('FB_LEGA')}
                                    style={{ animationDelay: '0.5s' }}
                                    className="glass-card card-lega-alieno col-span-2 group h-[16rem] sm:h-[28rem] md:h-[36rem] flex flex-col justify-end items-center text-center pb-6 sm:pb-10 md:pb-12 relative overflow-hidden transition-all duration-500 animate-[popIn_0.5s_ease-out_both]"
                                >
                                    {/* Background Image / integration */}
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-100 group-hover:scale-105 opacity-70 group-hover:opacity-90" 
                                        style={{ backgroundImage: "url('/Lega.png')" }}
                                    />
                                    {/* Dark overlays to blend image perfectly into the dark dashboard look */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#020508] via-transparent to-[#020508]/20 z-0"></div>
                                    <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors duration-500 z-0"></div>
                                    
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#5d8aa8]/25 blur-[60px] rounded-full group-hover:opacity-100 transition-all duration-700 z-0"></div>
                                    
                                    <div className="relative z-10 w-full px-4">
                                        <p className="text-gray-300 text-[6px] sm:text-[10px] md:text-sm uppercase tracking-[0.2em] font-black group-hover:text-acid-glow transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                                            partecipa o crea la tua lega.
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sub-views */}
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

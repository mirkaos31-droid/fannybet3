import React from 'react';
import type { User } from '../types';

interface LayoutProps {
    children: React.ReactNode;
    user: User | null;
    onLogout: () => void;
    onToggleView?: () => void;
    isUserMode?: boolean;
    onAdminUsers?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onToggleView, isUserMode, onAdminUsers }) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    return (
        <div className="flex min-h-screen font-sans relative overflow-x-hidden">

            {/* Mobile Header (Brand Infused & Functional) */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-[100] bg-black border-b border-white/10 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,20px)] h-[calc(5rem+env(safe-area-inset-top,20px))] shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-purple/20 flex items-center justify-center border border-white/10 shadow-inner">
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                            <span className="text-2xl">✨</span>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-display font-black text-white italic truncate max-w-[120px] uppercase">
                            {user?.username || 'GUEST'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Token Display (Very Visible) */}
                    <div className="flex flex-col items-end bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
                        <span className="text-[6px] text-gray-500 font-black uppercase tracking-widest leading-none mb-0.5">Balance</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-mono font-black text-brand-gold drop-shadow-[0_0_10px_rgba(255,204,0,0.3)]">{user?.tokens || 0}</span>
                            <span className="text-[7px] font-black text-brand-gold/60">FTK</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {user?.role === 'ADMIN' && onAdminUsers && (
                            <button
                                onClick={onAdminUsers}
                                className="w-10 h-10 flex items-center justify-center bg-brand-diamond/10 rounded-xl border border-brand-diamond/30 text-brand-diamond text-lg hover:bg-brand-diamond/20 transition-all touch-target"
                                title="Admin Panel"
                            >
                                👥
                            </button>
                        )}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 text-white shadow-xl touch-target"
                        >
                            {isSidebarOpen ? '✕' : '☰'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-40 w-64 sm:w-72 md:w-64 liquid-glass m-3 md:m-0 md:mr-0 flex flex-col border-white/5 shadow-2xl transition-transform duration-500
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="hidden md:block p-8 md:p-10 border-b border-white/5">
                    <h1 className="text-[0.98rem] md:text-[1.46rem] modern-title">
                        FANNY<span className="text-brand-orange drop-shadow-[0_0_10px_rgba(255,106,0,0.5)]">BET</span>
                    </h1>
                </div>

                <div className="flex-1 px-4 py-6 md:py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 animate-pulse-slow">
                        <span className="text-4xl md:text-5xl text-brand-orange">🛡️</span>
                    </div>
                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.4em] mb-2">Core Protocol</p>
                    <p className="text-[11px] text-gray-500 italic px-3 leading-relaxed opacity-60">Seleziona una categoria per visualizzare i mercati attivi.</p>
                </div>

                {user && (
                    <div className="p-4 md:p-6 mt-auto">
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 border border-white/5 bg-white/[0.02] text-gray-400 rounded-2xl hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] touch-target"
                        >
                            <span className="text-lg">🛑</span> <span className="hidden sm:inline">ESCI</span>
                        </button>
                    </div>
                )}
            </aside>

            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col p-2 md:p-6 space-y-2 md:space-y-6 max-h-screen pt-20 md:pt-6 overflow-hidden">
                {/* Top Header (Desktop Only) */}
                <header className="hidden md:flex liquid-glass px-6 md:px-10 py-5 items-center justify-between border-white/5 h-24 md:h-28 shadow-2xl">
                    <div className="flex items-center gap-3 md:gap-5 min-w-0">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-purple/20 flex items-center justify-center border border-white/10 shadow-inner flex-shrink-0 overflow-hidden">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-2xl md:text-3xl animate-glow">✨</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mb-1">Authenticated As</p>
                            <h2 className="text-xl md:text-3xl font-display font-black tracking-tight text-white/90 truncate">{user?.username || 'GUEST_USER'}</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-8">
                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em] mb-2">Credits</p>
                            <div className="flex items-baseline gap-1 md:gap-2">
                                <span className="text-xl md:text-3xl font-display font-black text-brand-orange drop-shadow-[0_0_15px_rgba(255,106,0,0.3)]">{user?.tokens || 0}</span>
                                <span className="text-[10px] md:text-xs font-black text-white/30 tracking-widest italic">TK</span>
                            </div>
                        </div>

                        <div className="h-10 md:h-12 w-[1px] bg-white/10"></div>

                        {/* Admin Users Button */}
                        {user?.role === 'ADMIN' && onAdminUsers && (
                            <button
                                onClick={onAdminUsers}
                                className="bg-brand-diamond/10 hover:bg-brand-diamond/20 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all border border-brand-diamond/30 group relative touch-target"
                                title="Gestisci Utenti"
                            >
                                <div className="absolute inset-0 bg-brand-diamond/5 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform duration-500 relative z-10 text-brand-diamond/70 group-hover:text-brand-diamond">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </button>
                        )}

                        <div className="h-10 md:h-12 w-[1px] bg-white/10"></div>

                        {onToggleView && (
                            <button
                                onClick={onToggleView}
                                className="bg-white/5 hover:bg-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all border border-white/10 group relative touch-target"
                                title={isUserMode ? "Activate Admin Matrix" : "Return to User Grid"}
                            >
                                <div className="absolute inset-0 bg-brand-orange/5 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-500 relative z-10 text-white/70 group-hover:text-brand-orange">
                                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                        )}
                    </div>
                </header>

                {/* Main scrollable area */}
                <div className="flex-1 overflow-y-auto pr-1 md:pr-2 no-scrollbar">
                    <div className="max-w-6xl mx-auto py-1 md:py-4 px-1 md:px-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

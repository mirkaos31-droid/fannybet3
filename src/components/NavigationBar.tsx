import { Home, Zap, Eye, Trophy, Skull, User, Shield, Globe } from 'lucide-react';
import type { ViewMode } from '../types';

interface NavigationBarProps {
    currentView: ViewMode;
    onNavigate: (view: ViewMode) => void;
    isAdmin?: boolean;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ currentView, onNavigate }) => {
    const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'HOME', label: 'Home', icon: <Home size={18} /> },
        { id: 'BETTING', label: '1x2 Mode', icon: <Zap size={18} /> },
        { id: 'SPY', label: 'I fannies', icon: <Eye size={18} /> },
        { id: 'LEADERBOARD', label: 'Classifiche', icon: <Trophy size={18} /> },
        { id: 'SURVIVAL', label: 'Survival Mode', icon: <Skull size={18} /> },
        { id: 'FB_LEGA', label: 'FB Lega', icon: <Shield size={18} /> },
        { id: 'WORLD_CUP' as ViewMode, label: 'Mondiali', icon: <Globe size={18} /> },
        { id: 'PROFILE', label: 'Profilo', icon: <User size={18} /> },
    ];

    return (
        <div className="flex justify-center w-full overflow-x-auto no-scrollbar">
            <div className="flex gap-1 md:gap-2 p-1 md:p-1.5 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-[32px] min-w-min shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`
                            px-3 md:px-6 py-2 md:py-2.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1 md:gap-3 transition-all duration-500 touch-target whitespace-nowrap relative z-10
                            ${currentView === item.id
                                ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/10 scale-[1.05]'
                                : 'text-gray-500 active:text-white active:bg-white/5'
                            }
                        `}
                    >
                        <span className="flex-shrink-0">{item.icon}</span>
                        <span className="hidden md:inline">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

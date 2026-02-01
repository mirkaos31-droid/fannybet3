import { Home, Zap, Eye, Trophy, Skull, User, Swords } from 'lucide-react';
import type { ViewMode } from '../types';

interface NavigationBarProps {
    currentView: ViewMode;
    onNavigate: (view: ViewMode) => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ currentView, onNavigate }) => {
    const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'HOME', label: 'Home', icon: <Home size={18} /> },
        { id: 'BETTING', label: '1x2 Mode', icon: <Zap size={18} /> },
        { id: 'SPY', label: 'I fannies', icon: <Eye size={18} /> },
        { id: 'LEADERBOARD', label: 'Classifiche', icon: <Trophy size={18} /> },
        { id: 'SURVIVAL', label: 'Survival Mode', icon: <Skull size={18} /> },
        { id: 'DUEL_ARENA', label: 'Sfide', icon: <Swords size={18} /> },
        { id: 'PROFILE', label: 'Profilo', icon: <User size={18} /> },
    ];

    return (
        <div className="flex justify-center w-full overflow-x-auto">
            <div className="flex gap-1 md:gap-2 p-1 md:p-1.5 rounded-full bg-white/[0.02] border border-white/5 backdrop-blur-2xl min-w-min">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`
                            px-2 md:px-6 py-2 md:py-2.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1 md:gap-3 transition-all duration-500 touch-target whitespace-nowrap
                            ${currentView === item.id
                                ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/10'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
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

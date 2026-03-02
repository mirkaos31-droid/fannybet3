import React from 'react';
import { FileText, User, Library } from 'lucide-react';

interface BottomNavBarProps {
    onRegulations: () => void;
    onCards: () => void;
    onProfile: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ onRegulations, onCards, onProfile }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/5 md:hidden pb-safe">
            <div className="flex justify-around items-center max-w-md mx-auto h-20 px-6 relative">
                {/* Regolamenti */}
                <button
                    onClick={onRegulations}
                    className="flex flex-col items-center justify-center space-y-1 group transition-all duration-300"
                >
                    <div className="p-2 rounded-xl group-active:bg-white/10 transition-colors">
                        <FileText size={22} className="text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">Regole</span>
                </button>

                {/* Central Card Gallery Button (+10% size) */}
                <div className="relative -top-8">
                    <button
                        onClick={onCards}
                        className="w-[4.8rem] h-[4.8rem] bg-gradient-to-b from-[#ff8800] via-[#ffaa00] to-[#cc6600] rounded-full flex items-center justify-center shadow-[0_0_35px_rgba(255,136,0,0.5)] border-4 border-black group active:scale-95 transition-all duration-300"
                    >
                        <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Library size={32} className="text-black drop-shadow-md" />
                    </button>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-max">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff8800] animate-pulse">Le Tue Cards</span>
                    </div>
                </div>

                {/* Profilo */}
                <button
                    onClick={onProfile}
                    className="flex flex-col items-center justify-center space-y-1 group transition-all duration-300"
                >
                    <div className="p-2 rounded-xl group-active:bg-white/10 transition-colors">
                        <User size={22} className="text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">Profilo</span>
                </button>
            </div>
        </div>
    );
};

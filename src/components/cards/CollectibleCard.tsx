import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface CollectibleCardProps {
    title: string;
    description: string;
    imageUrl?: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    unlocked?: boolean;
    unlockedAt?: string;
    isNew?: boolean; // Trigger flip animation
}

export const CollectibleCard: React.FC<CollectibleCardProps> = ({
    title,
    description,
    imageUrl,
    rarity,
    unlocked = false,
    unlockedAt,
    isNew = false
}) => {
    const [isFlipped, setIsFlipped] = useState(!isNew);

    useEffect(() => {
        if (isNew && unlocked) {
            // Delay flip slightly for effect
            const timer = setTimeout(() => setIsFlipped(true), 500);
            return () => clearTimeout(timer);
        }
    }, [isNew, unlocked]);

    const getBorderColor = () => {
        if (!unlocked) return 'border-gray-800';
        switch (rarity) {
            case 'LEGENDARY': return 'border-[#ff8800]';
            case 'EPIC': return 'border-[#ff00ff]';
            case 'RARE': return 'border-[#00ffff]';
            default: return 'border-white/20';
        }
    };

    const getGlowColor = () => {
        if (!unlocked) return 'none';
        switch (rarity) {
            case 'LEGENDARY': return '0 0 25px rgba(255,136,0,0.5)';
            case 'EPIC': return '0 0 25px rgba(255,0,255,0.5)';
            case 'RARE': return '0 0 25px rgba(0,255,255,0.5)';
            default: return 'none';
        }
    };

    return (
        <div className="perspective-1000 w-full aspect-[3/4] max-w-[240px] mx-auto">
            <div className={`relative w-full h-full transition-transform duration-1000 transform-style-3d ${isFlipped ? 'rotate-y-0' : 'rotate-y-180'}`}>

                {/* Back Side (Hidden initially if new) */}
                <div className={`absolute inset-0 backface-hidden rounded-[1.5rem] border-[6px] md:border-[8px] ${getBorderColor()} bg-black overflow-hidden shadow-2xl transition-all duration-300`}
                    style={{ boxShadow: getGlowColor() }}>
                    {unlocked && imageUrl ? (
                        <img src={imageUrl} alt={title} className="w-full h-full object-cover opacity-80" />
                    ) : (
                        <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                            <Lock className="text-white/10" size={48} />
                        </div>
                    )}

                    <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-4 ${unlocked ? 'opacity-100' : 'opacity-40'}`}>
                        <h3 className="text-white font-black italic uppercase text-sm md:text-base leading-tight drop-shadow-lg">
                            {unlocked ? title : '???'}
                        </h3>
                        <div className="mt-1">
                            <p className="text-[8px] md:text-[9px] text-[#ff8800] font-black uppercase tracking-tighter mb-0.5">Obiettivo:</p>
                            <p className="text-[9px] md:text-[10px] text-gray-300 font-bold uppercase tracking-tight leading-tight line-clamp-2">
                                {unlocked ? description : 'Contenuto Secretato'}
                            </p>
                        </div>
                        {unlockedAt && (
                            <div className="mt-2 py-0.5 px-2 bg-white/10 rounded-full w-fit">
                                <span className="text-[7px] font-black text-white/50 uppercase">Sbloccata: {new Date(unlockedAt).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>

                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${unlocked ? 'bg-black/80 text-white border border-white/10' : 'bg-white/5 text-white/20'}`}>
                        {rarity}
                    </div>
                </div>

                {/* Front Side (Face down/Locked look during flip) */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[1.5rem] border-[8px] border-gray-800 bg-neutral-900 flex items-center justify-center overflow-hidden">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                        <Lock size={48} className="text-white" />
                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">NUOVO SBLOCCO</span>
                    </div>
                    {/* Add some "mystery" pattern */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,white_0%,transparent_70%)]"></div>
                </div>

            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .rotate-y-0 { transform: rotateY(0deg); }
            `}</style>
        </div>
    );
};

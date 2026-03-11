import React from 'react';

interface BonusBadgesProps {
    bonuses: string[];
}

export const BonusBadges: React.FC<BonusBadgesProps> = ({ bonuses }) => {
    if (!bonuses || bonuses.length === 0) return null;

    const bonusConfig: Record<string, { icon: string, label: string, color: string, glow: string }> = {
        'en_plein': {
            icon: '🎯',
            label: 'En Plein',
            color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
            glow: 'shadow-[0_0_10px_rgba(234,179,8,0.3)]'
        },
        'strike': {
            icon: '⚡',
            label: 'Strike',
            color: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
            glow: 'shadow-[0_0_10px_rgba(59,130,246,0.3)]'
        },
        'jolly': {
            icon: '⭐',
            label: 'Jolly',
            color: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
            glow: 'shadow-[0_0_10px_rgba(168,85,247,0.3)]'
        },
        'underdog': {
            icon: '🦴',
            label: 'Underdog',
            color: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
            glow: 'shadow-[0_0_10px_rgba(249,115,22,0.3)]'
        }
    };

    return (
        <div className="flex flex-wrap gap-1.5 mt-1">
            {bonuses.map(bonusKey => {
                const config = bonusConfig[bonusKey];
                if (!config) return null;

                return (
                    <div
                        key={bonusKey}
                        title={config.label}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tighter ${config.color} ${config.glow} animate-in fade-in zoom-in duration-500`}
                    >
                        <span>{config.icon}</span>
                        <span className="hidden md:inline">{config.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

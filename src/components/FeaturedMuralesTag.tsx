import React, { useState, useEffect } from 'react';
import { Crown, SprayCan, Flame, ChevronRight } from 'lucide-react';
import { muralesService, type MuralesTag } from '../services/muralesService';
import { supabase } from '../supabaseClient';
import type { User } from '../types';

interface FeaturedMuralesTagProps {
    user?: User | null;
    onOpenMurales: () => void;
}

const COLOR_MAP: Record<string, string> = {
    'neon-cyan': '#00f3ff',
    'acid-green': '#bfff00',
    'hot-pink': '#ff007f',
    'electric-purple': '#c084fc',
    'sun-orange': '#ff7700',
    'pure-white': '#f8fafc',
};

export const FeaturedMuralesTag: React.FC<FeaturedMuralesTagProps> = ({ onOpenMurales }) => {
    const [featuredTag, setFeaturedTag] = useState<MuralesTag | null>(null);
    const [loading, setLoading] = useState(true);

    const loadFeatured = async () => {
        try {
            const tag = await muralesService.getFeaturedTag();
            if (tag) {
                setFeaturedTag(tag);
            } else {
                // Se non c'è una frase con is_featured=true, prendi la più votata o l'ultima creata come fallback
                const topTags = await muralesService.getTags(1);
                if (topTags && topTags.length > 0) {
                    setFeaturedTag(topTags[0]);
                } else {
                    setFeaturedTag(null);
                }
            }
        } catch (err) {
            console.error('Error loading featured murales tag:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFeatured();

        // Listen in Realtime for changes on murales_tags
        const channel = supabase
            .channel(`featured-murales-tag-${Date.now()}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'murales_tags' },
                () => {
                    loadFeatured();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (loading) {
        return (
            <div className="w-full h-24 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
        );
    }

    if (!featuredTag) {
        return (
            <div
                onClick={onOpenMurales}
                className="sculpted-slab-bg rounded-2xl border border-white/10 p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:border-amber-400/40 transition-all duration-300 group shadow-2xl relative overflow-hidden"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <SprayCan size={20} className="text-amber-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-mono font-black text-amber-400 tracking-[0.25em] uppercase">Murales Spotlight</span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                            Spruzza la tua frase sul muro: la più simpatica diventerà il Murales della Settimana!
                        </p>
                    </div>
                </div>
                <ChevronRight size={18} className="text-gray-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0" />
            </div>
        );
    }

    const textColor = COLOR_MAP[featuredTag.color] || '#ff7700';

    // Font size proporzionato (-25%), d'impatto ma calibrato
    const getDynamicFontSize = (text: string) => {
        const len = text.trim().length;
        if (len <= 16) {
            return 'clamp(2.15rem, 9.5vw, 4.1rem)';
        }
        if (len <= 30) {
            return 'clamp(1.7rem, 7.5vw, 3.3rem)';
        }
        if (len <= 60) {
            return 'clamp(1.3rem, 5.6vw, 2.5rem)';
        }
        if (len <= 100) {
            return 'clamp(1.05rem, 4.2vw, 1.9rem)';
        }
        return 'clamp(0.9rem, 3.5vw, 1.45rem)';
    };

    return (
        <div
            onClick={onOpenMurales}
            className="sculpted-slab-bg rounded-2xl sm:rounded-3xl border border-white/10 hover:border-amber-400/40 transition-all duration-300 cursor-pointer px-3 py-2.5 sm:px-5 sm:py-3.5 relative overflow-hidden group shadow-2xl bg-cover bg-center flex flex-col justify-between"
        >
            {/* Real Wall Background Texture Image */}
            <div
                className="absolute inset-0 bg-cover bg-center pointer-events-none transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: "url('/murales_home_bg.jpg')" }}
            />
            {/* Dark vignette overlay for optimal neon readability & depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/40 to-black/80 pointer-events-none" />

            {/* Ambient neon backdrop blur */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-400/15 transition-all" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-400/15 transition-all" />

            {/* Header: Titolo discreto centrato in alto */}
            <div className="relative z-10 flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1 mx-auto text-[8px] sm:text-[9px] font-mono text-amber-300/80 tracking-widest uppercase">
                    <Crown size={10} className="text-amber-300 fill-amber-300" />
                    <span>Murales della Settimana</span>
                </div>
                <div className="absolute right-0 top-0 flex items-center gap-0.5 text-[8px] sm:text-[9px] font-mono text-white/30 group-hover:text-amber-300 transition-colors">
                    <SprayCan size={11} className="text-amber-400/70" />
                </div>
            </div>

            {/* UNICO VERO PROTAGONISTA: Frase in Tilt Neon con glow controllato e ombra proiettata sul muro */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center py-2 sm:py-3.5 px-1 w-full my-auto">
                <p
                    style={{
                        fontSize: getDynamicFontSize(featuredTag.message),
                        color: textColor,
                    }}
                    className="leading-[1.08] tracking-tight break-words whitespace-pre-wrap home-neon-text transition-transform duration-300 group-hover:scale-[1.01]"
                >
                    {featuredTag.message}
                </p>
            </div>

            {/* Footer minimale e leggero */}
            <div className="relative z-10 flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-white/40 select-none pt-0.5">
                <span className="truncate max-w-[180px] hover:text-white/70 transition-colors">
                    ~ {featuredTag.username}
                </span>

                <div className="flex items-center gap-1 text-amber-400/60 font-semibold">
                    <Flame size={11} className="fill-amber-400/40 text-amber-400/70" />
                    <span>{featuredTag.likes_count || 0}</span>
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { Crown, SprayCan, Flame, ChevronRight } from 'lucide-react';
import { muralesService, type MuralesTag } from '../services/muralesService';
import { supabase } from '../supabaseClient';
import type { User } from '../types';

interface FeaturedMuralesTagProps {
    user?: User | null;
    onOpenMurales: () => void;
}

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
                            Spruzza la tua frase sul muro: la più simpatica sarà scolpita qui!
                        </p>
                    </div>
                </div>
                <ChevronRight size={18} className="text-gray-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0" />
            </div>
        );
    }

    const colorClass = `tag-${featuredTag.color || 'neon-cyan'}`;
    const fontClass = `font-graffiti-${featuredTag.font_style || 'spray'}`;

    return (
        <div
            onClick={onOpenMurales}
            className="sculpted-slab-bg rounded-2xl sm:rounded-3xl border border-white/10 hover:border-amber-400/40 transition-all duration-300 cursor-pointer p-4 sm:p-6 relative overflow-hidden group shadow-2xl"
        >
            {/* Ambient neon backdrop blur */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-400/15 transition-all" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-400/15 transition-all" />

            {/* Header / Badge bar */}
            <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.25)]">
                        <Crown size={12} className="text-amber-300 fill-amber-300 animate-pulse" />
                        <span className="text-[9px] sm:text-[10px] font-mono font-black text-amber-300 uppercase tracking-widest">
                            Scolpito nel Cemento
                        </span>
                    </div>
                    <span className="hidden xs:inline text-[8px] sm:text-[9px] font-mono text-gray-400 tracking-wider uppercase">
                        Scelto dall'Admin
                    </span>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-gray-400 group-hover:text-amber-300 transition-colors">
                    <SprayCan size={13} className="text-amber-400 group-hover:rotate-12 transition-transform" />
                    <span className="hidden sm:inline uppercase tracking-wider">Murales</span>
                    <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
            </div>

            {/* Scolpita Neon Phrase */}
            <div className="relative z-10 py-1 sm:py-2">
                <p
                    className={`text-lg sm:text-2xl md:text-3xl leading-snug tracking-wide italic whitespace-pre-wrap sculpted-engraved-text ${colorClass} ${fontClass}`}
                >
                    "{featuredTag.message}"
                </p>
            </div>

            {/* Author info & Reactions */}
            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-white/5 flex items-center justify-between gap-2 relative z-10 select-none">
                <div className="flex items-center gap-2">
                    {featuredTag.avatar_url ? (
                        <img
                            src={featuredTag.avatar_url}
                            alt="Avatar"
                            className="w-5 h-5 rounded-md object-cover border border-white/10"
                        />
                    ) : (
                        <span className="text-xs">✨</span>
                    )}
                    <span className="text-[11px] sm:text-xs font-mono font-bold text-gray-300 tracking-tight">
                        ~ {featuredTag.username}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-mono font-bold text-amber-400">
                    <Flame size={12} className="text-amber-400 fill-amber-400" />
                    <span>{featuredTag.likes_count || 0}</span>
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { MessageSquare, Sparkles, ChevronRight } from 'lucide-react';
import type { CommunityPost, User } from '../types';
import { communityFeedService } from '../services/communityFeedService';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';

interface CommunityTickerProps {
    user: User | null;
    onOpenBoard: () => void;
}

const QUICK_EMOJIS = ['🔥', '🤡', '🦉', '🍿', '💀'];

export const CommunityTicker: React.FC<CommunityTickerProps> = ({ user, onOpenBoard }) => {
    const [latestPost, setLatestPost] = useState<CommunityPost | null>(null);
    const [loading, setLoading] = useState(true);

    const loadLatest = async () => {
        try {
            const post = await communityFeedService.getLatestPost();
            if (post) setLatestPost(post);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLatest();

        // Periodic check every 20s while on dashboard
        const interval = setInterval(() => {
            loadLatest();
        }, 20000);

        // Visibility & focus listeners: re-fetch when returning from background
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadLatest();
            }
        };
        const handleFocus = () => loadLatest();
        const handleOnline = () => loadLatest();

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('online', handleOnline);

        // Listen for real-time posts or reactions
        const channelName = `community-ticker-${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'community_posts' },
                () => { loadLatest(); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'community_reactions' },
                () => { loadLatest(); }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    loadLatest();
                }
            });

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('online', handleOnline);
            supabase.removeChannel(channel);
        };
    }, []);

    const handleQuickReaction = async (e: React.MouseEvent, emoji: string) => {
        e.stopPropagation();
        if (!user) {
            toast.error('Effettua il login per reagire');
            return;
        }
        if (!latestPost) return;

        // Optimistic update
        const hasReacted = latestPost.user_reactions?.includes(emoji);
        const currentCount = latestPost.reactions?.[emoji] || 0;
        const newCount = hasReacted ? Math.max(0, currentCount - 1) : currentCount + 1;
        const newUserReactions = hasReacted
            ? (latestPost.user_reactions || []).filter(em => em !== emoji)
            : [...(latestPost.user_reactions || []), emoji];

        setLatestPost({
            ...latestPost,
            reactions: {
                ...latestPost.reactions,
                [emoji]: newCount
            },
            user_reactions: newUserReactions
        });

        await communityFeedService.toggleReaction(latestPost.id, emoji);
    };

    if (loading) {
        return (
            <div className="w-full max-w-5xl mx-auto mb-6 px-2">
                <div className="h-24 rounded-2xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center">
                    <span className="text-xs uppercase tracking-widest text-gray-500 font-mono">Caricamento Notizie...</span>
                </div>
            </div>
        );
    }

    if (!latestPost) return null;

    return (
        <div className="w-full max-w-5xl mx-auto mb-6 px-2">
            <div
                onClick={onOpenBoard}
                className="group relative cursor-pointer overflow-hidden rounded-2xl md:rounded-3xl border border-brand-teal/30 bg-gradient-to-r from-[#04131e]/90 via-[#030914]/90 to-[#0e0618]/90 p-3.5 md:p-5 backdrop-blur-xl shadow-[0_0_30px_rgba(0,243,255,0.08)] transition-all duration-300 hover:border-brand-teal/60 hover:shadow-[0_0_40px_rgba(0,243,255,0.2)]"
            >
                {/* Glow effects */}
                <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-brand-teal/10 blur-2xl group-hover:bg-brand-teal/20 transition-all"></div>
                <div className="absolute -right-10 -bottom-10 h-28 w-28 rounded-full bg-brand-purple-vibrant/10 blur-2xl group-hover:bg-brand-purple-vibrant/20 transition-all"></div>

                {/* Header row: Bot pill + Live badge */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/30 px-2.5 py-0.5 text-[10px] md:text-xs font-black uppercase tracking-wider text-cyan-300">
                            {latestPost.is_bot ? (
                                <>
                                    <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse" />
                                    <span>FannyBot</span>
                                </>
                            ) : (
                                <>
                                    {latestPost.author_avatar ? (
                                        <img
                                            src={latestPost.author_avatar}
                                            alt={latestPost.author_name}
                                            className="w-3.5 h-3.5 rounded-full object-cover border border-cyan-400/40"
                                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <MessageSquare className="w-3 h-3 text-cyan-300" />
                                    )}
                                    <span>{latestPost.author_name}</span>
                                </>
                            )}
                        </span>

                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                            LIVE CURVA
                        </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-gray-400 group-hover:text-cyan-300 transition-colors">
                        <span>Apri Bacheca</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>

                {/* Content teaser */}
                {!latestPost.is_bot ? (
                    <div className="relative z-10 my-3 rounded-2xl bg-gradient-to-r from-cyan-950/50 via-cyan-900/20 to-transparent border-l-4 border-cyan-400 px-4 py-3.5 sm:px-5 sm:py-4 backdrop-blur-sm shadow-inner">
                        {latestPost.title && (
                            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-cyan-300 mb-1.5">
                                {latestPost.title}
                            </h4>
                        )}
                        <p className="text-[21px] sm:text-2xl md:text-3xl font-black text-white leading-snug tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] line-clamp-3 sm:line-clamp-4">
                            "{latestPost.content}"
                        </p>
                    </div>
                ) : (
                    <div className="relative z-10 my-3">
                        {latestPost.title && (
                            <h4 className="text-lg sm:text-xl md:text-2xl font-black italic tracking-tight text-white mb-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                {latestPost.title}
                            </h4>
                        )}
                        <p className="text-base sm:text-lg md:text-xl text-white/95 font-medium line-clamp-3 leading-relaxed">
                            {latestPost.content}
                        </p>
                    </div>
                )}

                {/* Footer: Quick emoji reactions + Comments count */}
                <div className="relative z-10 mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2.5">
                    {/* Quick Reactions */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] md:text-xs uppercase font-black text-gray-400 mr-1 hidden sm:inline tracking-wider">
                            Reagisci:
                        </span>
                        {QUICK_EMOJIS.map(emoji => {
                            const count = latestPost.reactions?.[emoji] || 0;
                            const isSelected = latestPost.user_reactions?.includes(emoji);

                            return (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={(e) => handleQuickReaction(e, emoji)}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all duration-200 ${
                                        isSelected
                                            ? 'bg-cyan-500/25 border border-cyan-400/60 scale-[1.03] shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                                            : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <span className="text-xs sm:text-sm leading-none">{emoji}</span>
                                    {count > 0 && (
                                        <span className={`text-[10px] sm:text-[11px] font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-gray-300'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Comments Count Indicator */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-300 font-bold bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition-colors">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-teal" />
                        <span>{latestPost.comments_count || 0} commenti</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

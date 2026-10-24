import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, MessageSquare, Send, Flame, Pin, RefreshCw, Pencil, Trash2, Check } from 'lucide-react';
import type { CommunityPost, CommunityComment, User } from '../types';
import { communityFeedService } from '../services/communityFeedService';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';

interface CommunityBoardModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

const AVAILABLE_EMOJIS = ['🔥', '🤡', '🦉', '🍿', '💀', '👑'];

export const CommunityBoardModal: React.FC<CommunityBoardModalProps> = ({
    isOpen,
    onClose,
    user
}) => {
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'BOT' | 'USERS'>('ALL');
    const [newPostContent, setNewPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);

    // Edit states for posts
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [editingPostContent, setEditingPostContent] = useState('');
    const [isSavingPostEdit, setIsSavingPostEdit] = useState(false);

    // Edit states for comments
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentContent, setEditingCommentContent] = useState('');
    const [isSavingCommentEdit, setIsSavingCommentEdit] = useState(false);

    // Comments open state: postId -> boolean
    const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
    const [commentsMap, setCommentsMap] = useState<Record<string, CommunityComment[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
    const [isSubmittingComment, setIsSubmittingComment] = useState<Record<string, boolean>>({});

    const commentsContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Fast, silent post loader: only shows full-page spinner on very first load if empty
    const loadPosts = async (silent = false) => {
        if (!silent && posts.length === 0) {
            setLoading(true);
        }
        try {
            const data = await communityFeedService.getPosts(40);
            setPosts(data);
        } catch (err) {
            console.error('Error in loadPosts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        loadPosts(false);

        // Realtime subscription for posts, comments, reactions
        const channel = supabase
            .channel('community-board-realtime-room')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'community_posts' },
                (payload) => {
                    const newPost = payload.new as CommunityPost;
                    if (newPost && newPost.id) {
                        setPosts(prev => {
                            if (prev.some(p => p.id === newPost.id)) return prev;
                            return [{ ...newPost, comments_count: 0, reactions: {}, user_reactions: [] }, ...prev];
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'community_posts' },
                (payload) => {
                    const updated = payload.new as CommunityPost;
                    if (updated && updated.id) {
                        setPosts(prev => prev.map(p => p.id === updated.id ? { ...p, content: updated.content, title: updated.title } : p));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'community_posts' },
                (payload) => {
                    const deletedId = (payload.old as { id: string })?.id;
                    if (deletedId) {
                        setPosts(prev => prev.filter(p => p.id !== deletedId));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'community_comments' },
                (payload) => {
                    const newComment = payload.new as CommunityComment;
                    if (newComment && newComment.post_id) {
                        setCommentsMap(prev => {
                            const existing = prev[newComment.post_id] || [];
                            if (existing.some(c => c.id === newComment.id)) return prev;
                            return {
                                ...prev,
                                [newComment.post_id]: [...existing, newComment]
                            };
                        });
                        setPosts(prev => prev.map(p =>
                            p.id === newComment.post_id
                                ? { ...p, comments_count: (p.comments_count || 0) + 1 }
                                : p
                        ));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'community_comments' },
                (payload) => {
                    const updated = payload.new as CommunityComment;
                    if (updated && updated.post_id) {
                        setCommentsMap(prev => ({
                            ...prev,
                            [updated.post_id]: (prev[updated.post_id] || []).map(c => c.id === updated.id ? updated : c)
                        }));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'community_comments' },
                (payload) => {
                    const deletedId = (payload.old as { id: string })?.id;
                    if (deletedId) {
                        setCommentsMap(prev => {
                            const next = { ...prev };
                            Object.keys(next).forEach(pid => {
                                next[pid] = next[pid].filter(c => c.id !== deletedId);
                            });
                            return next;
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'community_reactions' },
                () => {
                    loadPosts(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen]);

    // Permissions helpers
    const canManagePost = (post: CommunityPost) => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        return !!post.user_id && post.user_id === user.id;
    };

    const canManageComment = (comment: CommunityComment) => {
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        return !!comment.user_id && comment.user_id === user.id;
    };

    // Optimistic post creation
    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = newPostContent.trim();
        if (!content) return;
        if (!user) {
            toast.error('Devi effettuare il login per scrivere un messaggio');
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const optimisticPost: CommunityPost = {
            id: tempId,
            user_id: user.id,
            author_name: user.username || 'Tu',
            author_avatar: user.avatarUrl,
            is_bot: false,
            type: 'USER_POST',
            content,
            created_at: new Date().toISOString(),
            comments_count: 0,
            reactions: {},
            user_reactions: []
        };

        setPosts(prev => [optimisticPost, ...prev]);
        setNewPostContent('');
        setIsPosting(true);

        try {
            const res = await communityFeedService.createPost(content);
            if (res.success && res.post) {
                setPosts(prev => prev.map(p => p.id === tempId ? res.post! : p));
                toast.success('Messaggio lanciato in Curva! 🚀');
            } else {
                setPosts(prev => prev.filter(p => p.id !== tempId));
                toast.error(res.error || 'Errore durante la pubblicazione');
            }
        } catch {
            setPosts(prev => prev.filter(p => p.id !== tempId));
            toast.error('Errore di connessione');
        } finally {
            setIsPosting(false);
        }
    };

    // Optimistic post edit
    const handleSavePostEdit = async (postId: string) => {
        const text = editingPostContent.trim();
        if (!text) return;

        const original = posts.find(p => p.id === postId);
        if (!original) return;

        // Optimistic update
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: text } : p));
        setEditingPostId(null);
        setIsSavingPostEdit(true);

        try {
            const res = await communityFeedService.editPost(postId, text);
            if (res.success) {
                toast.success('Post modificato con successo! ✏️');
            } else {
                setPosts(prev => prev.map(p => p.id === postId ? original : p));
                toast.error(res.error || 'Impossibile modificare il post');
            }
        } catch {
            setPosts(prev => prev.map(p => p.id === postId ? original : p));
            toast.error('Errore durante la modifica');
        } finally {
            setIsSavingPostEdit(false);
        }
    };

    // Optimistic post delete
    const handleDeletePost = async (postId: string) => {
        if (!window.confirm('Sei sicuro di voler eliminare questa inserzione?')) return;

        const original = posts.find(p => p.id === postId);
        // Optimistic removal
        setPosts(prev => prev.filter(p => p.id !== postId));

        try {
            const res = await communityFeedService.deletePost(postId);
            if (res.success) {
                toast.success('Inserzione eliminata! 🗑️');
            } else {
                if (original) setPosts(prev => [original, ...prev]);
                toast.error(res.error || 'Impossibile eliminare il post');
            }
        } catch {
            if (original) setPosts(prev => [original, ...prev]);
            toast.error('Errore durante l\'eliminazione');
        }
    };

    // Optimistic comment edit
    const handleSaveCommentEdit = async (postId: string, commentId: string) => {
        const text = editingCommentContent.trim();
        if (!text) return;

        const original = commentsMap[postId]?.find(c => c.id === commentId);
        if (!original) return;

        // Optimistic update
        setCommentsMap(prev => ({
            ...prev,
            [postId]: (prev[postId] || []).map(c => c.id === commentId ? { ...c, content: text } : c)
        }));
        setEditingCommentId(null);
        setIsSavingCommentEdit(true);

        try {
            const res = await communityFeedService.editComment(commentId, text);
            if (res.success) {
                toast.success('Commento modificato! ✏️');
            } else {
                setCommentsMap(prev => ({
                    ...prev,
                    [postId]: (prev[postId] || []).map(c => c.id === commentId ? original : c)
                }));
                toast.error(res.error || 'Impossibile modificare il commento');
            }
        } catch {
            setCommentsMap(prev => ({
                ...prev,
                [postId]: (prev[postId] || []).map(c => c.id === commentId ? original : c)
            }));
            toast.error('Errore durante la modifica');
        } finally {
            setIsSavingCommentEdit(false);
        }
    };

    // Optimistic comment delete
    const handleDeleteComment = async (postId: string, commentId: string) => {
        if (!window.confirm('Eliminare questo commento?')) return;

        const originalList = commentsMap[postId] || [];
        // Optimistic removal
        setCommentsMap(prev => ({
            ...prev,
            [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
        }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) } : p));

        try {
            const res = await communityFeedService.deleteComment(commentId);
            if (res.success) {
                toast.success('Commento eliminato! 🗑️');
            } else {
                setCommentsMap(prev => ({ ...prev, [postId]: originalList }));
                toast.error(res.error || 'Impossibile eliminare il commento');
            }
        } catch {
            setCommentsMap(prev => ({ ...prev, [postId]: originalList }));
            toast.error('Errore durante l\'eliminazione');
        }
    };

    // Instant optimistic reaction toggle
    const handleToggleReaction = async (postId: string, emoji: string) => {
        if (!user) {
            toast.error('Effettua il login per reagire');
            return;
        }

        setPosts(prev => prev.map(post => {
            if (post.id !== postId) return post;

            const hasReacted = post.user_reactions?.includes(emoji);
            const currentCount = post.reactions?.[emoji] || 0;
            const newCount = hasReacted ? Math.max(0, currentCount - 1) : currentCount + 1;
            const newUserReactions = hasReacted
                ? (post.user_reactions || []).filter(em => em !== emoji)
                : [...(post.user_reactions || []), emoji];

            return {
                ...post,
                reactions: {
                    ...post.reactions,
                    [emoji]: newCount
                },
                user_reactions: newUserReactions
            };
        }));

        communityFeedService.toggleReaction(postId, emoji).catch(err => {
            console.error('Reaction sync error:', err);
        });
    };

    const toggleComments = async (postId: string) => {
        const currentlyOpen = !!expandedComments[postId];
        setExpandedComments(prev => ({ ...prev, [postId]: !currentlyOpen }));

        if (!currentlyOpen && !commentsMap[postId]) {
            const comments = await communityFeedService.getComments(postId);
            setCommentsMap(prev => ({ ...prev, [postId]: comments }));
        }
    };

    // Instant optimistic comment addition
    const handleAddComment = async (postId: string) => {
        const text = commentInputs[postId]?.trim();
        if (!text) return;
        if (!user) {
            toast.error('Effettua il login per commentare');
            return;
        }

        const tempCommentId = `temp-comment-${Date.now()}`;
        const optimisticComment: CommunityComment = {
            id: tempCommentId,
            post_id: postId,
            user_id: user.id,
            username: user.username || 'Tu',
            avatar_url: user.avatarUrl,
            content: text,
            created_at: new Date().toISOString()
        };

        setCommentsMap(prev => ({
            ...prev,
            [postId]: [...(prev[postId] || []), optimisticComment]
        }));
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        setPosts(prev => prev.map(p =>
            p.id === postId
                ? { ...p, comments_count: (p.comments_count || 0) + 1 }
                : p
        ));

        setTimeout(() => {
            const el = commentsContainerRefs.current[postId];
            if (el) el.scrollTop = el.scrollHeight;
        }, 50);

        setIsSubmittingComment(prev => ({ ...prev, [postId]: true }));
        try {
            const res = await communityFeedService.addComment(postId, text);
            if (res.success && res.comment) {
                setCommentsMap(prev => ({
                    ...prev,
                    [postId]: (prev[postId] || []).map(c => c.id === tempCommentId ? res.comment! : c)
                }));
            } else {
                setCommentsMap(prev => ({
                    ...prev,
                    [postId]: (prev[postId] || []).filter(c => c.id !== tempCommentId)
                }));
                setPosts(prev => prev.map(p =>
                    p.id === postId
                        ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) }
                        : p
                ));
                toast.error(res.error || 'Errore invio commento');
            }
        } catch {
            setCommentsMap(prev => ({
                ...prev,
                [postId]: (prev[postId] || []).filter(c => c.id !== tempCommentId)
            }));
            toast.error('Errore di connessione');
        } finally {
            setIsSubmittingComment(prev => ({ ...prev, [postId]: false }));
        }
    };

    if (!isOpen) return null;

    const filteredPosts = posts.filter(p => {
        if (filter === 'BOT') return p.is_bot;
        if (filter === 'USERS') return !p.is_bot;
        return true;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            {/* Modal Container — full-screen on mobile for reachable header */}
            <div className="relative w-full max-w-3xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col rounded-none sm:rounded-3xl border-0 sm:border border-white/15 bg-[#040810] sm:bg-[#040810]/98 shadow-[0_0_80px_rgba(0,0,0,0.95)] overflow-hidden">

                {/* Header — sticky with safe-area padding for mobile notch/status bar */}
                <div
                    className="sticky top-0 z-10 relative flex items-center justify-between px-4 sm:px-6 pb-4 sm:pb-6 border-b border-white/10 bg-gradient-to-r from-brand-teal/15 via-[#040810] to-brand-purple-vibrant/15"
                    style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal to-brand-purple-vibrant shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                            <Flame className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
                                    LA CURVA
                                </h3>
                                <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-400 animate-pulse">
                                    LIVE
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm font-semibold text-gray-300">
                                Il Bar dello Sport: risultati, sorpassi e trash talk tra amici
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => loadPosts(false)}
                            title="Aggiorna bacheca"
                            className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-2 text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                        >
                            <RefreshCw className={`w-5 h-5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-2 text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                        >
                            <X className="w-6 h-6 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 px-4 sm:px-6 py-3 bg-black/50 border-b border-white/5 text-xs sm:text-sm font-black uppercase tracking-wider">
                    <button
                        type="button"
                        onClick={() => setFilter('ALL')}
                        className={`px-3.5 py-1.5 rounded-xl transition-all ${
                            filter === 'ALL'
                                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                : 'text-gray-400 hover:text-white bg-white/5'
                        }`}
                    >
                        Tutti ({posts.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('BOT')}
                        className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                            filter === 'BOT'
                                ? 'bg-yellow-500/25 text-yellow-300 border border-yellow-400/50 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                                : 'text-gray-400 hover:text-white bg-white/5'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Solo FannyBot ({posts.filter(p => p.is_bot).length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('USERS')}
                        className={`px-3.5 py-1.5 rounded-xl transition-all ${
                            filter === 'USERS'
                                ? 'bg-purple-500/25 text-purple-300 border border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                                : 'text-gray-400 hover:text-white bg-white/5'
                        }`}
                    >
                        Utenti ({posts.filter(p => !p.is_bot).length})
                    </button>
                </div>

                {/* Create Post Box */}
                {user ? (
                    <form onSubmit={handleCreatePost} className="p-3 sm:p-4 bg-white/[0.03] border-b border-white/10">
                        <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-full bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center font-black text-cyan-300 text-sm shrink-0">
                                {user.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <input
                                type="text"
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                placeholder="Lancia una frecciatina o commenta la giornata..."
                                className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm sm:text-base text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition"
                            />
                            <button
                                type="submit"
                                disabled={isPosting || !newPostContent.trim()}
                                className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider disabled:opacity-40 transition shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95"
                            >
                                <Send className="w-4 h-4" />
                                <span className="hidden sm:inline">Invia</span>
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="p-3 bg-white/[0.02] border-b border-white/10 text-center text-sm font-semibold text-gray-400">
                        Effettua il login per partecipare al trash talk della Curva!
                    </div>
                )}

                {/* Posts Feed */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
                    {loading && posts.length === 0 ? (
                        <div className="py-20 text-center text-gray-400 font-mono text-sm animate-pulse flex flex-col items-center gap-3">
                            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                            <span>Caricamento messaggi dalla Curva...</span>
                        </div>
                    ) : filteredPosts.length === 0 ? (
                        <div className="py-20 text-center text-gray-400">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30 text-cyan-400" />
                            <p className="font-black italic uppercase tracking-wider text-base">Nessun messaggio in questa categoria</p>
                        </div>
                    ) : (
                        filteredPosts.map(post => {
                            const isExpanded = !!expandedComments[post.id];
                            const postComments = commentsMap[post.id] || [];
                            const isBot = post.is_bot;
                            const isEditingThisPost = editingPostId === post.id;

                            return (
                                <div
                                    key={post.id}
                                    className={`relative rounded-3xl p-5 sm:p-6 border transition-all ${
                                        isBot
                                            ? 'bg-gradient-to-br from-[#0c182c]/95 via-[#07111e]/95 to-[#050b14]/95 border-cyan-400/40 shadow-[0_0_30px_rgba(6,182,212,0.15)]'
                                            : 'bg-white/[0.04] border-white/15 hover:border-white/25 shadow-md'
                                    }`}
                                >
                                    {/* Author row */}
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-3">
                                            {isBot ? (
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 to-yellow-400 p-[2px] shadow-[0_0_14px_rgba(234,179,8,0.4)]">
                                                    <div className="h-full w-full rounded-full bg-[#040810] flex items-center justify-center">
                                                        <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-purple-500/25 border border-purple-500/40 flex items-center justify-center font-black text-sm text-purple-300">
                                                    {post.author_name[0]?.toUpperCase()}
                                                </div>
                                            )}

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-base sm:text-lg font-black tracking-tight ${isBot ? 'text-cyan-300' : 'text-white'}`}>
                                                        {post.author_name}
                                                    </span>
                                                    {isBot && (
                                                        <span className="rounded bg-yellow-400/15 border border-yellow-400/40 px-2 py-0.5 text-[10px] font-black uppercase text-yellow-300 tracking-wider">
                                                            BOT UFFICIALE
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-400 font-mono">
                                                    {new Date(post.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {post.pinned && (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-black text-yellow-300 bg-yellow-400/15 border border-yellow-400/40 px-3 py-1 rounded-full uppercase tracking-wider">
                                                    <Pin className="w-3.5 h-3.5" /> FISSATO
                                                </span>
                                            )}

                                            {/* Post Edit & Delete actions for Author or Admin */}
                                            {canManagePost(post) && (
                                                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                                                    <button
                                                        type="button"
                                                        title="Modifica post"
                                                        onClick={() => {
                                                            setEditingPostId(post.id);
                                                            setEditingPostContent(post.content);
                                                        }}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-300 hover:bg-white/10 transition active:scale-90"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Elimina post"
                                                        onClick={() => handleDeletePost(post.id)}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/15 transition active:scale-90"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Title if present */}
                                    {post.title && (
                                        <h4 className="text-lg sm:text-xl font-black italic tracking-tight text-white mt-1 mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                            {post.title}
                                        </h4>
                                    )}

                                    {/* Content or Inline Edit form */}
                                    {isEditingThisPost ? (
                                        <div className="space-y-3 my-2 bg-black/60 p-4 rounded-2xl border border-cyan-400/50">
                                            <textarea
                                                rows={3}
                                                value={editingPostContent}
                                                onChange={(e) => setEditingPostContent(e.target.value)}
                                                className="w-full bg-black/40 border border-white/20 rounded-xl p-3 text-base text-white focus:outline-none focus:border-cyan-400"
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={isSavingPostEdit || !editingPostContent.trim()}
                                                    onClick={() => handleSavePostEdit(post.id)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 text-black font-black text-xs uppercase tracking-wider hover:bg-cyan-400 transition active:scale-95"
                                                >
                                                    <Check className="w-4 h-4" /> Salva Modifiche
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingPostId(null)}
                                                    className="px-4 py-2 rounded-xl bg-white/10 text-gray-300 font-bold text-xs uppercase tracking-wider hover:bg-white/15 transition"
                                                >
                                                    Annulla
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[15px] sm:text-[17px] md:text-lg text-white/95 leading-relaxed whitespace-pre-wrap font-normal">
                                            {post.content}
                                        </p>
                                    )}

                                    {/* Action Bar: Reactions & Comment Toggle */}
                                    <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                                        {/* Reactions */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            {AVAILABLE_EMOJIS.map(emoji => {
                                                const count = post.reactions?.[emoji] || 0;
                                                const isSelected = post.user_reactions?.includes(emoji);

                                                return (
                                                    <button
                                                        key={emoji}
                                                        type="button"
                                                        onClick={() => handleToggleReaction(post.id, emoji)}
                                                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-all active:scale-90 ${
                                                            isSelected
                                                                ? 'bg-cyan-500/30 border border-cyan-400/70 scale-105 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                                                                : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <span className="text-base sm:text-lg">{emoji}</span>
                                                        {count > 0 && (
                                                            <span className={`text-xs sm:text-sm font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-gray-300'}`}>
                                                                {count}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Comments Toggle Button */}
                                        <button
                                            type="button"
                                            onClick={() => toggleComments(post.id)}
                                            className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-gray-200 hover:text-cyan-300 bg-white/10 px-4 py-2 rounded-xl border border-white/15 hover:border-cyan-400/40 active:scale-95 transition"
                                        >
                                            <MessageSquare className="w-4 h-4 text-cyan-300" />
                                            <span>{post.comments_count || 0} Risposte</span>
                                        </button>
                                    </div>

                                    {/* Inline Comments Section (HIGH READABILITY BUBBLES) */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-white/15 space-y-4 bg-black/50 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-6 rounded-b-3xl">
                                            {postComments.length === 0 ? (
                                                <p className="text-sm sm:text-base text-gray-400 italic text-center py-3">
                                                    Nessuna risposta ancora. Sii il primo a commentare!
                                                </p>
                                            ) : (
                                                <div
                                                    ref={(el) => { commentsContainerRefs.current[post.id] = el; }}
                                                    className="space-y-3.5 max-h-80 overflow-y-auto no-scrollbar pr-1"
                                                >
                                                    {postComments.map(c => {
                                                        const isEditingThisComment = editingCommentId === c.id;

                                                        return (
                                                            <div
                                                                key={c.id}
                                                                className="flex items-start gap-3 bg-[#0d1624] p-3.5 sm:p-4 rounded-2xl border border-cyan-500/25 shadow-md"
                                                            >
                                                                <div className="h-8 w-8 rounded-full bg-cyan-400/25 border border-cyan-400/40 flex items-center justify-center font-black text-xs text-cyan-300 shrink-0">
                                                                    {c.username[0]?.toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm sm:text-base font-black text-white truncate">
                                                                                {c.username}
                                                                            </span>
                                                                            <span className="text-xs text-gray-400 font-mono">
                                                                                {new Date(c.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        </div>

                                                                        {/* Comment Edit & Delete actions for Author or Admin */}
                                                                        {canManageComment(c) && (
                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                <button
                                                                                    type="button"
                                                                                    title="Modifica commento"
                                                                                    onClick={() => {
                                                                                        setEditingCommentId(c.id);
                                                                                        setEditingCommentContent(c.content);
                                                                                    }}
                                                                                    className="p-1 rounded text-gray-400 hover:text-cyan-300 hover:bg-white/10 transition active:scale-90"
                                                                                >
                                                                                    <Pencil className="w-3 h-3" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    title="Elimina commento"
                                                                                    onClick={() => handleDeleteComment(post.id, c.id)}
                                                                                    className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/15 transition active:scale-90"
                                                                                >
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Comment Content or Inline Edit form */}
                                                                    {isEditingThisComment ? (
                                                                        <div className="space-y-2 mt-1 bg-black/40 p-2.5 rounded-xl border border-cyan-400/40">
                                                                            <input
                                                                                type="text"
                                                                                value={editingCommentContent}
                                                                                onChange={(e) => setEditingCommentContent(e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        e.preventDefault();
                                                                                        handleSaveCommentEdit(post.id, c.id);
                                                                                    }
                                                                                }}
                                                                                className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                                                                            />
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={isSavingCommentEdit || !editingCommentContent.trim()}
                                                                                    onClick={() => handleSaveCommentEdit(post.id, c.id)}
                                                                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500 text-black font-black text-xs uppercase hover:bg-cyan-400 transition"
                                                                                >
                                                                                    <Check className="w-3 h-3" /> Salva
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setEditingCommentId(null)}
                                                                                    className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 font-bold text-xs uppercase hover:bg-white/15 transition"
                                                                                >
                                                                                    Annulla
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-[15px] sm:text-base md:text-[17px] text-white/95 leading-relaxed font-normal">
                                                                            {c.content}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Add Comment Input */}
                                            {user && (
                                                <div className="flex items-center gap-2 pt-2">
                                                    <input
                                                        type="text"
                                                        value={commentInputs[post.id] || ''}
                                                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddComment(post.id);
                                                            }
                                                        }}
                                                        placeholder="Rispondi a questa frecciatina..."
                                                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={isSubmittingComment[post.id] || !commentInputs[post.id]?.trim()}
                                                        onClick={() => handleAddComment(post.id)}
                                                        className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white font-black text-xs sm:text-sm uppercase tracking-wider disabled:opacity-40 transition shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95"
                                                    >
                                                        Invia
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

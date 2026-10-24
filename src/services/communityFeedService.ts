import { supabase } from '../supabaseClient';
import type { CommunityPost, CommunityComment, CommunityPostType } from '../types';

export const communityFeedService = {
    /**
     * Get posts with reactions and comment counts
     */
    async getPosts(limit = 35): Promise<CommunityPost[]> {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const currentUserId = sessionData?.session?.user?.id;

            const { data: posts, error } = await supabase
                .from('community_posts')
                .select('*')
                .order('pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.warn('community_posts query returned error:', error.message);
                return this.getFallbackPosts();
            }

            if (!posts || posts.length === 0) {
                return this.getFallbackPosts();
            }

            const postIds = posts.map(p => p.id);

            // Fetch comments count and reactions in parallel for maximum speed
            const [commentsRes, reactionsRes] = await Promise.all([
                supabase
                    .from('community_comments')
                    .select('id, post_id')
                    .in('post_id', postIds),
                supabase
                    .from('community_reactions')
                    .select('post_id, user_id, emoji')
                    .in('post_id', postIds)
            ]);

            const commentsCountMap: Record<string, number> = {};
            (commentsRes.data || []).forEach(c => {
                commentsCountMap[c.post_id] = (commentsCountMap[c.post_id] || 0) + 1;
            });

            const reactionsMap: Record<string, Record<string, number>> = {};
            const userReactionsMap: Record<string, string[]> = {};

            (reactionsRes.data || []).forEach(r => {
                if (!reactionsMap[r.post_id]) reactionsMap[r.post_id] = {};
                reactionsMap[r.post_id][r.emoji] = (reactionsMap[r.post_id][r.emoji] || 0) + 1;

                if (currentUserId && r.user_id === currentUserId) {
                    if (!userReactionsMap[r.post_id]) userReactionsMap[r.post_id] = [];
                    if (!userReactionsMap[r.post_id].includes(r.emoji)) {
                        userReactionsMap[r.post_id].push(r.emoji);
                    }
                }
            });

            return posts.map(p => ({
                ...p,
                comments_count: commentsCountMap[p.id] || 0,
                reactions: reactionsMap[p.id] || {},
                user_reactions: userReactionsMap[p.id] || []
            }));
        } catch (err) {
            console.error('Error fetching community posts:', err);
            return this.getFallbackPosts();
        }
    },

    /**
     * Get the latest post for the Dashboard Ticker
     */
    async getLatestPost(): Promise<CommunityPost | null> {
        const posts = await this.getPosts(5);
        return posts.length > 0 ? posts[0] : null;
    },

    /**
     * Get all comments for a specific post
     */
    async getComments(postId: string): Promise<CommunityComment[]> {
        try {
            const { data, error } = await supabase
                .from('community_comments')
                .select('*')
                .eq('post_id', postId)
                .order('created_at', { ascending: true });

            if (error) {
                console.warn('Error fetching comments:', error.message);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Error in getComments:', err);
            return [];
        }
    },

    /**
     * Post a new message as an authenticated user
     */
    async createPost(content: string, type: CommunityPostType = 'USER_POST', title?: string): Promise<{ success: boolean; post?: CommunityPost; error?: string }> {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const user = sessionData?.session?.user;
            if (!user) return { success: false, error: 'Devi aver effettuato il login per pubblicare.' };

            // Fetch profile username & avatar
            const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', user.id)
                .maybeSingle();

            const username = profile?.username || user.email?.split('@')[0] || 'Utente';
            const avatarUrl = profile?.avatar_url || null;

            const { data, error } = await supabase
                .from('community_posts')
                .insert({
                    user_id: user.id,
                    author_name: username,
                    author_avatar: avatarUrl,
                    is_bot: false,
                    type,
                    title: title || null,
                    content: content.trim()
                })
                .select()
                .single();

            if (error) throw error;
            return {
                success: true,
                post: {
                    ...data,
                    comments_count: 0,
                    reactions: {},
                    user_reactions: []
                }
            };
        } catch (err: any) {
            console.error('Error creating post:', err);
            return { success: false, error: err.message || 'Errore nella creazione del post' };
        }
    },

    /**
     * Create a Bot post (via RPC or direct insert)
     */
    async createBotPost(title: string, content: string, type: CommunityPostType = 'BOT_ALERT', metadata: any = {}, pinned = false): Promise<{ success: boolean }> {
        try {
            const { error: rpcError } = await supabase.rpc('create_community_bot_post', {
                p_title: title,
                p_content: content,
                p_type: type,
                p_metadata: metadata,
                p_pinned: pinned
            });

            if (!rpcError) return { success: true };

            // Fallback direct insert if RPC fails or not yet created
            const { error: insertError } = await supabase
                .from('community_posts')
                .insert({
                    author_name: 'FannyBot',
                    author_avatar: '/logo.png',
                    is_bot: true,
                    type,
                    title,
                    content,
                    metadata,
                    pinned
                });

            if (insertError) throw insertError;
            return { success: true };
        } catch (err) {
            console.error('Error creating bot post:', err);
            return { success: false };
        }
    },

    /**
     * Add a comment to a post
     */
    async addComment(postId: string, content: string): Promise<{ success: boolean; comment?: CommunityComment; error?: string }> {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const user = sessionData?.session?.user;
            if (!user) return { success: false, error: 'Devi aver effettuato il login per commentare.' };

            const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', user.id)
                .maybeSingle();

            const username = profile?.username || user.email?.split('@')[0] || 'Utente';
            const avatarUrl = profile?.avatar_url || null;

            const { data, error } = await supabase
                .from('community_comments')
                .insert({
                    post_id: postId,
                    user_id: user.id,
                    username,
                    avatar_url: avatarUrl,
                    content: content.trim()
                })
                .select()
                .single();

            if (error) throw error;
            return { success: true, comment: data };
        } catch (err: any) {
            console.error('Error adding comment:', err);
            return { success: false, error: err.message || 'Errore durante l\'invio del commento' };
        }
    },

    /**
     * Toggle an emoji reaction on a post
     */
    async toggleReaction(postId: string, emoji: string): Promise<{ success: boolean; action: 'added' | 'removed' }> {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const user = sessionData?.session?.user;
            if (!user) return { success: false, action: 'removed' };

            // Check if already reacted
            const { data: existing } = await supabase
                .from('community_reactions')
                .select('id')
                .eq('post_id', postId)
                .eq('user_id', user.id)
                .eq('emoji', emoji)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('community_reactions')
                    .delete()
                    .eq('id', existing.id);
                return { success: true, action: 'removed' };
            } else {
                await supabase
                    .from('community_reactions')
                    .insert({
                        post_id: postId,
                        user_id: user.id,
                        emoji
                    });
                return { success: true, action: 'added' };
            }
        } catch (err) {
            console.error('Error toggling reaction:', err);
            return { success: false, action: 'removed' };
        }
    },

    /**
     * Edit a post content
     */
    async editPost(postId: string, newContent: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('community_posts')
                .update({ content: newContent.trim() })
                .eq('id', postId);

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('Error editing post:', err);
            return { success: false, error: err.message || 'Errore durante la modifica del post' };
        }
    },

    /**
     * Delete a post
     */
    async deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('community_posts')
                .delete()
                .eq('id', postId);

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('Error deleting post:', err);
            return { success: false, error: err.message || 'Errore durante l\'eliminazione del post' };
        }
    },

    /**
     * Edit a comment content
     */
    async editComment(commentId: string, newContent: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('community_comments')
                .update({ content: newContent.trim() })
                .eq('id', commentId);

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('Error editing comment:', err);
            return { success: false, error: err.message || 'Errore durante la modifica del commento' };
        }
    },

    /**
     * Delete a comment
     */
    async deleteComment(commentId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('community_comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('Error deleting comment:', err);
            return { success: false, error: err.message || 'Errore durante l\'eliminazione del commento' };
        }
    },

    /**
     * Fallback initial post if table is empty or while migration is being applied
     */
    getFallbackPosts(): CommunityPost[] {
        return [
            {
                id: 'welcome-bot-post',
                author_name: 'FannyBot',
                author_avatar: '/logo.png',
                is_bot: true,
                type: 'BOT_ALERT',
                title: 'Benvenuti ne La Curva di FannyBet! 🏟️🔥',
                content: 'Benvenuti nello spazio ufficiale di sfottò, meme e commenti a caldo sulle partite! Qui pubblicherò in tempo reale risultati, sorpassi in classifica, cucchiai di legno e miracoli dell\'ultimo minuto. Mettetevi comodi... e che vinca il migliore (o il più gufo)! 🦉🍿',
                pinned: true,
                created_at: new Date().toISOString(),
                comments_count: 0,
                reactions: { '🔥': 4, '🦉': 2, '🍿': 3 },
                user_reactions: []
            }
        ];
    }
};

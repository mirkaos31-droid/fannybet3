import { supabase } from '../supabaseClient';

export type MuralesColor =
    | 'neon-cyan'
    | 'acid-green'
    | 'hot-pink'
    | 'electric-purple'
    | 'sun-orange'
    | 'pure-white';

export type MuralesFontStyle = 'spray' | 'stencil' | 'marker' | 'drip' | 'neon';

export interface MuralesTag {
    id: string;
    user_id: string | null;
    username: string;
    avatar_url?: string | null;
    message: string;
    color: MuralesColor;
    font_style: MuralesFontStyle;
    rotation: number;
    pos_x: number;
    pos_y: number;
    scale: number;
    likes_count: number;
    created_at: string;
    user_has_liked?: boolean;
}

export const muralesService = {
    async getTags(limit = 100): Promise<MuralesTag[]> {
        const { data, error } = await supabase
            .from('murales_tags')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching murales tags:', error);
            return [];
        }

        const { data: { user } } = await supabase.auth.getUser();

        if (user && data && data.length > 0) {
            const tagIds = data.map(t => t.id);
            const { data: reactions } = await supabase
                .from('murales_reactions')
                .select('tag_id')
                .eq('user_id', user.id)
                .in('tag_id', tagIds);

            const likedSet = new Set((reactions || []).map(r => r.tag_id));
            return data.map(tag => ({
                ...tag,
                user_has_liked: likedSet.has(tag.id)
            }));
        }

        return data || [];
    },

    async createTag(params: {
        message: string;
        color: MuralesColor;
        font_style: MuralesFontStyle;
        rotation?: number;
        pos_x?: number;
        pos_y?: number;
        scale?: number;
    }): Promise<{ success: boolean; tag?: MuralesTag; error?: string }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Devi essere autenticato' };

        // Prendi profilo utente per username e avatar
        const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', user.id)
            .single();

        const username = profile?.username || user.email?.split('@')[0] || 'Graffiti Artist';
        const avatar_url = profile?.avatar_url || null;

        // Se non specificata, rotazione casuale tra -8 e +8 gradi per realismo
        const rotation = params.rotation !== undefined
            ? params.rotation
            : Number(((Math.random() * 16) - 8).toFixed(1));

        const pos_x = params.pos_x !== undefined ? params.pos_x : 50;
        const pos_y = params.pos_y !== undefined ? params.pos_y : 50;
        const scale = params.scale || 1.0;

        const { data, error } = await supabase
            .from('murales_tags')
            .insert([{
                user_id: user.id,
                username,
                avatar_url,
                message: params.message.trim(),
                color: params.color,
                font_style: params.font_style,
                rotation,
                pos_x,
                pos_y,
                scale
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating murales tag:', error);
            return { success: false, error: error.message };
        }

        return { success: true, tag: data };
    },

    async toggleReaction(tagId: string): Promise<{ liked: boolean; newCount: number }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { liked: false, newCount: 0 };

        // Verifica se ha già reagito
        const { data: existing } = await supabase
            .from('murales_reactions')
            .select('id')
            .eq('tag_id', tagId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (existing) {
            // Rimuovi reazione
            await supabase
                .from('murales_reactions')
                .delete()
                .eq('id', existing.id);

            // Decrementa conteggio tag
            const { data: tag } = await supabase
                .from('murales_tags')
                .select('likes_count')
                .eq('id', tagId)
                .single();

            const newCount = Math.max(0, (tag?.likes_count || 1) - 1);
            await supabase
                .from('murales_tags')
                .update({ likes_count: newCount })
                .eq('id', tagId);

            return { liked: false, newCount };
        } else {
            // Aggiungi reazione
            await supabase
                .from('murales_reactions')
                .insert([{
                    tag_id: tagId,
                    user_id: user.id,
                    reaction_type: 'fire'
                }]);

            // Incrementa conteggio tag
            const { data: tag } = await supabase
                .from('murales_tags')
                .select('likes_count')
                .eq('id', tagId)
                .single();

            const newCount = (tag?.likes_count || 0) + 1;
            await supabase
                .from('murales_tags')
                .update({ likes_count: newCount })
                .eq('id', tagId);

            return { liked: true, newCount };
        }
    },

    async deleteTag(tagId: string): Promise<boolean> {
        const { error } = await supabase
            .from('murales_tags')
            .delete()
            .eq('id', tagId);

        return !error;
    }
};


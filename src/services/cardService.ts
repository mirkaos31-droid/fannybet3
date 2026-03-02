import { supabase } from '../supabaseClient';

export interface CollectibleCard {
    id: string;
    title: string;
    description: string;
    image_url: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    category: string;
    metadata: any;
    unlocked?: boolean;
    unlocked_at?: string;
    seen_in_gallery?: boolean;
}

export const cardService = {
    async getAllCards(): Promise<CollectibleCard[]> {
        const { data: cards, error } = await supabase
            .from('collectible_cards')
            .select('*')
            .order('rarity', { ascending: false });

        if (error) throw error;

        const { data: userAuth } = await supabase.auth.getUser();
        if (!userAuth.user) return cards;

        const { data: userCards } = await supabase
            .from('user_cards')
            .select('card_id, unlocked_at, seen_in_gallery')
            .eq('user_id', userAuth.user.id);

        const unlockedIds = new Set((userCards || []).map(uc => uc.card_id));
        const unlockMap = new Map((userCards || []).map(uc => [uc.card_id, {
            at: uc.unlocked_at,
            seen: uc.seen_in_gallery
        }]));

        return cards.map(card => {
            const unlockInfo = unlockMap.get(card.id);
            return {
                ...card,
                unlocked: unlockedIds.has(card.id),
                unlocked_at: unlockInfo?.at,
                seen_in_gallery: unlockInfo?.seen ?? true // Mark as seen if not found or default
            };
        });
    },

    async markAllAsSeen(): Promise<void> {
        await supabase.rpc('mark_cards_as_seen');
    },

    async unlockCard(cardId: string): Promise<boolean> {
        const { data: userAuth } = await supabase.auth.getUser();
        if (!userAuth.user) return false;

        const { error } = await supabase
            .from('user_cards')
            .insert({
                user_id: userAuth.user.id,
                card_id: cardId
            });

        return !error;
    }
};

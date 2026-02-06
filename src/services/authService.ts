import { supabase } from '../supabaseClient';
import type { User } from '../types';

export const authService = {
    login: async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) return { user: null, error: error.message };
        if (!data.user) return { user: null, error: "No user data" };

        // Fetch profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (!profile) return { user: null, error: "Profile not found" };

        return {
            user: {
                id: profile.id,
                username: profile.username,
                role: profile.role as 'ADMIN' | 'USER',
                tokens: profile.tokens,
                email: data.user.email,
                createdAt: profile.created_at,
                avatarUrl: profile.avatar_url,
                wins1x2: profile.wins_1x2,
                winsSurvival: profile.wins_survival,
                level: profile.level,
                predictionAccuracy: profile.prediction_accuracy,
                betsPlaced: profile.bets_placed,
                totalTokensWon: profile.total_tokens_won,
                totalPoints: profile.total_points
            },
            error: null
        };
    },

    signUp: async (username: string, email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username } // Passed to handle_new_user trigger
            }
        });

        if (error) return { user: null, error: error.message };
        if (!data.user) return { user: null, error: "Signup failed" };

        // Profile is auto-created by trigger, but might take a ms. 
        // We return basic info immediately.
        return {
            user: {
                id: data.user.id,
                username,
                role: 'USER',
                tokens: 100,
                email: data.user.email,
                wins1x2: 0,
                winsSurvival: 0,
                level: 1,
                predictionAccuracy: 0,
                betsPlaced: 0,
                totalTokensWon: 0,
                totalPoints: 0
            },
            error: null
        };
    },

    logout: async () => {
        await supabase.auth.signOut();
    },

    getCurrentUser: async (): Promise<User | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!profile) return null;

        return {
            id: profile.id,
            username: profile.username,
            role: profile.role as 'ADMIN' | 'USER',
            tokens: profile.tokens,
            email: user.email,
            createdAt: profile.created_at,
            avatarUrl: profile.avatar_url,
            wins1x2: profile.wins_1x2,
            winsSurvival: profile.wins_survival,
            level: profile.level,
            predictionAccuracy: profile.prediction_accuracy,
            betsPlaced: profile.bets_placed,
            totalTokensWon: profile.total_tokens_won,
            totalPoints: profile.total_points
        };
    },

    updateProfile: async (username: string, avatarUrl?: string): Promise<{ success: boolean; message: string }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Non loggato" };

        const updates: { username: string; updated_at: string; avatar_url?: string } = {
            username,
            updated_at: new Date().toISOString()
        };
        if (avatarUrl) updates.avatar_url = avatarUrl;

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: "Profilo aggiornato con successo" };
    },

    uploadAvatar: async (file: File): Promise<{ success: boolean; url?: string; message: string }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Non loggato" };

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) {
            return { success: false, message: "Caricamento fallito: " + uploadError.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        return { success: true, url: publicUrl, message: "Immagine caricata" };
    },

    // --- USER MANAGEMENT (ADMIN ONLY) ---
    getAllUsers: async (): Promise<{ id: string; username: string; email: string; tokens: number; role: string; created_at: string }[]> => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email, tokens, role, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        return (data || []) as { id: string; username: string; email: string; tokens: number; role: string; created_at: string }[];
    },

    updateUserTokens: async (userId: string, tokenAmount: number): Promise<boolean> => {
        const { data: current } = await supabase
            .from('profiles')
            .select('tokens')
            .eq('id', userId)
            .single();

        if (!current) return false;

        const newTokens = Math.max(0, (current.tokens || 0) + tokenAmount);

        const { error } = await supabase
            .from('profiles')
            .update({ tokens: newTokens })
            .eq('id', userId);

        return !error;
    },

    deleteUserProfile: async (userId: string): Promise<boolean> => {
        // Use the secure RPC function instead of client-side admin API (which isn't available in browser)
        const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });
        if (error) {
            console.error('Error deleting user:', error);
            return false;
        }
        return true;
    },

    updateUserRole: async (userId: string, newRole: 'ADMIN' | 'USER'): Promise<boolean> => {
        const { error } = await supabase.rpc('update_user_role', { target_user_id: userId, new_role: newRole });
        if (error) {
            console.error('Error updating role:', error);
            return false;
        }
        return true;
    },

    syncEmails: async (): Promise<void> => {
        await supabase.rpc('sync_user_emails');
    },
};

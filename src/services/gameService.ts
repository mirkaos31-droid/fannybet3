import { authService } from './authService';
import { bettingService } from './bettingService';
import { survivalService } from './survivalService';
import { commonService } from './commonService';
import { fbLegaService } from './fbLegaService';
import { supabase } from '../supabaseClient';

// Facade pattern: Re-export everything as a sigle gameService object
export const gameService = {
    ...authService,
    ...commonService,
    ...bettingService,
    ...survivalService,
    ...fbLegaService,
    updateJollyMatch: async (matchdayId: number, idx: number) => {
        const { error } = await supabase.from('matchdays').update({ jolly_match_index: idx }).eq('id', matchdayId);
        return { success: !error, message: error?.message };
    }
};

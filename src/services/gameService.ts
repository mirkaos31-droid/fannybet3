import { authService } from './authService';
import { bettingService } from './bettingService';
import { survivalService } from './survivalService';
import { duelService } from './duelService';

// Facade pattern: Re-export everything as a sigle gameService object
export const gameService = {
    ...authService,
    ...bettingService,
    ...survivalService,
    ...duelService
};

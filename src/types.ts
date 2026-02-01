export type UserRole = 'ADMIN' | 'USER';

export interface User {
    id: string;
    username: string;
    tokens: number;
    role: UserRole;
    email?: string;
    createdAt?: string;
    avatarUrl?: string;
    wins1x2: number;
    winsSurvival: number;
    level: number;
    predictionAccuracy: number;
    betsPlaced: number;
    totalTokensWon: number;
    totalPoints: number;
}

export type League = 'SERIE A' | 'CUSTOM';

export type ViewMode = 'HOME' | 'BETTING' | 'SPY' | 'LEADERBOARD' | 'SURVIVAL' | 'PROFILE' | 'DUEL_ARENA';

export interface Duel {
    id: string;
    matchdayId: number;
    challenger: {
        id: string;
        username: string;
        avatarUrl?: string;
    };
    opponent: {
        id: string;
        username: string;
        avatarUrl?: string;
    };
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED';
    scores?: {
        challenger_score: number;
        opponent_score: number;
    };
    winnerId?: string;
    createdAt: string;
}

export interface Match {
    id: number;
    home: string;
    away: string;
    league: League;
}

export interface Matchday {
    id: number;
    matches: Match[]; // Array of 12 matches
    results: (string | null)[]; // 1X2 or null if not played

    // Monetary logic
    superJackpot: number; // Set by admin (e.g. 1000)
    currentPot: number; // Accumulates +1 token per bet
    rolloverPot: number;

    status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
    deadline: string; // ISO Date
}

export interface Bet {
    id: string;
    username: string;
    avatarUrl?: string;
    level?: number;
    matchdayId: number;
    predictions: string[]; // Array of 12 "1", "X", or "2"
    includeSuperJackpot: boolean;
    timestamp: string;
}

export interface SurvivalPlayer {
    id: string | number;
    userId: string;
    username: string;
    status: 'ALIVE' | 'ELIMINATED' | 'WINNER';
    usedTeams: string[];
    tokens: number;
    avatarUrl?: string;
    eliminatedAt?: number;
    currentPick?: string;
}

export interface SurvivalPick {
    player_id: string | number;
    team: string;
    result: string | null;
}

export interface SurvivalSeason {
    id: number;
    status: 'OPEN' | 'ACTIVE' | 'COMPLETED';
    prizePool: number;
    startMatchdayId?: number;
    currentMatch?: {
        myPick?: string;
        myStatus?: 'PENDING' | 'WIN' | 'ELIMINATED';
    };
}

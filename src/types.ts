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

export type ViewMode = 'HOME' | 'BETTING' | 'SPY' | 'LEADERBOARD' | 'SURVIVAL' | 'PROFILE' | 'FB_LEGA';

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

    // Betting control
    betsLocked?: boolean;

    // Post-processing metadata
    winners?: string[]; // Array of winner usernames (populated after archive)
    winnerAnimation?: boolean; // Show animation for winners
    leaderboardAnimation?: boolean; // Show animation on leaderboard
    jollyMatchIndex?: number; // 0-indexed index of the Jolly Match (1-10) for FB Lega
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
    entryFee?: number;
    startMatchdayId?: number;
    startMatchdayDeadline?: string;
    finishedAt?: string;
    winner?: {
        username: string;
        avatarUrl?: string;
        prize: number;
    };
    currentMatch?: {
        myPick?: string;
        myStatus?: 'PENDING' | 'WIN' | 'ELIMINATED';
    };
}

export interface FBLeague {
    id: number;
    name: string;
    admin_id: string;
    entry_fee: number;
    duration_matchdays: number;
    current_round: number;
    start_matchday_id: number;
    scoring_rules: Record<string, number>;
    prize_distribution: number[];
    status: 'OPEN' | 'ACTIVE' | 'COMPLETED';
    prize_pool: number;
    created_at: string;
    participant_count?: number;
    is_member?: boolean;
}

export interface FBLeagueParticipant {
    league_id: number;
    user_id: string;
    total_points: number;
    joined_at: string;
    username?: string;
    live_points?: number;
}

export interface FBLeaguePick {
    id: number;
    league_id: number;
    user_id: string;
    matchday_id: number;
    predictions: string[];
    points_earned: number | null;
    created_at: string;
}

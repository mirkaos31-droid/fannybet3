import { useState, useEffect } from 'react';

export interface CountdownState {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    isExpired: boolean;
    isUrgent: boolean;
    totalRemainingMs: number;
}

/**
 * Calculates time remaining with a strict floor clamp at zero:
 * It will NEVER produce negative numbers, NaN, or weird roll-overs.
 */
export const calculateTimeLeft = (deadlineIso?: string | null, isLocked = false): CountdownState => {
    const zeroState: CountdownState = {
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00',
        isExpired: true,
        isUrgent: false,
        totalRemainingMs: 0
    };

    if (!deadlineIso || isLocked) {
        return zeroState;
    }

    const target = new Date(deadlineIso).getTime();
    if (isNaN(target)) {
        return zeroState;
    }

    const now = Date.now();
    const diff = target - now;

    // Strict clamp: once target time arrives or passes, permanently freeze at 00:00:00:00
    if (diff <= 0) {
        return zeroState;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    const pad = (n: number) => n.toString().padStart(2, '0');

    return {
        days: pad(d),
        hours: pad(h),
        minutes: pad(m),
        seconds: pad(s),
        isExpired: false,
        isUrgent: diff < 2 * 60 * 60 * 1000, // Less than 2 hours remaining
        totalRemainingMs: diff
    };
};

export const useCountdown = (deadlineIso?: string | null, isLocked = false): CountdownState => {
    const [state, setState] = useState<CountdownState>(() => calculateTimeLeft(deadlineIso, isLocked));

    useEffect(() => {
        // Initial tick
        const initial = calculateTimeLeft(deadlineIso, isLocked);
        setState(initial);

        // If already expired or locked, no interval needed
        if (initial.isExpired) {
            return;
        }

        const interval = setInterval(() => {
            const current = calculateTimeLeft(deadlineIso, isLocked);
            setState(current);

            // Once it expires, stop the interval immediately
            if (current.isExpired) {
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [deadlineIso, isLocked]);

    return state;
};

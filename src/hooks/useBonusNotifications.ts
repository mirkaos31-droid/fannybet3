import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface BonusAchievement {
  type: 'strike' | 'en_plein' | 'jolly' | 'perfect_round' | 'leaderboard_gain' | 'leaderboard_top';
  points: number;
  description: string;
}

interface UseBonusNotificationsProps {
  leagueId: number;
  userId: string | undefined;
  participants: Array<{
    user_id: string;
    username?: string;
    total_points: number;
    live_points?: number;
  }>;
  matchdayId: number | undefined;
}

export const useBonusNotifications = ({
  leagueId,
  userId,
  participants,
  matchdayId
}: UseBonusNotificationsProps) => {
  const previousLivePointsRef = useRef<Record<string, number>>({});
  const previousPositionRef = useRef<number | null>(null);

  useEffect(() => {
    // Non fare nulla se non abbiamo dati validi
    if (!userId || !participants.length || !matchdayId) return;

    // Initialize previous points and position if not set
    if (Object.keys(previousLivePointsRef.current).length === 0) {
      participants.forEach(p => {
        previousLivePointsRef.current[p.user_id] = p.live_points || 0;
      });

      // Set initial position
      const sortedParticipants = [...participants].sort((a, b) => b.total_points - a.total_points);
      const userIndex = sortedParticipants.findIndex(p => p.user_id === userId);
      if (userIndex !== -1) {
        previousPositionRef.current = userIndex + 1; // 1-based position
      }

      return;
    }

    // Check for bonus achievements
    participants.forEach(participant => {
      const previousPoints = previousLivePointsRef.current[participant.user_id] || 0;
      const currentPoints = participant.live_points || 0;
      const pointsDiff = currentPoints - previousPoints;

      // Only check for user's own achievements
      if (participant.user_id !== userId || pointsDiff <= 0) {
        previousLivePointsRef.current[participant.user_id] = currentPoints;
        return;
      }

      // Analyze what bonus was achieved based on points gained
      const achievements: BonusAchievement[] = [];

      // Check for En Plein (+10 points)
      if (pointsDiff >= 10 && currentPoints >= 10) {
        achievements.push({
          type: 'en_plein',
          points: 10,
          description: 'EN PLEIN! Tutti i pronostici corretti! 🎯'
        });
      }

      // Check for Strike (+3 points)
      if (pointsDiff >= 3 && pointsDiff < 10 && (pointsDiff - 3) % 3 !== 0) {
        achievements.push({
          type: 'strike',
          points: 3,
          description: 'STRIKE! 3 risultati consecutivi! ⚡'
        });
      }

      // Check for Jolly (+2 points extra)
      if (pointsDiff >= 2 && pointsDiff < 10) {
        // This is a simplified check - in reality we'd need more context
        achievements.push({
          type: 'jolly',
          points: 2,
          description: 'JOLLY! Pronostico jolly corretto! ⭐'
        });
      }

      // Show notifications for achievements
      achievements.forEach(achievement => {
        setTimeout(() => {
          toast.success(achievement.description, {
            duration: 5000,
            style: {
              background: 'linear-gradient(135deg, #1a2c38 0%, #2d5a6b 100%)',
              border: '1px solid #5d8aa8',
              color: '#bfff00',
              fontWeight: '900',
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            },
            icon: '🏆'
          });
        }, Math.random() * 1000); // Slight delay to avoid notification spam
      });

      // Update previous points
      previousLivePointsRef.current[participant.user_id] = currentPoints;
    });

    // Check for leaderboard position changes
    const sortedParticipants = [...participants].sort((a, b) => b.total_points - a.total_points);
    const currentPosition = sortedParticipants.findIndex(p => p.user_id === userId) + 1; // 1-based

    if (previousPositionRef.current !== null && currentPosition !== previousPositionRef.current) {
      const positionDiff = previousPositionRef.current - currentPosition;
      const achievements: BonusAchievement[] = [];

      if (positionDiff > 0) {
        // Improved position
        if (currentPosition === 1) {
          achievements.push({
            type: 'leaderboard_top',
            points: 0,
            description: `🏆 PRIMO POSTO! Sei in testa alla classifica!`
          });
        } else if (positionDiff >= 3) {
          achievements.push({
            type: 'leaderboard_gain',
            points: 0,
            description: `📈 +${positionDiff} posizioni! Ora sei ${currentPosition}°`
          });
        } else {
          achievements.push({
            type: 'leaderboard_gain',
            points: 0,
            description: `⬆️ Sali alla ${currentPosition}° posizione!`
          });
        }
      }

      // Show position change notifications
      achievements.forEach((achievement, index) => {
        setTimeout(() => {
          toast.success(achievement.description, {
            duration: 6000,
            style: {
              background: 'linear-gradient(135deg, #1a2c38 0%, #2d5a6b 100%)',
              border: '1px solid #5d8aa8',
              color: '#bfff00',
              fontWeight: '900',
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            },
            icon: achievement.type === 'leaderboard_top' ? '🏆' : '📈'
          });
        }, index * 1500); // Stagger notifications
      });

      previousPositionRef.current = currentPosition;
    }
  }, [participants, userId, leagueId, matchdayId]);
};
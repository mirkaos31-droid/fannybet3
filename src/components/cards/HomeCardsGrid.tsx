import React from 'react';
import { HomeCard } from './HomeCard';
import { Zap, Eye, Trophy, Skull, Shield } from 'lucide-react';
import type { ViewMode } from '../../types';

interface HomeCardsGridProps {
  setView: (v: ViewMode) => void;
  survivalStatus: 'ALIVE' | 'ELIMINATED' | 'WINNER' | null;
}

export const HomeCardsGrid: React.FC<HomeCardsGridProps> = ({ setView, survivalStatus }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 animate-fade-in px-1 md:px-0 pb-10">
      <HomeCard
        title="1X2 MODE"
        subtitle="Open Markets"
        onClick={() => setView('BETTING')}
        className="card-acid-green"
        icon={<Zap size={48} className="text-acid-glow" strokeWidth={2.5} />}
      />

      <HomeCard
        title="I FANNIES"
        subtitle="spia i tuoi avversari"
        onClick={() => setView('SPY')}
        className="card-bright-yellow"
        icon={<Eye size={48} className="text-[#ffee00]" strokeWidth={2.5} />}
      />

      <HomeCard
        title="CLASSIFICA"
        subtitle="Global Rank"
        onClick={() => setView('LEADERBOARD')}
        className="card-purple"
        icon={<Trophy size={48} className="text-brand-purple" strokeWidth={2.5} />}
      />

      <HomeCard
        title="SURVIVAL MODE"
        subtitle="Operation Active"
        onClick={() => setView('SURVIVAL')}
        className="card-bright-red"
        icon={<Skull size={48} className="text-[#ff2200]" strokeWidth={2.5} />}
        badge={
          survivalStatus === 'ALIVE' ? (
            <div className="px-1.5 py-0.5 rounded bg-red-500 text-black text-[6px] font-black animate-pulse">IN VITA</div>
          ) : undefined
        }
      />

      <HomeCard
        title="FB LEGA"
        subtitle="scopri la novità"
        onClick={() => setView('FB_LEGA')}
        className="card-lega-alieno"
        icon={<Shield size={48} className="text-acid-glow drop-shadow-[0_0_10px_rgba(93,138,168,0.5)]" strokeWidth={2.5} />}
      />
    </div>
  );
};

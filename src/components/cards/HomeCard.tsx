import React from 'react';

interface HomeCardProps {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

export const HomeCard: React.FC<HomeCardProps> = ({ title, subtitle, onClick, className = '', badge, icon }) => {
  return (
    <button
      onClick={onClick}
      className={`glass-card ${className} group h-40 sm:h-64 md:h-96 flex flex-col justify-center items-center text-center relative overflow-hidden touch-target`}
    >
      {badge && <div className="absolute top-2 right-2 z-10">{badge}</div>}

      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 blur-[60px] rounded-full group-hover:opacity-100 transition-all duration-700" />

      <div className="mb-2 group-hover:scale-110 transition-transform duration-500">{icon}</div>

      <h3 className="text-sm sm:text-base md:text-xl font-black italic tracking-tighter text-white/90 uppercase">{title}</h3>
      {subtitle && (
        <p className="text-gray-600 text-[6px] sm:text-[7px] md:text-[9px] mt-1 uppercase tracking-[0.2em] font-black group-hover:text-white transition-colors">{subtitle}</p>
      )}
    </button>
  );
};

import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 md:space-y-12 animate-fade-in no-scrollbar pb-24 md:pb-10">
            {/* Hero Section Skeleton */}
            <div className="relative pt-[6.4rem] pb-6 md:pt-[7.2rem] md:pb-16 text-center px-2 flex flex-col items-center">
                <Skeleton width={120} height={16} className="mb-4" />
                <Skeleton width="80%" height={120} className="rounded-xl !bg-white/5" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-12 px-2 md:px-0 max-w-5xl mx-auto w-full">
                <Skeleton height={100} className="rounded-xl" />
                <Skeleton height={100} className="rounded-xl" />
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-4 gap-3 md:gap-8 px-2 md:px-0 pb-16 items-start w-full">
                {/* 1x2 Left */}
                <Skeleton className="col-span-2 row-span-2 h-[26rem] sm:h-[45rem] md:h-[62rem] rounded-2xl" />

                {/* Survival Top Right */}
                <Skeleton className="col-span-2 h-[13.5rem] sm:h-[24rem] md:h-[34rem] rounded-2xl" />

                {/* Fannies */}
                <Skeleton className="col-span-1 h-[11.5rem] sm:h-[20rem] md:h-[26rem] rounded-2xl" />

                {/* Leaderboard */}
                <Skeleton className="col-span-1 h-[11.5rem] sm:h-[20rem] md:h-[26rem] rounded-2xl" />

                {/* Duels Bottom */}
                <Skeleton className="col-span-4 h-[16.5rem] sm:h-[28rem] md:h-[36rem] rounded-2xl" />
            </div>
        </div>
    );
};

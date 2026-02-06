import React from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    variant?: 'text' | 'rectangular' | 'circular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    width,
    height,
    variant = 'rectangular'
}) => {
    const baseClasses = "animate-pulse bg-white/10 rounded-md";
    const variantClasses = variant === 'circular' ? 'rounded-full' : '';

    const style: React.CSSProperties = {
        width: width,
        height: height,
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses} ${className}`}
            style={style}
        />
    );
};

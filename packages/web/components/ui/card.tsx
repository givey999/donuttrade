import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  children: ReactNode;
}

export function Card({ hover, children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-[#1a1a1a] bg-white/[0.02] ${hover ? 'transition-transform duration-200 hover:scale-[1.02]' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

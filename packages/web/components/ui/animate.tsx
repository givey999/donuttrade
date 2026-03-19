import type { ReactNode, CSSProperties } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, className = '' }: FadeInProps) {
  const style: CSSProperties = delay > 0 ? { animationDelay: `${delay}ms` } : {};

  return (
    <div
      className={`animate-fade-in ${delay > 0 ? 'opacity-0 [animation-fill-mode:forwards]' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

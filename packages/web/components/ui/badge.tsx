import type { ReactNode } from 'react';

const VARIANT_CLASSES: Record<string, string> = {
  success: 'border-green-900/50 bg-green-950/20 text-green-400',
  warning: 'border-violet-950/50 bg-violet-950/20 text-violet-500',
  danger: 'border-red-900/50 bg-red-950/20 text-red-400',
  info: 'border-blue-900/50 bg-blue-950/20 text-blue-400',
  purple: 'border-purple-900/50 bg-purple-950/20 text-purple-400',
  orange: 'border-orange-900/50 bg-orange-950/20 text-orange-400',
  neutral: 'border-neutral-700 bg-neutral-800/50 text-neutral-400',
  emerald: 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400',
  violet: 'border-violet-600/30 bg-violet-600/[0.08] text-violet-600',
};

interface BadgeProps {
  variant?: keyof typeof VARIANT_CLASSES;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.neutral} ${className}`}>
      {children}
    </span>
  );
}

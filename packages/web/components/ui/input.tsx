import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg border border-[#1a1a1a] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-neutral-600 transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={`rounded-lg border border-[#1a1a1a] bg-[#141418] px-3 py-2 text-sm text-white transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50 [&>option]:bg-[#141418] [&>option]:text-white ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

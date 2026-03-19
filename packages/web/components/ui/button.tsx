import type { ReactNode, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-amber-500 text-[#0a0a0f] font-semibold hover:bg-amber-600 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  secondary: 'border border-[#1a1a1a] bg-white/[0.03] text-neutral-300 hover:bg-white/[0.06] hover:text-white',
  danger: 'border border-red-900/50 bg-red-950/20 text-red-400 hover:bg-red-950/40',
  ghost: 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200',
  success: 'border border-green-800/50 bg-green-600/10 text-green-400 hover:bg-green-600/20',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

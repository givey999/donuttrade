import type { ReactNode } from 'react';

interface LoginButtonProps {
  href: string;
  icon: ReactNode;
  label: string;
  className?: string;
}

export function LoginButton({ href, icon, label, className = '' }: LoginButtonProps) {
  return (
    <a
      href={href}
      className={`flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${className}`}
    >
      {icon}
      {label}
    </a>
  );
}

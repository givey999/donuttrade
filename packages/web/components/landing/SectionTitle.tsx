interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionTitle({ children, className = '' }: SectionTitleProps) {
  return (
    <h2
      className={`text-center font-vt323 text-[52px] tracking-wide text-white leading-none mt-1 mb-2 ${className}`}
    >
      {children}
    </h2>
  );
}

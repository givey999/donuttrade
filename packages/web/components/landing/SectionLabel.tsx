interface SectionLabelProps {
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="text-center font-vt323 text-[14px] tracking-wide text-violet-400">
      <span className="text-neutral-600">// </span>
      {children}
    </div>
  );
}

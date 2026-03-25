export function GradientGlow() {
  return (
    <div
      className="pointer-events-none absolute -top-28 left-1/2 h-[500px] w-[800px] -translate-x-1/2"
      style={{
        background:
          'radial-gradient(ellipse, rgba(124,58,237,0.10) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)',
      }}
    />
  );
}

export function GridOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
      }}
    />
  );
}

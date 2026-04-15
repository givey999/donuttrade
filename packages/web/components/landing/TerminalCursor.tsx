interface TerminalCursorProps {
  height?: number;
  width?: number;
  className?: string;
}

export function TerminalCursor({ height = 58, width = 20, className = '' }: TerminalCursorProps) {
  return (
    <span
      className={`inline-block bg-violet-600 animate-cursor-blink ${className}`}
      style={{ width, height, verticalAlign: '-4px', marginLeft: 6 }}
      aria-hidden="true"
    />
  );
}

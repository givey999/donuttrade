interface PixelLogoProps {
  size?: number;
}

// 8×8 pixel grid — each row is 8 booleans. `true` = filled violet pixel.
const GRID: boolean[][] = [
  [false, false, true,  true,  true,  true,  false, false],
  [false, true,  true,  false, false, true,  true,  false],
  [true,  true,  false, false, false, false, true,  true ],
  [true,  false, false, false, false, false, false, true ],
  [true,  false, false, false, false, false, false, true ],
  [true,  true,  false, false, false, false, true,  true ],
  [false, true,  true,  false, false, true,  true,  false],
  [false, false, true,  true,  true,  true,  false, false],
];

export function PixelLogo({ size = 22 }: PixelLogoProps) {
  return (
    <div
      className="grid"
      style={{
        width: size,
        height: size,
        gridTemplateColumns: 'repeat(8, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
      }}
      aria-hidden="true"
    >
      {GRID.flat().map((on, i) => (
        <span
          key={i}
          className={on ? 'bg-violet-600' : ''}
        />
      ))}
    </div>
  );
}

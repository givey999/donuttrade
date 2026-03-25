'use client';

import { useEffect, useState } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  char: string;
}

const CHARS = ['✦', '✧', '⋆', '·', '✦', '✧'];

function generateStar(id: number): Star {
  return {
    id,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 4 + Math.random() * 10,
    opacity: 0.08 + Math.random() * 0.15,
    delay: Math.random() * 8,
    duration: 3 + Math.random() * 5,
    char: CHARS[Math.floor(Math.random() * CHARS.length)],
  };
}

export function BackgroundStars() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    setStars(Array.from({ length: 30 }, (_, i) => generateStar(i)));

    // Slowly regenerate some stars for variety
    const interval = setInterval(() => {
      setStars((prev) =>
        prev.map((s) => (Math.random() > 0.7 ? generateStar(s.id) : s))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute animate-star-twinkle"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            fontSize: `${s.size}px`,
            color: `hsl(${255 + Math.random() * 25}, 70%, 70%)`,
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        >
          {s.char}
        </span>
      ))}
    </div>
  );
}

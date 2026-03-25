'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  char: string;
}

function generateSparkle(id: number): Sparkle {
  const chars = ['✦', '✧', '⋆', '✦'];
  return {
    id,
    x: Math.random() * 140 - 20,   // -20% to 120% horizontal
    y: Math.random() * 140 - 20,   // -20% to 120% vertical
    size: 6 + Math.random() * 6,    // 6-12px
    delay: Math.random() * 4,       // 0-4s delay
    duration: 1.5 + Math.random() * 2, // 1.5-3.5s
    char: chars[Math.floor(Math.random() * chars.length)],
  };
}

export function SparkleLogo() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    // Generate initial sparkles
    setSparkles(Array.from({ length: 6 }, (_, i) => generateSparkle(i)));

    // Regenerate sparkles periodically for randomness
    const interval = setInterval(() => {
      setSparkles((prev) =>
        prev.map((s) => (Math.random() > 0.5 ? generateSparkle(s.id) : s))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Link href="/dashboard" className="relative inline-block text-lg font-extrabold tracking-tight text-white logo-glow">
      DonutTrade
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="pointer-events-none absolute animate-sparkle-pop"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            fontSize: `${s.size}px`,
            color: `hsl(${260 + Math.random() * 20}, 80%, ${65 + s.size}%)`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        >
          {s.char}
        </span>
      ))}
    </Link>
  );
}

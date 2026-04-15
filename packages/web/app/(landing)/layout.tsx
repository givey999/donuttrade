import type { Metadata } from 'next';
import { BackgroundStars } from '@/components/background-stars';

export const metadata: Metadata = {
  title: 'DonutTrade — Secure escrow trading for DonutSMP',
  description:
    'Instant item swaps, escrow protected. Trade Minecraft items safely on DonutSMP without the trust fall.',
  openGraph: {
    title: 'DonutTrade — Secure escrow trading for DonutSMP',
    description: 'Instant item swaps, escrow protected. Trade Minecraft items safely on DonutSMP.',
    siteName: 'DonutTrade',
    type: 'website',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BackgroundStars />
      {children}
    </>
  );
}

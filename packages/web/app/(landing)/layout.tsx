import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DonutTrade — The trusted way to trade on DonutSMP',
  description: 'Secure escrow trading for Minecraft items on DonutSMP. Deposit, trade, and withdraw safely.',
  openGraph: {
    title: 'DonutTrade — The trusted way to trade on DonutSMP',
    description: 'Secure escrow trading for Minecraft items on DonutSMP.',
    siteName: 'DonutTrade',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

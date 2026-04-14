import type { Metadata } from 'next';
import { Inter, VT323 } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const vt323 = VT323({ subsets: ['latin'], weight: '400', variable: '--font-vt323' });

export const metadata: Metadata = {
  title: {
    default: 'DonutTrade — Secure escrow trading for DonutSMP',
    template: '%s · DonutTrade',
  },
  description:
    'Instant item swaps, escrow protected. Trade Minecraft items safely on DonutSMP without the trust fall.',
  metadataBase: new URL('https://donuttrade.com'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${vt323.variable}`}>
      <body className={`${inter.className} bg-[#0a0a0f] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}

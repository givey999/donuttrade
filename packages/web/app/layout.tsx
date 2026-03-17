import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { TimeoutBanner } from '@/components/timeout-banner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DonutTrade',
  description: 'Minecraft trading escrow platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-white antialiased`}>
        <AuthProvider>
          <Navbar />
          <TimeoutBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

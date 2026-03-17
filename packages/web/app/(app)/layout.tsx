import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { TimeoutBanner } from '@/components/timeout-banner';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <Navbar />
      <TimeoutBanner />
      {children}
    </AuthProvider>
  );
}

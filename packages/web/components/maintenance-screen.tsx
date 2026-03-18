'use client';

export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-3">Under Maintenance</h1>
        <p className="text-neutral-400 mb-6">{message || 'The platform is currently under maintenance. Please check back soon.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
        >
          Check again
        </button>
      </div>
    </div>
  );
}

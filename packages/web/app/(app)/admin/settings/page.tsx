'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { FadeIn } from '@/components/ui/animate';

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Local form state
  const [commissionRate, setCommissionRate] = useState('');
  const [hiddenModePrice, setHiddenModePrice] = useState('');
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  // Feedback
  const [feedback, setFeedback] = useState<Record<string, { type: 'success' | 'error'; msg: string }>>({});

  useEffect(() => {
    if (!authLoading && user?.role !== 'admin' && user?.role !== 'leader') {
      router.push('/admin');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    apiFetch<Record<string, string>>('/admin/settings')
      .then((data) => {
        setSettings(data);
        setCommissionRate(((Number(data.commission_rate || '0.02') * 100).toString()));
        setHiddenModePrice(data.hidden_mode_price || '50000000');
        setMaintenanceEnabled(data.maintenance_enabled === 'true');
        setMaintenanceMessage(data.maintenance_message || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveSetting = useCallback(async (key: string, value: string, feedbackKey: string) => {
    try {
      await apiFetch(`/admin/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
      setFeedback((prev) => ({ ...prev, [feedbackKey]: { type: 'success', msg: 'Saved' } }));
      setTimeout(() => setFeedback((prev) => {
        const next = { ...prev };
        delete next[feedbackKey];
        return next;
      }), 3000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save';
      setFeedback((prev) => ({ ...prev, [feedbackKey]: { type: 'error', msg } }));
    }
  }, []);

  if (authLoading || loading) {
    return <p className="text-sm text-neutral-400">Loading settings...</p>;
  }

  if (user?.role !== 'admin' && user?.role !== 'leader') {
    return <p className="text-sm text-neutral-400">Redirecting...</p>;
  }

  return (
    <div className="max-w-2xl">
      <FadeIn>
        <PageHeader title="Settings" subtitle="Configure platform settings" />
      </FadeIn>

      {/* Commission Rate */}
      <FadeIn delay={100}>
        <Card className="mt-6 p-5">
          <h3 className="text-sm font-semibold">Commission Rate</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Percentage fee charged on order fills (0-50%)
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative flex-1">
              <Input
                type="number"
                min={0}
                max={50}
                step={0.1}
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">%</span>
            </div>
            <Button
              size="sm"
              onClick={() => saveSetting('commission_rate', (Number(commissionRate) / 100).toString(), 'commission')}
            >
              Save
            </Button>
          </div>
          {feedback.commission && (
            <p className={`mt-2 text-xs ${feedback.commission.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {feedback.commission.msg}
            </p>
          )}
        </Card>
      </FadeIn>

      {/* Hidden Mode Price */}
      <FadeIn delay={200}>
        <Card className="mt-4 p-5">
          <h3 className="text-sm font-semibold">Hidden Mode Price</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Cost for users to purchase hidden mode (in dollars)
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">$</span>
              <Input
                type="number"
                min={0}
                value={hiddenModePrice}
                onChange={(e) => setHiddenModePrice(e.target.value)}
                className="pl-7"
              />
            </div>
            <Button
              size="sm"
              onClick={() => saveSetting('hidden_mode_price', hiddenModePrice, 'hidden')}
            >
              Save
            </Button>
          </div>
          {feedback.hidden && (
            <p className={`mt-2 text-xs ${feedback.hidden.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {feedback.hidden.msg}
            </p>
          )}
        </Card>
      </FadeIn>

      {/* Maintenance Mode */}
      <FadeIn delay={300}>
        <Card className="mt-4 p-5">
          <h3 className="text-sm font-semibold">Maintenance Mode</h3>
          <p className="mt-1 text-xs text-neutral-500">
            When enabled, non-admin users see a maintenance screen
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setMaintenanceEnabled(!maintenanceEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                maintenanceEnabled ? 'bg-violet-500' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  maintenanceEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-neutral-400">
              {maintenanceEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <div className="mt-3">
            <label className="block text-xs text-neutral-400">Message (optional)</label>
            <textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[#1a1a1a] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-neutral-600 transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              placeholder="The platform is currently under maintenance..."
            />
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await saveSetting('maintenance_enabled', maintenanceEnabled ? 'true' : 'false', 'maintenance');
                await saveSetting('maintenance_message', maintenanceMessage, 'maintenance');
              }}
            >
              Save
            </Button>
          </div>

          {feedback.maintenance && (
            <p className={`mt-2 text-xs ${feedback.maintenance.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {feedback.maintenance.msg}
            </p>
          )}
        </Card>
      </FadeIn>
    </div>
  );
}

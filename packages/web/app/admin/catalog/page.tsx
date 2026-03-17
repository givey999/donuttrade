'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

interface CatalogItem {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description: string | null;
  iconUrl: string | null;
  enabled: boolean;
  createdAt: string;
}

export default function AdminCatalogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // New item form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newCategory, setNewCategory] = useState('spawner');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/admin');
    }
  }, [user, router]);

  const fetchItems = useCallback(() => {
    setLoading(true);
    apiFetch<{ items: CatalogItem[] }>('/admin/catalog')
      .then((data) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async () => {
    if (!newName || !newDisplayName) return;
    setActionLoading(true);
    try {
      await apiFetch('/admin/catalog', {
        method: 'POST',
        body: JSON.stringify({ name: newName, displayName: newDisplayName, category: newCategory }),
      });
      setNewName('');
      setNewDisplayName('');
      setShowForm(false);
      fetchItems();
    } catch { /* error handled */ }
    setActionLoading(false);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setActionLoading(true);
    try {
      await apiFetch(`/admin/catalog/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !enabled }),
      });
      fetchItems();
    } catch { /* error handled */ }
    setActionLoading(false);
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Catalog Items</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
        >
          {showForm ? 'Cancel' : 'Add Item'}
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="grid grid-cols-3 gap-3">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="name (snake_case)" className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none" />
            <input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Display Name" className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none" />
            <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none" />
          </div>
          <button onClick={handleAdd} disabled={!newName || !newDisplayName || actionLoading} className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50">
            Create Item
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No catalog items.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-800 bg-neutral-950/50 text-xs text-neutral-400">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Display Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {items.map((item) => (
                <tr key={item.id} className="text-neutral-300">
                  <td className="px-3 py-2 text-xs font-mono">{item.name}</td>
                  <td className="px-3 py-2 text-xs">{item.displayName}</td>
                  <td className="px-3 py-2 text-xs capitalize">{item.category}</td>
                  <td className="px-3 py-2">
                    {item.enabled ? (
                      <span className="text-xs text-green-400">Yes</span>
                    ) : (
                      <span className="text-xs text-red-400">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleToggle(item.id, item.enabled)}
                      disabled={actionLoading}
                      className={`rounded px-2 py-0.5 text-xs disabled:opacity-50 ${
                        item.enabled
                          ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                          : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                      }`}
                    >
                      {item.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

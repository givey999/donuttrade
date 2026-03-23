'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { FadeIn } from '@/components/ui/animate';

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
    if (user && user.role !== 'admin' && user.role !== 'leader') {
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

  if (user?.role !== 'admin' && user?.role !== 'leader') return null;

  return (
    <div className="max-w-4xl">
      <FadeIn>
        <PageHeader title="Catalog Items">
          <Button
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'Add Item'}
          </Button>
        </PageHeader>
      </FadeIn>

      {showForm && (
        <FadeIn>
          <Card className="mt-4 p-4">
            <div className="grid grid-cols-3 gap-3">
              <Input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="name (snake_case)" />
              <Input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Display Name" />
              <Input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" />
            </div>
            <Button onClick={handleAdd} disabled={!newName || !newDisplayName || actionLoading} className="mt-3">
              Create Item
            </Button>
          </Card>
        </FadeIn>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No catalog items.</p>
      ) : (
        <FadeIn delay={150}>
          <div className="mt-4">
            <Table>
              <Thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Display Name</Th>
                  <Th>Category</Th>
                  <Th>Enabled</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <Td className="text-xs font-mono">{item.name}</Td>
                    <Td className="text-xs">{item.displayName}</Td>
                    <Td className="text-xs capitalize">{item.category}</Td>
                    <Td>
                      {item.enabled ? (
                        <span className="text-xs text-green-400">Yes</span>
                      ) : (
                        <span className="text-xs text-red-400">No</span>
                      )}
                    </Td>
                    <Td>
                      <Button
                        variant={item.enabled ? 'danger' : 'success'}
                        size="sm"
                        onClick={() => handleToggle(item.id, item.enabled)}
                        disabled={actionLoading}
                      >
                        {item.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

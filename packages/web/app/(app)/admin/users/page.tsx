'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Table, Thead, Tbody, Th, Td } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { FadeIn } from '@/components/ui/animate';
import type { PaginationMeta } from '@donuttrade/shared';

interface AdminUser {
  id: string;
  minecraftUsername: string | null;
  email: string | null;
  authProvider: string;
  balance: string;
  role: string;
  verificationStatus: string;
  isBanned: boolean;
  isTimedOut: boolean;
  createdAt: string;
}

const ROLE_VARIANT: Record<string, string> = {
  leader: 'danger',
  admin: 'warning',
  manager: 'purple',
  moderator: 'info',
  user: 'neutral',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', '20');
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);

    apiFetch<{ users: AdminUser[]; meta: PaginationMeta }>(`/admin/users?${params}`)
      .then((data) => { setUsers(data.users); setMeta(data.meta); })
      .catch(() => { setUsers([]); setMeta(null); })
      .finally(() => setLoading(false));
  }, [search, roleFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="max-w-5xl">
      <FadeIn>
        <PageHeader title="Users" />
      </FadeIn>

      <FadeIn delay={100}>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search username or email..."
            className="w-64"
          />
          <Select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="moderator">Moderator</option>
            <option value="user">User</option>
          </Select>
        </div>
      </FadeIn>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-400">Loading...</p>
      ) : users.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No users found.</p>
      ) : (
        <FadeIn delay={150}>
          <div className="mt-3">
            <Table>
              <Thead>
                <tr>
                  <Th>Username</Th>
                  <Th>Email</Th>
                  <Th className="text-right">Balance</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                </tr>
              </Thead>
              <Tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                  >
                    <Td className="text-xs font-medium">{u.minecraftUsername ?? '—'}</Td>
                    <Td className="text-xs text-neutral-500">{u.email ?? '—'}</Td>
                    <Td className="text-right text-xs text-green-400">
                      ${Number(u.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Td>
                    <Td>
                      <Badge variant={ROLE_VARIANT[u.role] as 'danger'}>
                        {u.role}
                      </Badge>
                    </Td>
                    <Td>
                      {u.isBanned ? (
                        <span className="text-xs text-red-400">Banned</span>
                      ) : u.isTimedOut ? (
                        <span className="text-xs text-amber-400">Timed Out</span>
                      ) : u.verificationStatus === 'verified' ? (
                        <span className="text-xs text-green-400">Verified</span>
                      ) : (
                        <span className="text-xs text-neutral-500 capitalize">{u.verificationStatus}</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-neutral-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>

          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}
        </FadeIn>
      )}
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createGroup, listGroups, type GroupSummary } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageShell } from '../components/PageShell';
import { useToast } from '../components/Toast';
import {
  alertError,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
  muted,
  sectionTitle,
} from '../ui/styles';

export function DashboardPage() {
  const { user, token, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadGroups() {
      setLoading(true);
      setError(null);
      try {
        const result = await listGroups(token!);
        if (!cancelled) {
          setGroups(result);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load groups';
          setError(message);
          showToast(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, [token, showToast]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setCreating(true);
    setCreateError(null);

    try {
      const group = await createGroup(token, groupName);
      setShowCreate(false);
      setGroupName('');
      showToast('Group created', 'success');
      navigate(`/groups/${group.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create group';
      setCreateError(message);
      showToast(message, 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageShell
      title="Dashboard"
      subtitle={`Welcome back, ${user?.name}.`}
      actions={
        <button type="button" onClick={logout} className={btnSecondary}>
          Log out
        </button>
      }
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className={sectionTitle}>Your groups</h2>
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
          className={btnPrimary}
        >
          Create group
        </button>
      </div>

      {loading ? <LoadingBlock label="Loading groups…" /> : null}
      {error ? (
        <p className={alertError} role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && groups.length === 0 ? (
        <EmptyState
          icon="groups"
          title="No groups yet"
          description="Create one to start splitting expenses with your housemates."
        />
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              to={`/groups/${group.id}`}
              className="block rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-emerald-300"
            >
              <h3 className="text-base font-semibold text-slate-900">{group.name}</h3>
              <p className={`mt-2 ${muted}`}>
                {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Created by {group.creator.name}
                {group.createdBy === user?.id ? ' (you)' : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {showCreate ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-group-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
          >
            <h2 id="create-group-title" className="text-xl font-semibold text-slate-900">
              Create group
            </h2>
            <p className={`mt-1 ${muted}`}>Give your household or trip a name.</p>

            <form className="mt-5 space-y-4" onSubmit={handleCreate}>
              <label className={labelClass}>
                Group name
                <input
                  type="text"
                  required
                  autoFocus
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Apartment 4B"
                />
              </label>

              {createError ? (
                <p className={alertError} role="alert">
                  {createError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className={btnSecondary}>
                  Cancel
                </button>
                <button type="submit" disabled={creating} className={btnPrimary}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

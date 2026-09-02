import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { getGroupActivity, type ActivityEvent } from '../api/activity';
import { getGroupBalances, type MemberBalance } from '../api/balances';
import { listExpenses, type Expense } from '../api/expenses';
import {
  getGroup,
  inviteToGroup,
  removeGroupMember,
  type GroupDetail,
} from '../api/groups';
import { getSimplifiedDebts, type SuggestedDebt } from '../api/settlements';
import { useAuth } from '../auth/AuthContext';
import { ActivityFeed } from '../components/ActivityFeed';
import { AddExpenseForm } from '../components/AddExpenseForm';
import { BalancesSection } from '../components/BalancesSection';
import { EmptyState } from '../components/EmptyState';
import { LoadingBlock } from '../components/LoadingBlock';
import { PageShell } from '../components/PageShell';
import { SectionCard } from '../components/SectionCard';
import { SuggestedSettlementsSection } from '../components/SuggestedSettlementsSection';
import { useToast } from '../components/Toast';
import {
  alertError,
  alertSuccess,
  btnGhost,
  btnPrimary,
  inputClass,
  muted,
} from '../ui/styles';

function formatMoney(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : `$${value}`;
}

function splitLabel(expense: Expense): string {
  if (expense.splitType === 'PERCENTAGE') return 'Percentage';
  if (expense.splitType === 'EXACT') return 'Exact';
  if (expense.splitType === 'ITEMIZED') return 'Itemized';
  return 'Equal';
}

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [debts, setDebts] = useState<SuggestedDebt[]>([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [debtsError, setDebtsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const loadGroup = useCallback(async () => {
    if (!token || !groupId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getGroup(token, groupId);
      setGroup(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load group';
      setGroup(null);
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, groupId, showToast]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  const loadExpenses = useCallback(async () => {
    if (!token || !groupId) return;

    setExpensesLoading(true);
    try {
      const result = await listExpenses(token, groupId);
      setExpenses(result);
      setExpensesError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load expenses';
      setExpensesError(message);
      showToast(message, 'error');
    } finally {
      setExpensesLoading(false);
    }
  }, [token, groupId, showToast]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const loadBalances = useCallback(async () => {
    if (!token || !groupId) return;

    setBalancesLoading(true);
    try {
      const result = await getGroupBalances(token, groupId);
      setBalances(result);
      setBalancesError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load balances';
      setBalancesError(message);
      showToast(message, 'error');
    } finally {
      setBalancesLoading(false);
    }
  }, [token, groupId, showToast]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  const loadDebts = useCallback(async () => {
    if (!token || !groupId) return;

    setDebtsLoading(true);
    try {
      const result = await getSimplifiedDebts(token, groupId);
      setDebts(result);
      setDebtsError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load suggested settlements';
      setDebtsError(message);
      showToast(message, 'error');
    } finally {
      setDebtsLoading(false);
    }
  }, [token, groupId, showToast]);

  useEffect(() => {
    void loadDebts();
  }, [loadDebts]);

  const loadActivity = useCallback(async () => {
    if (!token || !groupId) return;

    setActivityLoading(true);
    try {
      const result = await getGroupActivity(token, groupId);
      setActivity(result);
      setActivityError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load activity';
      setActivityError(message);
      showToast(message, 'error');
    } finally {
      setActivityLoading(false);
    }
  }, [token, groupId, showToast]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  async function refreshAfterExpenseChange() {
    await Promise.all([loadExpenses(), loadBalances(), loadDebts(), loadActivity()]);
  }

  async function refreshAfterSettlement() {
    await Promise.all([loadBalances(), loadDebts(), loadActivity()]);
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !groupId) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const member = await inviteToGroup(token, groupId, inviteEmail);
      setInviteEmail('');
      const successMessage = `${member.user.name} was added to the group.`;
      setInviteSuccess(successMessage);
      showToast(successMessage, 'success');
      await loadGroup();
      await Promise.all([loadBalances(), loadDebts()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite member';
      setInviteError(message);
      showToast(message, 'error');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberUserId: string) {
    if (!token || !groupId) return;

    setRemovingUserId(memberUserId);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await removeGroupMember(token, groupId, memberUserId);
      showToast('Member removed', 'success');
      await loadGroup();
      await Promise.all([loadBalances(), loadDebts()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      setInviteError(message);
      showToast(message, 'error');
    } finally {
      setRemovingUserId(null);
    }
  }

  const isCreator = Boolean(group && user && group.createdBy === user.id);

  return (
    <PageShell
      title={group?.name ?? 'Group'}
      subtitle={
        group
          ? `Created by ${group.creator.name}${isCreator ? ' (you)' : ''} · ${group.members.length} ${
              group.members.length === 1 ? 'member' : 'members'
            }`
          : undefined
      }
      backTo={{ href: '/dashboard', label: 'Back to dashboard' }}
    >
      {loading ? <LoadingBlock label="Loading group…" /> : null}

      {error ? (
        <p className={`${alertError} mb-6`} role="alert">
          {error}
        </p>
      ) : null}

      {group ? (
        <>
          {user ? (
            <>
              <BalancesSection
                balances={balances}
                currentUserId={user.id}
                loading={balancesLoading}
                error={balancesError}
              />
              {token ? (
                <SuggestedSettlementsSection
                  groupId={group.id}
                  token={token}
                  currentUserId={user.id}
                  debts={debts}
                  loading={debtsLoading}
                  error={debtsError}
                  onSettled={() => void refreshAfterSettlement()}
                />
              ) : null}
            </>
          ) : null}

          <SectionCard title="Members">
            {group.members.length === 0 ? (
              <EmptyState
                icon="groups"
                title="No members yet"
                description="Invite someone by email below."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {group.members.map((member) => (
                  <li
                    key={member.user.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {member.user.name}
                        {member.user.id === user?.id ? (
                          <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                        ) : null}
                        {member.user.id === group.createdBy ? (
                          <span className="ml-2 text-xs font-normal text-emerald-700">creator</span>
                        ) : null}
                      </p>
                      <p className={muted}>{member.user.email}</p>
                    </div>
                    {isCreator && member.user.id !== group.createdBy ? (
                      <button
                        type="button"
                        onClick={() => void handleRemove(member.user.id)}
                        disabled={removingUserId === member.user.id}
                        className={btnGhost}
                      >
                        {removingUserId === member.user.id ? 'Removing…' : 'Remove'}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {token && user ? (
            <div className="mb-8">
              <AddExpenseForm
                groupId={group.id}
                members={group.members}
                currentUserId={user.id}
                token={token}
                onCreated={() => void refreshAfterExpenseChange()}
              />
            </div>
          ) : null}

          <SectionCard title="Expenses">
            {expensesLoading ? <LoadingBlock label="Loading expenses…" /> : null}
            {expensesError ? (
              <p className={alertError} role="alert">
                {expensesError}
              </p>
            ) : null}
            {!expensesLoading && !expensesError && expenses.length === 0 ? (
              <EmptyState
                icon="expenses"
                title="No expenses yet — add your first one"
                description="Shared bills and purchases will appear in this list."
              />
            ) : null}
            {!expensesLoading && !expensesError && expenses.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <li key={expense.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{expense.description}</p>
                        <p className={muted}>
                          {expense.category} · {splitLabel(expense)} · paid by {expense.payer.name}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium text-slate-900">
                        {formatMoney(expense.totalAmount)}
                      </p>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {expense.splits.map((split) => (
                        <li key={split.id}>
                          {split.user.name} owes {formatMoney(split.amountOwed)}
                          {split.percentage ? ` (${split.percentage}%)` : ''}
                        </li>
                      ))}
                    </ul>
                    {expense.splitType === 'ITEMIZED' && expense.items && expense.items.length > 0 ? (
                      <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                        {expense.items.map((item) => (
                          <li key={item.id}>
                            {item.itemName} ({formatMoney(item.itemAmount)}) —{' '}
                            {item.shares.map((share) => share.user.name).join(', ')}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          <ActivityFeed events={activity} loading={activityLoading} error={activityError} />

          <SectionCard
            title="Invite by email"
            hint="The person must already have a Housemate Split account."
          >
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleInvite}>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="roommate@example.com"
                className={`${inputClass} mt-0`}
              />
              <button type="submit" disabled={inviting} className={`${btnPrimary} sm:shrink-0`}>
                {inviting ? 'Adding…' : 'Add member'}
              </button>
            </form>

            {inviteError ? (
              <p className={`${alertError} mt-3`} role="alert">
                {inviteError}
              </p>
            ) : null}
            {inviteSuccess ? <p className={`${alertSuccess} mt-3`}>{inviteSuccess}</p> : null}
          </SectionCard>
        </>
      ) : null}
    </PageShell>
  );
}

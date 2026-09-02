import { useState } from 'react';
import { createSettlement, type SuggestedDebt } from '../api/settlements';
import { alertError, btnSecondary, muted } from '../ui/styles';
import { EmptyState } from './EmptyState';
import { LoadingBlock } from './LoadingBlock';
import { SectionCard } from './SectionCard';
import { useToast } from './Toast';

type SuggestedSettlementsProps = {
  groupId: string;
  token: string;
  currentUserId: string;
  debts: SuggestedDebt[];
  loading?: boolean;
  error?: string | null;
  onSettled: () => void;
};

export function SuggestedSettlementsSection({
  groupId,
  token,
  currentUserId,
  debts,
  loading = false,
  error = null,
  onSettled,
}: SuggestedSettlementsProps) {
  const { showToast } = useToast();
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleMarkSettled(debt: SuggestedDebt) {
    const key = `${debt.fromUserId}-${debt.toUserId}-${debt.amount}`;
    setSettlingKey(key);
    setActionError(null);

    try {
      await createSettlement(token, groupId, {
        fromUserId: debt.fromUserId,
        toUserId: debt.toUserId,
        amount: Number(debt.amount),
      });
      showToast(
        `You marked as settled with ${debt.toUser.name} ($${debt.amount})`,
        'success',
      );
      onSettled();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record settlement';
      setActionError(message);
      showToast(message, 'error');
    } finally {
      setSettlingKey(null);
    }
  }

  return (
    <SectionCard
      title="Suggested Settlements"
      hint="Fewest payments to settle everyone up. Only you can confirm payments you owe."
    >
      {loading ? <LoadingBlock label="Calculating…" /> : null}

      {error ? (
        <p className={alertError} role="alert">
          {error}
        </p>
      ) : null}

      {actionError ? (
        <p className={alertError} role="alert">
          {actionError}
        </p>
      ) : null}

      {!loading && !error && debts.length === 0 ? (
        <EmptyState
          icon="settlements"
          title="Everyone is settled up"
          description="No payments needed right now."
        />
      ) : null}

      {!loading && !error && debts.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {debts.map((debt) => {
            const key = `${debt.fromUserId}-${debt.toUserId}-${debt.amount}`;
            const settling = settlingKey === key;
            const isOwnDebt = debt.fromUserId === currentUserId;

            return (
              <li
                key={key}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{debt.fromUser.name}</span> should pay{' '}
                    <span className="font-medium">{debt.toUser.name}</span>{' '}
                    <span className="font-semibold text-emerald-800">${debt.amount}</span>
                  </p>
                  {!isOwnDebt ? (
                    <p className={`mt-1 ${muted}`}>Only {debt.fromUser.name} can confirm this payment.</p>
                  ) : null}
                </div>
                {isOwnDebt ? (
                  <button
                    type="button"
                    onClick={() => void handleMarkSettled(debt)}
                    disabled={settling || settlingKey !== null}
                    className={`${btnSecondary} sm:shrink-0`}
                  >
                    {settling ? 'Saving…' : 'Mark as Settled'}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </SectionCard>
  );
}

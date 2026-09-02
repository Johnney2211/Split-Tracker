import type { MemberBalance } from '../api/balances';
import { alertError, muted } from '../ui/styles';
import { EmptyState } from './EmptyState';
import { LoadingBlock } from './LoadingBlock';
import { SectionCard } from './SectionCard';

function formatMoney(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

type BalancesSectionProps = {
  balances: MemberBalance[];
  currentUserId: string;
  loading?: boolean;
  error?: string | null;
};

export function BalancesSection({
  balances,
  currentUserId,
  loading = false,
  error = null,
}: BalancesSectionProps) {
  const sorted = [...balances].sort(
    (a, b) => Math.abs(Number(b.netBalance)) - Math.abs(Number(a.netBalance)),
  );

  const current = balances.find((balance) => balance.user.id === currentUserId);
  const currentNet = current ? Number(current.netBalance) : 0;

  let summary = 'You are settled up';
  if (currentNet > 0.009) {
    summary = `You are owed ${formatMoney(currentNet)}`;
  } else if (currentNet < -0.009) {
    summary = `You owe ${formatMoney(currentNet)}`;
  }

  return (
    <SectionCard title="Balances" hint={summary}>
      {loading ? <LoadingBlock label="Loading balances…" /> : null}

      {error ? (
        <p className={alertError} role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && sorted.length === 0 ? (
        <EmptyState icon="groups" title="No members yet" description="Invite housemates to see balances." />
      ) : null}

      {!loading && !error && sorted.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {sorted.map((balance) => {
            const net = Number(balance.netBalance);
            const colorClass =
              net > 0.009 ? 'text-emerald-700' : net < -0.009 ? 'text-red-600' : 'text-slate-600';
            let label = 'settled up';
            if (net > 0.009) label = `owed ${formatMoney(net)}`;
            if (net < -0.009) label = `owes ${formatMoney(net)}`;

            return (
              <li
                key={balance.user.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {balance.user.name}
                    {balance.user.id === currentUserId ? (
                      <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                    ) : null}
                  </p>
                  <p className={muted}>{balance.user.email}</p>
                </div>
                <p className={`shrink-0 text-sm font-medium ${colorClass}`}>{label}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </SectionCard>
  );
}

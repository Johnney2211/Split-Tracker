import type { ActivityEvent } from '../api/activity';
import { alertError } from '../ui/styles';
import { EmptyState } from './EmptyState';
import { LoadingBlock } from './LoadingBlock';
import { SectionCard } from './SectionCard';

type ActivityFeedProps = {
  events: ActivityEvent[];
  loading?: boolean;
  error?: string | null;
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ActivityFeed({ events, loading = false, error = null }: ActivityFeedProps) {
  return (
    <SectionCard title="Activity" hint="Recent expenses and settlements in this group.">
      {loading ? <LoadingBlock label="Loading activity…" /> : null}

      {error ? (
        <p className={alertError} role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && events.length === 0 ? (
        <EmptyState
          icon="activity"
          title="No activity yet"
          description="Expenses and settlements will show up here."
        />
      ) : null}

      {!loading && !error && events.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {events.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm text-slate-800">{event.message}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {event.type === 'expense' ? 'Expense' : 'Settlement'}
                </p>
              </div>
              <time className="shrink-0 text-xs text-slate-400" dateTime={event.createdAt}>
                {formatWhen(event.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}

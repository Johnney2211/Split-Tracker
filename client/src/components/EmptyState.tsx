import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: 'groups' | 'expenses' | 'activity' | 'settlements';
};

const ICONS: Record<NonNullable<EmptyStateProps['icon']>, ReactNode> = {
  groups: (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 19.5M14 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM9 14.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM18.5 14a2.5 2.5 0 0 1 2.5 2.5V19"
      />
    </svg>
  ),
  expenses: (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4m3 1V3m0 2H6a2 2 0 0 0-2 2v1m5-3h4M8 12h8m-8 4h5"
      />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  ),
  settlements: (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 12h9m-9 0a2.5 2.5 0 1 1 0-5h.5m8.5 5a2.5 2.5 0 1 0 0 5h-.5M4 7.5h.01M20 16.5h.01M12 3v1.5M12 19.5V21"
      />
    </svg>
  ),
};

export function EmptyState({ title, description, icon = 'expenses' }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-slate-200">
        {ICONS[icon]}
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

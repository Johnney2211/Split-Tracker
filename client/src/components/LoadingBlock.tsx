import { muted } from '../ui/styles';

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700"
        aria-hidden
      />
      <p className={muted}>{label}</p>
    </div>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { brandEyebrow, pageShell, pageSubtitle, pageTitle } from '../ui/styles';

type PageShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backTo?: { href: string; label: string };
  children: ReactNode;
};

export function PageShell({ title, subtitle, actions, backTo, children }: PageShellProps) {
  return (
    <main className={pageShell}>
      {backTo ? (
        <nav className="mb-6 text-sm">
          <Link to={backTo.href} className="text-emerald-700 hover:underline">
            ← {backTo.label}
          </Link>
        </nav>
      ) : null}

      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className={brandEyebrow}>Housemate Split</p>
          <h1 className={pageTitle}>{title}</h1>
          {subtitle ? <p className={pageSubtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>

      {children}
    </main>
  );
}

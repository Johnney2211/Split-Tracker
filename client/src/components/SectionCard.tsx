import type { ReactNode } from 'react';
import { sectionCard, sectionHint, sectionTitle } from '../ui/styles';

type SectionCardProps = {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ title, hint, children, className = '' }: SectionCardProps) {
  return (
    <section className={`${sectionCard} ${className}`.trim()}>
      <h2 className={sectionTitle}>{title}</h2>
      {hint ? <p className={sectionHint}>{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

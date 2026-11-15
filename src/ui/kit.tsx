import React from 'react';
import { RATING_COLOR, type Rating } from '../engine/hazards';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export const Card: React.FC<{ title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; className?: string; pad?: boolean; children?: React.ReactNode }> = ({ title, sub, right, className, pad = true, children }) => (
  <section className={cx('rounded-2xl bg-panel border border-line', className)}>
    {(title || right) && (
      <div className={cx('flex flex-wrap items-center gap-3', pad ? 'px-4 pt-4' : 'px-4 py-3.5 border-b border-line')}>
        <div className="min-w-0 flex-1">
          {title && <h2 className="text-[16px] font-bold leading-tight">{title}</h2>}
          {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
    )}
    <div className={pad ? 'p-4' : ''}>{children}</div>
  </section>
);

export function Tabs<T extends string>({ value, options, onChange, label, dark }: { value: T; options: Array<{ value: T; label: React.ReactNode }>; onChange: (v: T) => void; label: string; dark?: boolean }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-0.5 p-[3px] rounded-[10px] border border-line">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={cx('min-h-8 px-3 rounded-[7px] text-[13px] whitespace-nowrap transition-colors', on ? (dark ? 'bg-ink text-panel font-semibold' : 'bg-accent text-on-accent font-semibold') : 'text-muted hover:text-ink')}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'dark'; icon?: React.ReactNode }> = ({ kind = 'ghost', icon, className, children, ...rest }) => (
  <button {...rest} className={cx('inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-[10px] text-sm font-semibold transition-colors',
    kind === 'primary' && 'bg-accent text-on-accent hover:opacity-90', kind === 'dark' && 'bg-ink text-panel hover:opacity-90',
    kind === 'ghost' && 'border border-line text-ink hover:bg-chip', className)}>
    {icon}{children}
  </button>
);

export const RatingChip: React.FC<{ rating: Rating | null; score?: number; small?: boolean }> = ({ rating, score, small }) => {
  if (!rating) return <span className="text-muted text-xs">—</span>;
  const c = RATING_COLOR[rating];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap', small ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1')}
      style={{ background: `${c}1f`, color: c }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} aria-hidden="true" />
      {rating}{score !== undefined && Number.isFinite(score) ? ` · ${Math.round(score)}` : ''}
    </span>
  );
};

export const Bar: React.FC<{ value: number; color: string; height?: number }> = ({ value, color, height = 8 }) => (
  <div className="w-full rounded-full bg-chip overflow-hidden" style={{ height }} aria-hidden="true">
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <label className={cx('flex flex-col gap-1 text-xs text-muted', className)}>{label}{children}</label>
);
export const inputCls = 'min-h-10 px-3 rounded-[10px] border border-line bg-panel text-ink text-sm placeholder:text-muted';

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode }> = ({ label, value, hint }) => (
  <div className="min-w-0">
    <p className="text-xs text-muted">{label}</p>
    <p className="text-[15px] font-semibold mt-0.5 tabular truncate">{value}</p>
    {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
  </div>
);

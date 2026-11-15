import React from 'react';
import { RiskRating } from '../types/climate';
import { RATING_HEX } from '../services/climateEngine';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export const Card: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, actions, className, bodyClassName, children }) => (
  <section className={cx('rounded-2xl border border-white/[0.06] bg-slate-900/70 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]', className)}>
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          {title && <h2 className="text-[15px] font-semibold text-white leading-tight">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </header>
    )}
    <div className={cx(title || actions ? 'px-5 pb-5' : 'p-5', bodyClassName)}>{children}</div>
  </section>
);

export interface SegOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  title?: string;
  dot?: string;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex items-center rounded-xl bg-slate-950/70 p-1 ring-1 ring-white/[0.06]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex items-center gap-1.5 rounded-lg font-medium transition-colors whitespace-nowrap',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]',
            )}
          >
            {o.dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.dot }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const RatingBadge: React.FC<{ rating: RiskRating; score?: number; size?: 'sm' | 'md' }> = ({ rating, score, size = 'sm' }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
    )}
    style={{ color: RATING_HEX[rating], backgroundColor: `${RATING_HEX[rating]}1a`, boxShadow: `inset 0 0 0 1px ${RATING_HEX[rating]}40` }}
  >
    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: RATING_HEX[rating] }} />
    {rating}
    {score !== undefined && <span className="text-slate-300 tabular-nums">· {score}</span>}
  </span>
);

export const ScoreBar: React.FC<{ score: number; rating: RiskRating; className?: string }> = ({ score, rating, className }) => (
  <div className={cx('h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden', className)}>
    <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: RATING_HEX[rating] }} />
  </div>
);

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: React.ReactNode }
> = ({ variant = 'secondary', size = 'md', icon, className, children, ...rest }) => (
  <button
    {...rest}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60',
      size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
      variant === 'primary' && 'bg-cyan-500 text-slate-950 hover:bg-cyan-400',
      variant === 'secondary' && 'bg-white/[0.06] text-slate-100 hover:bg-white/[0.1] ring-1 ring-inset ring-white/[0.06]',
      variant === 'ghost' && 'text-slate-300 hover:text-white hover:bg-white/[0.06]',
      variant === 'danger' && 'text-red-300 hover:text-white hover:bg-red-500/20',
      className,
    )}
  >
    {icon}
    {children}
  </button>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => (
  <select
    {...rest}
    className={cx(
      'rounded-xl bg-slate-950/70 ring-1 ring-inset ring-white/[0.08] px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-cyan-400/60',
      className,
    )}
  >
    {children}
  </select>
);

export const InfoTip: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="What does this mean?"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        className="w-4 h-4 rounded-full ring-1 ring-slate-500 text-[10px] leading-4 text-slate-300 hover:text-white hover:ring-slate-300 focus:outline-none focus-visible:ring-cyan-400"
      >
        i
      </button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-6 z-50 w-64 -translate-x-1/2 rounded-xl bg-slate-800 ring-1 ring-white/[0.1] px-3 py-2 text-xs text-slate-200 shadow-xl normal-case font-normal">
          {text}
        </span>
      )}
    </span>
  );
};

export const Kpi: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  hint?: string;
  accent?: string;
  tag?: string;
}> = ({ label, value, sub, hint, accent, tag }) => (
  <div className="rounded-2xl border border-white/[0.06] bg-slate-900/70 px-4 py-3.5">
    <div className="text-xs text-slate-400 flex items-center gap-1.5">
      {accent && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />}
      <span className="min-w-0">{label}</span>
      {hint && <InfoTip text={hint} />}
      {tag && <span className="ml-auto shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-slate-400">{tag}</span>}
    </div>
    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-white tabular-nums">{value}</div>
    {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
  </div>
);

export const EmptyState: React.FC<{ title: string; body?: string; action?: React.ReactNode }> = ({ title, body, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6">
    <div className="text-sm font-medium text-white">{title}</div>
    {body && <p className="text-xs text-slate-400 mt-1 max-w-sm">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/** Shared modal frame with Escape-to-close and click-outside-to-close. */
export const ModalShell: React.FC<{
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
  labelledBy?: string;
}> = ({ onClose, maxWidth = 'max-w-5xl', children, labelledBy }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className={cx('relative w-full max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900 shadow-2xl pop-in', maxWidth)}>
        {children}
      </div>
    </div>
  );
};

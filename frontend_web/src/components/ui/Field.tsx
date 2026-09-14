import type { InputHTMLAttributes, ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; right?: ReactNode };

export function Field({ label, right, className = '', ...props }: Props) {
  return (
    <label className={['field', className].join(' ')}>
      <span className="field-label">{label}</span>
      <span className="field-box">
        <input className="field-input" {...props} />
        {right ? <span className="field-right">{right}</span> : null}
      </span>
    </label>
  );
}

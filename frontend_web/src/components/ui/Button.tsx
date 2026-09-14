import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({ variant = 'primary', icon, loading, disabled, children, className = '', ...rest }: Props) {
  return (
    <button
      className={['btn', `btn-${variant}`, className].join(' ')}
      disabled={disabled || loading}
      {...rest}>
      {loading ? (
        <span className="btn-spinner" />
      ) : (
        <>
          {icon ? <span className="btn-icon">{icon}</span> : null}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

import type { HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'flat' | 'accent' };

export function Card({ className = '', variant = 'default', children, ...rest }: Props) {
  const cls = ['card', variant !== 'default' ? variant : '', className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

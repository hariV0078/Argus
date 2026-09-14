import type { ReactNode } from 'react';
import { IoChevronForward } from 'react-icons/io5';

export function ListRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <button className="list-row" onClick={onClick}>
      <span className="list-row-icon">{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div className="list-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {subtitle ? (
          <div className="list-row-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
        ) : null}
      </span>
      <IoChevronForward color="var(--dim)" size={16} />
    </button>
  );
}

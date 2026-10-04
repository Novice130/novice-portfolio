import type { CSSProperties } from 'react';
import type { Piece } from '@/data/gallery';

export default function Frame({ piece }: { piece: Piece }) {
  const offsite = piece.href.startsWith('http');
  return (
    <a
      className={`frame frame--${piece.frame}`}
      href={piece.href}
      style={{ '--tilt': `${piece.tilt}deg` } as CSSProperties}
      {...(offsite && { target: '_blank', rel: 'noopener' })}
    >
      <svg className="frame-wire" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M12 40 L50 3 L88 40" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="frame-body">
        <span className="frame-mat">
          <span className="frame-window">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={piece.image} alt={`${piece.title} — screenshot`} loading="lazy" />
            <span className="frame-sheen" aria-hidden="true" />
          </span>
        </span>
      </span>
      <span className="plate">
        <span className="label-no">{piece.no}</span>
        <span className="label-title">{piece.title}</span>
        <span className="label-meta">
          {piece.year ? `${piece.year} · ` : ''}
          {piece.medium}
        </span>
        <span className={`label-status label-status--${piece.status}`}>
          {piece.status === 'live' ? 'Live' : 'Under restoration'}
        </span>
      </span>
    </a>
  );
}

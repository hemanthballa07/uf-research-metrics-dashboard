export function Skeleton({ width, height, style }: { width?: string; height?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: width || '100%',
        height: height || '1rem',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        animation: 'pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0',
      }}
    >
      <Skeleton width="60%" height="0.9rem" style={{ marginBottom: '0.5rem' }} />
      <Skeleton width="40%" height="2rem" style={{ marginBottom: '0.5rem' }} />
      <Skeleton width="50%" height="0.85rem" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        padding: '1rem',
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Skeleton width="20%" height="2rem" />
        <Skeleton width="20%" height="2rem" />
        <Skeleton width="20%" height="2rem" />
        <Skeleton width="20%" height="2rem" />
        <Skeleton width="20%" height="2rem" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
          <Skeleton width="20%" height="1.5rem" />
          <Skeleton width="20%" height="1.5rem" />
          <Skeleton width="20%" height="1.5rem" />
          <Skeleton width="20%" height="1.5rem" />
          <Skeleton width="20%" height="1.5rem" />
        </div>
      ))}
    </div>
  );
}


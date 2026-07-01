export default function LoadingSkeleton({ type = 'table', count = 5 }) {
  if (type === 'card') {
    return (
      <div className="skeleton-grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-short" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="skeleton-table">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-cell" />
          <div className="skeleton-cell" />
          <div className="skeleton-cell skeleton-cell-wide" />
        </div>
      ))}
    </div>
  );
}

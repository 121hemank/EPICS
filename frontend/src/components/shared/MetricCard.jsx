export default function MetricCard({ title, value }) {
  return (
    <div className="vendor-metric-card">
      <h3>{title}</h3>
      <p>{value ?? 0}</p>
    </div>
  );
}

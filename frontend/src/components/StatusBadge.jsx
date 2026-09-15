export default function StatusBadge({ ok, label }) {
  return (
    <span className={`badge ${ok ? "ok" : "ko"}`}>
      <span className="badge-dot" />
      {label ?? (ok ? "OK" : "KO")}
    </span>
  );
}

export default function Filters({
  clients, envs,
  selectedClient, selectedEnv, onlyKo,
  onClient, onEnv, onOnlyKo,
  onRefresh, loading, nextRefresh,
}) {
  const countdown = Math.max(0, Math.ceil((nextRefresh - Date.now()) / 1000));

  return (
    <div className="filters">
      <select className="filter-select" value={selectedClient} onChange={(e) => onClient(e.target.value)}>
        <option value="">All clients</option>
        {clients.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <select className="filter-select" value={selectedEnv} onChange={(e) => onEnv(e.target.value)}>
        <option value="">All envs</option>
        {envs.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>

      <label className="toggle-ko">
        <input type="checkbox" checked={onlyKo} onChange={(e) => onOnlyKo(e.target.checked)} />
        Only KO
      </label>

      <div className="filters-right">
        <span className="next-refresh">↻ {countdown}s</span>
        <button className="refresh-btn" onClick={onRefresh} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}

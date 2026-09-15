import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Hero from "./components/Hero.jsx";
import Filters from "./components/Filters.jsx";
import StatusTable from "./components/StatusTable.jsx";
import UptimeChart from "./components/UptimeChart.jsx";
import { fetchStatus } from "./api.js";
import "./styles/global.css";

const TABS = ["airflow", "spark", "starburst"];
const TAB_LABELS = { airflow: "Airflow", spark: "Spark", starburst: "Starburst" };
const REFRESH_INTERVAL = 300_000;
const HISTORY_MAX_HOURS = 24;
const HISTORY_KEY = (tech) => `smoke_history_${tech}`;
const COMBINED_HISTORY_KEY = "smoke_history_combined";

function flattenData(data, tech) {
  if (tech === "spark") {
    return (data.tenants ?? []).map((t, i) => ({
      id: `spark-${i}`,
      client: t.business_line.toUpperCase(),
      env: t.env,
      tenant_name: t.tenant_name,
      url_href: `https://${t.tenant_name.replace(/^spark-/, "sparkui-")}.data.cloud.net.intra`,
      status: t.status,
      sync_argo: t.sync_argo,
      global_status: t.global_status,
      all_healthy: t.all_healthy,
      version: t.version,
      deprecated: t.deprecated,
      ibm_account: t.ibm_account,
      iks_cluster: t.iks_cluster,
      ok: t.all_healthy,
    }));
  }
  if (tech === "starburst") {
    return (data.instances ?? []).map((t, i) => ({
      id: `starburst-${i}`,
      client: t.business_line.toUpperCase(),
      env: t.env,
      url: t.url,
      url_href: `https://${t.url}.data.cloud.net.intra`,
      number_of_catalogs: t.number_of_catalogs,
      healthy_catalogs: t.healthy_catalogs,
      coordinator_uptime: t.coordinator_uptime,
      coordinator_health: t.coordinator_health,
      number_of_workers: t.number_of_workers,
      workers_health: t.workers_health,
      version: t.version,
      starburst_instance_health: t.starburst_instance_health,
      errors: t.errors,
      failed_catalogs: t.failed_catalogs,
      ok: t.starburst_instance_health === true && t.healthy_catalogs === t.number_of_catalogs,
    }));
  }
  return (data.instances ?? []).map((t, i) => ({
    id: `airflow-${i}`,
    client: t.business_line.toUpperCase(),
    env: t.env,
    url: t.url,
    url_href: `https://${t.url}.data.cloud.net.intra`,
    version: t.version,
    http: t.http,
    dag_processor: t.dag_processor,
    scheduler: t.scheduler,
    trigger: t.trigger,
    meta_db: t.meta_db,
    error: t.error,
    ok: t.http === true && t.dag_processor === true && t.scheduler === true && t.trigger === true && t.meta_db === true,
  }));
}

function loadHistory(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const cutoff = Date.now() - HISTORY_MAX_HOURS * 60 * 60 * 1000;
    return parsed.filter((s) => s.ts >= cutoff);
  } catch { return []; }
}

function saveHistory(key, history) {
  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch {}
}

function appendSnapshot(key, prev, snap) {
  const cutoff = Date.now() - HISTORY_MAX_HOURS * 60 * 60 * 1000;
  const updated = [...prev.filter((s) => s.ts >= cutoff), snap];
  saveHistory(key, updated);
  return updated;
}

function KpiCards({ rows, tech, activeCard, onCardClick }) {
  const total  = rows.length;
  const ok     = rows.filter((r) => r.ok).length;
  const ko     = total - ok;
  const uptime = total > 0 ? Math.round((ok / total) * 100) : 0;

  const cards = [
    { key: "total",  value: total,        label: tech === "starburst" ? "Total instances" : "Total checks", cls: "" },
    { key: "ok",     value: ok,           label: "OK",     cls: "v-ok" },
    { key: "ko",     value: ko,           label: "KO",     cls: ko > 0 ? "v-ko" : "" },
    { key: "uptime", value: `${uptime}%`, label: "Uptime", cls: uptime === 100 ? "v-ok" : "v-ko" },
  ];

  return (
    <div className="hero-stats">
      {cards.map((c) => (
        <div
          key={c.key}
          className={`hstat ${activeCard === c.key ? "active" + (c.key === "ko" && ko > 0 ? " is-ko" : "") : ""}`}
          onClick={() => onCardClick(c.key)}
        >
          <span className={`hstat-value ${c.cls}`}>{c.value}</span>
          <span className="hstat-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBanner({ rows }) {
  if (rows.length === 0) return null;
  const ko = rows.filter((r) => !r.ok).length;
  const allOk = ko === 0;
  return (
    <div className={`status-banner ${allOk ? "banner-ok" : "banner-ko"}`}>
      <span className="banner-dot" />
      {allOk ? "All systems operational" : `${ko} incident${ko > 1 ? "s" : ""} detected`}
    </div>
  );
}

function ClientEnvCards({ rows, activeFilter, onFilter }) {
  const clients = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.client]) map[r.client] = { ok: 0, ko: 0 };
      r.ok ? map[r.client].ok++ : map[r.client].ko++;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const envs = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.env]) map[r.env] = { ok: 0, ko: 0 };
      r.ok ? map[r.env].ok++ : map[r.env].ko++;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  function renderCards(list, type) {
    return list.map(([name, s]) => {
      const active = activeFilter?.type === type && activeFilter.value === name;
      return (
        <div
          key={name}
          className={`ce-card ${active ? "ce-card-active" : ""}`}
          onClick={() => onFilter(active ? null : { type, value: name })}
        >
          <span className={`ce-swatch ${s.ko > 0 ? "has-ko" : "all-ok"}`}>{s.ok + s.ko}</span>
          <span className="ce-name">{name}</span>
          <span className="ce-label">{s.ok} ok{s.ko > 0 ? ` / ${s.ko} ko` : ""}</span>
        </div>
      );
    });
  }

  return (
    <div className="ce-section">
      <div className="ce-group">
        <span className="ce-group-label">By environment</span>
        <div className="ce-cards">{renderCards(envs, "env")}</div>
      </div>
      <div className="ce-group">
        <span className="ce-group-label">By client</span>
        <div className="ce-cards">{renderCards(clients, "client")}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [tech, setTech] = useState("airflow");
  const [dataByTech, setDataByTech] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading]         = useState(false);
  const [nextRefresh, setNextRefresh] = useState(Date.now() + REFRESH_INTERVAL);
  const [historyByTech, setHistoryByTech] = useState(() => {
    const h = {};
    for (const t of TABS) h[t] = loadHistory(HISTORY_KEY(t));
    return h;
  });
  const [combinedHistory, setCombinedHistory] = useState(() => loadHistory(COMBINED_HISTORY_KEY).map((s) => s.uptime));
  const [showHistory, setShowHistory] = useState(false);

  const [selectedClient, setSelectedClient] = useState("");
  const [selectedEnv, setSelectedEnv]       = useState("");
  const [onlyKo, setOnlyKo]                 = useState(false);
  const [activeCard, setActiveCard]         = useState("total");
  const [activeFilter, setActiveFilter]     = useState(null);

  const timerRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(TABS.map((t) => fetchStatus(t)));

    const nextData = {};
    const nextErrors = {};
    let combinedOk = 0, combinedTotal = 0;

    setHistoryByTech((prevHistory) => {
      const updatedHistory = { ...prevHistory };
      results.forEach((res, i) => {
        const t = TABS[i];
        if (res.status === "rejected") {
          nextErrors[t] = res.reason?.message ?? "Fetch failed";
          return;
        }
        const { source, data } = res.value;
        const rows = flattenData(data, t);
        nextData[t] = { rows, source, generatedAt: data.generated_at };
        combinedOk += rows.filter((r) => r.ok).length;
        combinedTotal += rows.length;
        updatedHistory[t] = appendSnapshot(HISTORY_KEY(t), prevHistory[t] ?? [], { ts: Date.now(), rows });
      });
      return updatedHistory;
    });

    setDataByTech((prev) => ({ ...prev, ...nextData }));
    setErrors(nextErrors);

    if (combinedTotal > 0) {
      const uptime = Math.round((combinedOk / combinedTotal) * 100);
      setCombinedHistory((prev) => {
        const prevSnaps = loadHistory(COMBINED_HISTORY_KEY);
        const updated = appendSnapshot(COMBINED_HISTORY_KEY, prevSnaps, { ts: Date.now(), uptime });
        return updated.map((s) => s.uptime);
      });
    }

    setLoading(false);
    setNextRefresh(Date.now() + REFRESH_INTERVAL);
  }, []);

  useEffect(() => {
    loadAll();
    timerRef.current = setInterval(loadAll, REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [loadAll]);

  useEffect(() => {
    setSelectedClient(""); setSelectedEnv(""); setOnlyKo(false);
    setActiveCard("total"); setActiveFilter(null);
  }, [tech]);

  const techStats = useMemo(() => {
    const stats = {};
    for (const t of TABS) {
      const rows = dataByTech[t]?.rows ?? [];
      const total = rows.length, ok = rows.filter((r) => r.ok).length;
      stats[t] = { total, ok, ko: total - ok, uptime: total > 0 ? Math.round((ok / total) * 100) : 0 };
    }
    return stats;
  }, [dataByTech]);

  const current = dataByTech[tech];
  const rows = current?.rows ?? [];
  const history = historyByTech[tech] ?? [];
  const error = errors[tech];

  const handleCardClick = (key) => {
    setActiveCard(key);
    setSelectedClient(""); setSelectedEnv(""); setActiveFilter(null);
    setOnlyKo(key === "ko");
  };

  const handleCeFilter = (filter) => {
    setActiveFilter(filter);
    setActiveCard(null); setOnlyKo(false);
    if (!filter)                        { setSelectedClient(""); setSelectedEnv(""); }
    else if (filter.type === "client")  { setSelectedClient(filter.value); setSelectedEnv(""); }
    else if (filter.type === "env")     { setSelectedEnv(filter.value);    setSelectedClient(""); }
  };

  const handleClientChange = (v) => { setSelectedClient(v); setActiveCard(null); setActiveFilter(null); };
  const handleEnvChange    = (v) => { setSelectedEnv(v);    setActiveCard(null); setActiveFilter(null); };
  const handleOnlyKo       = (v) => { setOnlyKo(v);         setActiveCard(v ? "ko" : null); };

  const clients = useMemo(() => [...new Set(rows.map((r) => r.client))].sort(), [rows]);
  const envs    = useMemo(() => [...new Set(rows.map((r) => r.env))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (selectedClient && r.client !== selectedClient) return false;
    if (selectedEnv    && r.env    !== selectedEnv)    return false;
    if (onlyKo         && r.ok)                        return false;
    if (activeCard === "ok" && !r.ok)                  return false;
    return true;
  }), [rows, selectedClient, selectedEnv, onlyKo, activeCard]);

  return (
    <div id="root">
      <Hero tech={tech} onChangeTech={setTech} techStats={techStats} combinedHistory={combinedHistory} />

      <div className="workspace">
        <main className="app-main">
          <div className="workspace-eyebrow">
            <span className="dash" />
            <span>Détail système — <strong>{TAB_LABELS[tech]}</strong></span>
          </div>

          {error ? (
            <div className="state-box error">⚠ {error}</div>
          ) : loading && rows.length === 0 ? (
            <div className="state-box">Loading…</div>
          ) : (
            <>
              <StatusBanner rows={rows} />
              <KpiCards rows={rows} tech={tech} activeCard={activeCard} onCardClick={handleCardClick} />
              <ClientEnvCards rows={rows} activeFilter={activeFilter} onFilter={handleCeFilter} />

              <div className="section-toggle-bar">
                <button
                  className={`section-toggle-btn ${showHistory ? "section-toggle-active" : ""}`}
                  onClick={() => setShowHistory((v) => !v)}
                >
                  {showHistory ? "▾" : "▸"} Uptime history (24h)
                  {history.length > 0 && <span className="history-count">{history.length} snapshots</span>}
                </button>
              </div>

              {showHistory && <UptimeChart history={history} />}

              {current?.generatedAt && (
                <div className="meta-bar">
                  <span>Generated at: <strong>{new Date(current.generatedAt).toLocaleString()}</strong></span>
                  {current.source && <span className="source">[{current.source}]</span>}
                  <span>{filtered.length} / {rows.length} checks</span>
                </div>
              )}

              <Filters
                clients={clients} envs={envs}
                selectedClient={selectedClient} selectedEnv={selectedEnv} onlyKo={onlyKo}
                onClient={handleClientChange} onEnv={handleEnvChange} onOnlyKo={handleOnlyKo}
                onRefresh={loadAll} loading={loading} nextRefresh={nextRefresh}
              />

              <StatusTable rows={filtered} tech={tech} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

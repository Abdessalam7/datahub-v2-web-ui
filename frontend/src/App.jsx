import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Hero from "./components/Hero.jsx";
import Filters from "./components/Filters.jsx";
import StatusTable from "./components/StatusTable.jsx";
import Trend from "./components/Trend.jsx";
import Journal from "./components/Journal.jsx";
import Ranking from "./components/Ranking.jsx";
import { fetchStatus, fetchHistory } from "./api.js";
import { flattenData } from "./lib/flatten.js";
import { computeDailyUptime, computeJournal, computeRanking, computeCombinedDaily } from "./lib/history.js";
import "./style/global.css";

const TABS = ["airflow", "dags", "spark", "starburst"];
const TAB_LABELS = { airflow: "Airflow", spark: "Spark", starburst: "Starburst", dags: "DAGs" };
// starburst has no day-partitioned history collector yet
const HISTORY_TECHS = TABS.filter((t) => t !== "starburst");
const REFRESH_INTERVAL = 300_000;
const SECTIONS = ["current", "trend", "history", "ranking"];
const SECTION_LABELS = {
  current: "Vue actuelle",
  trend: "Tendance",
  history: "Journal des changements",
  ranking: "Classement",
};

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
  const [section, setSection] = useState("current");
  const [rawHistoryByTech, setRawHistoryByTech] = useState({});
  const [historyLoading, setHistoryLoading] = useState({});
  const [historyErrors, setHistoryErrors] = useState({});

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

    results.forEach((res, i) => {
      const t = TABS[i];
      if (res.status === "rejected") {
        nextErrors[t] = res.reason?.message ?? "Fetch failed";
        return;
      }
      const { source, data } = res.value;
      const rows = flattenData(data, t);
      nextData[t] = { rows, source, generatedAt: data.generated_at };
    });

    setDataByTech((prev) => ({ ...prev, ...nextData }));
    setErrors(nextErrors);
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

  // Trend/Journal/Classement need COS history per tech, and the Hero's combined
  // sparkline needs it across *every* tech — so fetch all of them once on load
  // (37 days: 30 to render + a 7-day buffer for carry-in state) rather than
  // lazily per selected tab. Same data for every viewer, no browser-local state.
  useEffect(() => {
    HISTORY_TECHS.forEach((t) => {
      setHistoryLoading((prev) => ({ ...prev, [t]: true }));
      fetchHistory(t, 37)
        .then(({ data }) => {
          setRawHistoryByTech((prev) => ({ ...prev, [t]: data }));
        })
        .catch((err) => {
          setHistoryErrors((prev) => ({ ...prev, [t]: err.message }));
        })
        .finally(() => {
          setHistoryLoading((prev) => ({ ...prev, [t]: false }));
        });
    });
  }, []);

  const dailyByTech = useMemo(() => {
    const result = {};
    for (const t of HISTORY_TECHS) result[t] = computeDailyUptime(rawHistoryByTech[t] ?? [], t, 30);
    return result;
  }, [rawHistoryByTech]);

  const combinedHistory = useMemo(() => computeCombinedDaily(dailyByTech), [dailyByTech]);

  const daily = dailyByTech[tech] ?? computeDailyUptime([], tech, 30);
  const journalEntries = useMemo(
    () => computeJournal(rawHistoryByTech[tech] ?? [], tech),
    [rawHistoryByTech, tech]
  );
  const ranking = useMemo(() => computeRanking(daily), [daily]);

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

          <div className="section-toggle-bar" role="tablist" aria-label="Sections">
            {SECTIONS.map((s) => (
              <button
                key={s} type="button" role="tab" aria-selected={section === s}
                className={`section-toggle-btn ${section === s ? "section-toggle-active" : ""}`}
                onClick={() => setSection(s)}
              >
                {SECTION_LABELS[s]}
              </button>
            ))}
          </div>

          {section === "current" && (
            error ? (
              <div className="state-box error">⚠ {error}</div>
            ) : loading && rows.length === 0 ? (
              <div className="state-box">Loading…</div>
            ) : (
              <>
                <StatusBanner rows={rows} />
                <KpiCards rows={rows} tech={tech} activeCard={activeCard} onCardClick={handleCardClick} />
                <ClientEnvCards rows={rows} activeFilter={activeFilter} onFilter={handleCeFilter} />

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
            )
          )}

          {section === "trend" && (
            <Trend tech={tech} daily={daily} loading={historyLoading[tech]} error={historyErrors[tech]} />
          )}

          {section === "history" && (
            <Journal tech={tech} entries={journalEntries} loading={historyLoading[tech]} error={historyErrors[tech]} />
          )}

          {section === "ranking" && (
            <Ranking tech={tech} rows={ranking} loading={historyLoading[tech]} error={historyErrors[tech]} />
          )}
        </main>
      </div>
    </div>
  );
}

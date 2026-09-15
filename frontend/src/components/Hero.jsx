import Sparkline from "./Sparkline.jsx";

const TABS = ["airflow", "spark", "starburst"];
const TAB_LABELS = { airflow: "Airflow", spark: "Spark", starburst: "Starburst" };

export default function Hero({ tech, onChangeTech, techStats, combinedHistory }) {
  const allTotal = TABS.reduce((s, t) => s + (techStats[t]?.total ?? 0), 0);
  const allOk = TABS.reduce((s, t) => s + (techStats[t]?.ok ?? 0), 0);
  const combinedUptime = allTotal > 0 ? Math.round((allOk / allTotal) * 100) : 0;

  return (
    <div className="hero-band">
      <div className="hero-inner">
        <div className="hero-topline">
          <div className="brand-mark">
            <span className="live-dot" />
            <span className="brand-name"><b>Datahub v2</b> · Command Center</span>
          </div>
          <span className="hero-meta">refresh 300s</span>
        </div>

        <div className="hero-grid">
          <div className="hero-figure-block">
            <span className="hero-eyebrow">Uptime plateforme combiné</span>
            <span className="hero-figure">{combinedUptime}<sup>%</sup></span>
            <span className="hero-figure-caption">
              {allOk} contrôles OK sur {allTotal}, tous systèmes confondus (Airflow, Spark, Starburst).
            </span>
            <div className="hero-spark"><Sparkline points={combinedHistory} /></div>
            {combinedHistory && combinedHistory.length >= 2 && (
              <span className="hero-spark-label">Tendance sur les derniers cycles de rafraîchissement</span>
            )}
          </div>

          <div className="tech-cards">
            {TABS.map((t) => {
              const s = techStats[t] ?? { total: 0, ok: 0, ko: 0, uptime: 0 };
              return (
                <div
                  key={t}
                  className={`tech-card ${tech === t ? "active" : ""}`}
                  onClick={() => onChangeTech(t)}
                >
                  <span className={`tech-dot ${s.ko > 0 ? "ko" : "ok"}`} />
                  <span className="tech-name">{TAB_LABELS[t]}</span>
                  <span className="tech-bar-wrap">
                    <span className={`tech-bar ${s.ko > 0 ? "has-ko" : ""}`} style={{ width: `${s.uptime}%` }} />
                  </span>
                  <span className="tech-figures"><b>{s.ok}</b>/{s.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

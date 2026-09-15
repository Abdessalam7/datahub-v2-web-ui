export default function Sparkline({ points, height = 56 }) {
  if (!points || points.length < 2) {
    return (
      <div className="hero-spark-empty">
        Collecte en cours — la tendance s'affichera après quelques cycles de rafraîchissement.
      </div>
    );
  }

  const w = 320;
  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);

  const coords = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y];
  });

  const linePath = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + " " + c[1].toFixed(1)).join(" ");
  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaPath = `${linePath} L${last[0].toFixed(1)} ${height - pad} L${first[0].toFixed(1)} ${height - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="Tendance de l'uptime combiné"
    >
      <defs>
        <linearGradient id="heroSparkGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(47,217,140,0.45)" />
          <stop offset="100%" stopColor="rgba(47,217,140,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#heroSparkGradient)" />
      <path d={linePath} fill="none" stroke="#5EEBA8" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="#5EEBA8" />
    </svg>
  );
}

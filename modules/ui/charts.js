// modules/ui/charts.js

function DonutChart({ data, size = 160, thickness = 24, centerLabel, centerValue }) {
  const c = useThemeColors();
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);
  let cum = 0;
  return (
    <svg width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c.border || COLORS.border} strokeWidth={thickness} opacity="0.3" />
      {total > 0 && data.map((d, i) => {
        const pct = d.value / total;
        const dash = pct * circ;
        const off = -cum;
        cum += dash;
        return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={off} transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dasharray 0.6s, stroke-dashoffset 0.6s"}} />;
      })}
      {centerLabel && <>
        <text x={size/2} y={size/2 - 10} textAnchor="middle" fontSize="9" fontWeight="700" fill={c.gray || COLORS.gray} fontFamily={font} letterSpacing="0.05em">{centerLabel}</text>
        <text x={size/2} y={size/2 + 12} textAnchor="middle" fontSize="18" fontWeight="800" fill={c.text || c.navy || COLORS.navy} fontFamily={font}>{centerValue}</text>
      </>}
    </svg>
  );
}

function BalanceCurveChart({ years }) {
  const c = useThemeColors();
  const [hov, setHov] = React.useState(null);
  const uidRef = React.useRef("bg" + Math.random().toString(36).slice(2, 6));
  if (!years || years.length < 2) return null;
  const W = 480, H = 180;
  const pad = { t: 16, r: 16, b: 28, l: 56 };
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
  const maxBal = years[0].endBalance + years[0].principal;
  const pts2 = [{ x: pad.l, y: pad.t + 0 }].concat(years.map((d, i) => ({
    x: pad.l + ((i + 1) / years.length) * w,
    y: pad.t + (1 - d.endBalance / maxBal) * h
  })));
  const line = pts2.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = line + ` L${(pad.l + w).toFixed(1)},${(pad.t + h).toFixed(1)} L${pad.l},${(pad.t + h).toFixed(1)} Z`;
  const gridY = [0, 0.25, 0.5, 0.75, 1];
  const uid = uidRef.current;
  const fmtD = v => "$" + Math.round(v).toLocaleString();

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    let closest = 0, minDist = Infinity;
    pts2.slice(1).forEach((p, i) => {
      const dist = Math.abs(p.x - mx);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setHov(closest);
  };

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", cursor: "crosshair" }}
      onMouseMove={handleMouseMove} onMouseLeave={() => setHov(null)}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.blue || COLORS.blue} stopOpacity="0.25" />
          <stop offset="100%" stopColor={c.blue || COLORS.blue} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {gridY.map((p, i) => {
        const y = pad.t + p * h;
        return <g key={i}>
          <line x1={pad.l} y1={y} x2={pad.l + w} y2={y} stroke={c.border || COLORS.border} strokeWidth="0.5" />
          <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="8" fill={c.gray || COLORS.gray} fontFamily={font}>${Math.round(maxBal * (1 - p) / 1000)}K</text>
        </g>;
      })}
      <path d={area} fill={`url(#${uid})`} />
      <path d={line} fill="none" stroke={c.blue || COLORS.blue} strokeWidth="2.5" strokeLinejoin="round" />
      {pts2.length > 1 && hov === null && <circle cx={pts2[pts2.length - 1].x} cy={pts2[pts2.length - 1].y} r="4" fill={c.blue || COLORS.blue} />}
      <text x={pad.l} y={H - 4} fontSize="8" fill={c.gray || COLORS.gray} fontFamily={font}>Year 1</text>
      <text x={pad.l + w} y={H - 4} textAnchor="end" fontSize="8" fill={c.gray || COLORS.gray} fontFamily={font}>Year {years.length}</text>
      {hov !== null && (() => {
        const d = years[hov];
        const px = pts2[hov + 1].x;
        const py = pts2[hov + 1].y;
        const tipW = 164, tipH = 56;
        const tx = px + 8 + tipW > W - pad.r ? px - tipW - 8 : px + 8;
        const ty = Math.min(Math.max(py - tipH / 2, pad.t), pad.t + h - tipH);
        return (
          <g>
            <line x1={px} y1={pad.t} x2={px} y2={pad.t + h} stroke={c.gray || COLORS.gray} strokeWidth={1} strokeDasharray="3 3" opacity="0.5" />
            <circle cx={px} cy={py} r={4} fill={c.blue || COLORS.blue} stroke="#fff" strokeWidth={2} />
            <rect x={tx} y={ty} width={tipW} height={tipH} rx={5} fill={c.bg || '#fff'} stroke={c.border || COLORS.border} strokeWidth={1} opacity="0.97" />
            <text x={tx + 8} y={ty + 15} fontSize={9} fontWeight="700" fill={c.text || c.navy || COLORS.navy} fontFamily={font}>Year {d.year}</text>
            <text x={tx + 8} y={ty + 29} fontSize={8} fill={c.gray || COLORS.gray} fontFamily={font}>Balance: {fmtD(d.endBalance)}</text>
            <text x={tx + 8} y={ty + 43} fontSize={8} fill={c.gray || COLORS.gray} fontFamily={font}>Total Interest Paid: {fmtD(d.totalInterest)}</text>
          </g>
        );
      })()}
    </svg>
  );
}

function PIStackedBarChart({ years }) {
  const c = useThemeColors();
  const [hov, setHov] = React.useState(null);
  if (!years || years.length < 2) return null;
  const W = 480, H = 180;
  const pad = { t: 20, r: 16, b: 28, l: 56 };
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
  const maxPmt = Math.max(...years.map(d => d.principal + d.interest));
  const barW = Math.max(3, (w / years.length) * 0.7);
  const gap = (w / years.length) * 0.3;
  const fmtD = v => "$" + Math.round(v).toLocaleString();

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", cursor: "crosshair" }}
      onMouseLeave={() => setHov(null)}>
      <rect x={pad.l} y="2" width="10" height="10" rx="2" fill={c.green || COLORS.green} />
      <text x={pad.l + 14} y="10" fontSize="9" fontWeight="600" fill={c.text || c.navy || COLORS.navy} fontFamily={font}>Principal</text>
      <rect x={pad.l + 74} y="2" width="10" height="10" rx="2" fill={c.red || COLORS.red} opacity="0.7" />
      <text x={pad.l + 88} y="10" fontSize="9" fontWeight="600" fill={c.text || c.navy || COLORS.navy} fontFamily={font}>Interest</text>
      {years.map((d, i) => {
        const x = pad.l + i * (w / years.length) + gap / 2;
        const pH = maxPmt > 0 ? (d.principal / maxPmt) * h : 0;
        const iH = maxPmt > 0 ? (d.interest / maxPmt) * h : 0;
        return <g key={i} onMouseEnter={() => setHov(i)}>
          <rect x={x} y={pad.t + h - pH - iH} width={barW} height={iH} fill={c.red || COLORS.red} opacity="0.65" rx="1" style={{transition:"all 0.4s"}} />
          <rect x={x} y={pad.t + h - pH} width={barW} height={pH} fill={c.green || COLORS.green} opacity="0.85" rx="1" style={{transition:"all 0.4s"}} />
        </g>;
      })}
      <text x={pad.l} y={H - 4} fontSize="8" fill={c.gray || COLORS.gray} fontFamily={font}>Yr 1</text>
      <text x={pad.l + w} y={H - 4} textAnchor="end" fontSize="8" fill={c.gray || COLORS.gray} fontFamily={font}>Yr {years.length}</text>
      {hov !== null && (() => {
        const d = years[hov];
        const barX = pad.l + hov * (w / years.length) + gap / 2 + barW / 2;
        const tipW = 168, tipH = 68;
        const tx = barX + tipW + 6 > W - pad.r ? barX - tipW - 6 : barX + 6;
        const ty = pad.t + 4;
        return (
          <g>
            <rect x={tx} y={ty} width={tipW} height={tipH} rx={5} fill={c.bg || '#fff'} stroke={c.border || COLORS.border} strokeWidth={1} opacity="0.97" />
            <text x={tx + 8} y={ty + 15} fontSize={9} fontWeight="700" fill={c.text || c.navy || COLORS.navy} fontFamily={font}>Year {d.year}</text>
            <text x={tx + 8} y={ty + 29} fontSize={8} fill={c.green || COLORS.green} fontFamily={font}>Principal paid: {fmtD(d.principal)}</text>
            <text x={tx + 8} y={ty + 42} fontSize={8} fill={c.red || COLORS.red} fontFamily={font}>Interest paid: {fmtD(d.interest)}</text>
            <text x={tx + 8} y={ty + 55} fontSize={8} fill={c.gray || COLORS.gray} fontFamily={font}>Cumul. interest: {fmtD(d.totalInterest)}</text>
          </g>
        );
      })()}
    </svg>
  );
}

function GaugeChart({ value, max = 60, size = 130, label, thresholds }) {
  const c = useThemeColors();
  const r = (size - 24) / 2;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const pct = Math.min(Math.max(value / max, 0), 1);
  const arcPath = (s, e) => {
    const x1 = cx + r * Math.cos(Math.PI - s * Math.PI);
    const y1 = cy - r * Math.sin(Math.PI - s * Math.PI);
    const x2 = cx + r * Math.cos(Math.PI - e * Math.PI);
    const y2 = cy - r * Math.sin(Math.PI - e * Math.PI);
    const large = Math.abs(e - s) > 0.5 ? 1 : 0;
    return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };
  const color = thresholds ? (
    value <= thresholds[0] ? (c.green || COLORS.green) :
    value <= thresholds[1] ? (c.gold || COLORS.gold) :
    (c.red || COLORS.red)
  ) : (c.blue || COLORS.blue);
  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`} style={{ display: "block", margin: "0 auto" }}>
      <path d={arcPath(0, 1)} fill="none" stroke={c.border || COLORS.border} strokeWidth="10" strokeLinecap="round" opacity="0.3" />
      {value > 0 && <path d={arcPath(0, pct)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" style={{transition:"all 0.6s"}} />}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="800" fill={color} fontFamily={font}>{value.toFixed(1)}%</text>
      {label && <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fontWeight="600" fill={c.gray || COLORS.gray} fontFamily={font}>{label}</text>}
      <text x={cx - r - 2} y={cy + 10} textAnchor="middle" fontSize="7" fill={c.gray || COLORS.gray} fontFamily={font}>0%</text>
      <text x={cx + r + 2} y={cy + 10} textAnchor="middle" fontSize="7" fill={c.gray || COLORS.gray} fontFamily={font}>{max}%</text>
    </svg>
  );
}

window.DonutChart = DonutChart;
window.BalanceCurveChart = BalanceCurveChart;
window.PIStackedBarChart = PIStackedBarChart;
window.GaugeChart = GaugeChart;

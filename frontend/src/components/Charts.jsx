import React, { useMemo, useState } from 'react';
import {
  MAP_VIEW,
  BD_DIVISION_PATHS,
  normalizeDivisionName,
  choroplethFill,
  choroplethLabelColor
} from '../data/bangladeshDivisions';

function aggregateCasesByDisease(data) {
  const aggregated = {};
  (data || []).forEach((item) => {
    if (item.totalCases > 0) {
      aggregated[item.diseaseCode] = (aggregated[item.diseaseCode] || 0) + item.totalCases;
    }
  });
  return Object.entries(aggregated)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function SvgBarChart({ data }) {
  const chartData = aggregateCasesByDisease(data);
  if (!chartData.length) {
    return (
      <div className="text-xs text-slate-400 font-mono py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
        No cases match the selected filters.
      </div>
    );
  }

  const width = 640;
  const height = 300;
  const paddingLeft = 48;
  const paddingRight = 16;
  const paddingTop = 28;
  const paddingBottom = 52;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...chartData.map((d) => d.value), 5);
  const palette = [
    '#0f5c4c', '#c0392b', '#2980b9', '#8e44ad', '#d35400',
    '#16a085', '#e74c3c', '#3498db', '#9b59b6', '#f39c12',
    '#1abc9c', '#e67e22', '#2c3e50', '#27ae60', '#7f8c8d',
    '#1a5276', '#7d3c98', '#117a65', '#b9770e', '#922b21'
  ];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-h-[340px] h-auto bg-white border border-slate-200 rounded-lg p-2">
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = paddingTop + chartHeight * (1 - ratio);
        const val = Math.round(maxValue * ratio);
        return (
          <g key={i}>
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
            <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className="fill-slate-400" style={{ fontSize: 10 }}>{val}</text>
          </g>
        );
      })}
      {chartData.map((d, i) => {
        const barWidth = Math.max(14, chartWidth / chartData.length - 10);
        const x = paddingLeft + i * (chartWidth / chartData.length) + 5;
        const barHeight = (d.value / maxValue) * chartHeight;
        const y = paddingTop + chartHeight - barHeight;
        return (
          <g key={d.name}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={palette[i % palette.length]} rx="2" />
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 10, fontWeight: 700 }}>{d.value}</text>
            <text x={x + barWidth / 2} y={height - paddingBottom + 14} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 8 }}>
              {d.name.length > 9 ? `${d.name.slice(0, 8)}…` : d.name}
            </text>
          </g>
        );
      })}
      <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#cbd5e1" />
      <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke="#cbd5e1" />
    </svg>
  );
}

export function SvgPieChart({ data }) {
  const chartData = aggregateCasesByDisease(data);
  if (!chartData.length) {
    return (
      <div className="text-xs text-slate-400 font-mono py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
        No cases match the selected filters.
      </div>
    );
  }

  const size = 280;
  const cx = size / 2;
  const cy = size / 2 - 6;
  const radius = 88;
  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  const palette = [
    '#0f5c4c', '#c0392b', '#2980b9', '#8e44ad', '#d35400',
    '#16a085', '#e74c3c', '#3498db', '#9b59b6', '#f39c12',
    '#1abc9c', '#e67e22', '#2c3e50', '#27ae60', '#7f8c8d',
    '#1a5276', '#7d3c98', '#117a65', '#b9770e', '#922b21',
    '#148f77', '#2471a3', '#6c3483', '#af601a', '#1e8449',
    '#cb4335', '#2874a6', '#a569bd', '#d68910', '#196f3d'
  ];

  let cumulative = 0;
  const twoPi = Math.PI * 2;
  const slices = chartData.map((d, i) => {
    const startAngle = (cumulative / total) * twoPi - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * twoPi - Math.PI / 2;
    const sweep = endAngle - startAngle;
    // SVG arc with identical start/end cannot draw a full circle — use <circle> instead.
    const isFullCircle = chartData.length === 1 || d.value >= total || sweep >= twoPi - 1e-6;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const mid = isFullCircle ? 0 : (startAngle + endAngle) / 2;
    return {
      ...d,
      isFullCircle,
      path: isFullCircle
        ? null
        : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: palette[i % palette.length],
      pct: Math.round((d.value / total) * 100),
      labelX: isFullCircle ? cx : cx + radius * 0.62 * Math.cos(mid),
      labelY: isFullCircle ? cy : cy + radius * 0.62 * Math.sin(mid),
      showLabel: d.value / total >= 0.08
    };
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full sm:w-[42%] max-w-md mx-auto sm:mx-0 h-auto shrink-0">
          {slices.map((s) => (
            s.isFullCircle ? (
              <circle key={s.name} cx={cx} cy={cy} r={radius} fill={s.color} stroke="#fff" strokeWidth="2">
                <title>{`${s.name}: ${s.value} (${s.pct}%)`}</title>
              </circle>
            ) : (
              <path key={s.name} d={s.path} fill={s.color} stroke="#fff" strokeWidth="2">
                <title>{`${s.name}: ${s.value} (${s.pct}%)`}</title>
              </path>
            )
          ))}
          {slices.filter((s) => s.showLabel).map((s) => (
            <text key={`l-${s.name}`} x={s.labelX} y={s.labelY} textAnchor="middle" dominantBaseline="middle" fill="#fff" style={{ fontSize: 9, fontWeight: 700 }}>
              {s.pct}%
            </text>
          ))}
        </svg>
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 min-w-0">
          {slices.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-xs text-slate-700 min-w-0">
              <span className="w-3 h-3 rounded-sm shrink-0 border border-black/10" style={{ backgroundColor: s.color }} />
              <span className="font-semibold truncate">{s.name}</span>
              <span className="font-mono text-slate-400 ml-auto shrink-0">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Precise Bangladesh division choropleth from geoBoundaries ADM1 geometry.
 * Visual concept aligned to official BD division outline maps.
 */
export function ProjectedBubbleMap({ data }) {
  const [hoverKey, setHoverKey] = useState(null);
  const { width, height } = MAP_VIEW;

  const byDivision = useMemo(() => {
    const map = {};
    (data || []).forEach((row) => {
      const key = normalizeDivisionName(row.division);
      if (!key) return;
      if (!map[key]) map[key] = { totalCases: 0, activeCases: 0, totalDeaths: 0 };
      map[key].totalCases += Number(row.totalCases) || 0;
      map[key].activeCases += Number(row.activeCases) || 0;
      map[key].totalDeaths += Number(row.totalDeaths) || 0;
    });
    return map;
  }, [data]);

  const maxCases = useMemo(
    () => Math.max(1, ...BD_DIVISION_PATHS.map((g) => byDivision[g.key]?.totalCases || 0)),
    [byDivision]
  );

  const hover = hoverKey
    ? { key: hoverKey, ...(byDivision[hoverKey] || { totalCases: 0, activeCases: 0, totalDeaths: 0 }) }
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">Bangladesh · cases by division</div>
          <div className="text-[11px] text-slate-400">ADM1 division boundaries · hover a region for details</div>
        </div>
        {hover && (
          <div className="text-[11px] font-mono text-slate-600 text-right">
            <span className="font-sans font-bold text-slate-900">{hover.key}</span>
            {' · '}Total {hover.totalCases}
            {' · '}Active {hover.activeCases}
            {' · '}Deaths {hover.totalDeaths}
          </div>
        )}
      </div>

      <div className="flex justify-center bg-white px-3 py-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-xl h-auto"
          role="img"
          aria-label="Bangladesh division case map"
        >
          <rect width={width} height={height} fill="#ffffff" />
          <text
            x={width - 20}
            y={28}
            textAnchor="end"
            fill="#111827"
            style={{ fontSize: 16, fontWeight: 700 }}
          >
            Bangladesh
          </text>

          {/* Fills */}
          {BD_DIVISION_PATHS.map((geom) => {
            const stats = byDivision[geom.key] || { totalCases: 0, activeCases: 0, totalDeaths: 0 };
            const active = hoverKey === geom.key;
            return (
              <path
                key={`fill-${geom.key}`}
                d={geom.path}
                fill={choroplethFill(stats.totalCases, maxCases)}
                stroke="none"
                style={{ cursor: 'pointer', transition: 'fill 160ms ease' }}
                onMouseEnter={() => setHoverKey(geom.key)}
                onMouseLeave={() => setHoverKey(null)}
              >
                <title>
                  {`${geom.label}\nTotal: ${stats.totalCases}\nActive: ${stats.activeCases}\nDeaths: ${stats.totalDeaths}`}
                </title>
              </path>
            );
          })}

          {/* Division outlines only — no external river overlays */}
          {BD_DIVISION_PATHS.map((geom) => (
            <path
              key={`stroke-${geom.key}`}
              d={geom.path}
              fill="none"
              stroke={hoverKey === geom.key ? '#7e3a35' : '#2a1614'}
              strokeWidth={hoverKey === geom.key ? 2 : 1.1}
              strokeLinejoin="round"
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {BD_DIVISION_PATHS.map((geom) => {
            const stats = byDivision[geom.key] || { totalCases: 0 };
            const labelColor = choroplethLabelColor(stats.totalCases, maxCases);
            const halo = labelColor === '#faf7f6' ? 'rgba(42,22,20,0.55)' : 'rgba(250,247,246,0.85)';
            return (
              <g key={`lbl-${geom.key}`} style={{ pointerEvents: 'none' }}>
                <text
                  x={geom.labelX}
                  y={geom.labelY - 5}
                  textAnchor="middle"
                  fill={labelColor}
                  stroke={halo}
                  strokeWidth="2.6"
                  paintOrder="stroke"
                  style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}
                >
                  {geom.label}
                </text>
                <text
                  x={geom.labelX}
                  y={geom.labelY + 12}
                  textAnchor="middle"
                  fill={labelColor}
                  stroke={halo}
                  strokeWidth="2.4"
                  paintOrder="stroke"
                  style={{ fontSize: 11.5, fontWeight: 700 }}
                >
                  {stats.totalCases}
                </text>
              </g>
            );
          })}

          <g transform={`translate(20, ${height - 48})`}>
            <text x={0} y={0} fill="#6b5e5c" style={{ fontSize: 10, fontWeight: 600 }}>Fewer</text>
            {['#f7f1f0', '#e8d0cc', '#c9968f', '#a85f57', '#7e3a35', '#4c1f1c'].map((c, i) => (
              <rect key={c} x={42 + i * 28} y={-10} width={28} height={12} fill={c} stroke="#d9c8c5" strokeWidth="0.5" />
            ))}
            <text x={42 + 6 * 28 + 8} y={0} fill="#6b5e5c" style={{ fontSize: 10, fontWeight: 600 }}>More</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

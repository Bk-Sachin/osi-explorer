import { DeviceIcon } from './Icons.jsx';
import { KIND, route, pointAt, useProgress, ease } from '../lib/util.js';

export default function NetworkView({ scn, visible, latest, animKey, speed, onInspect }) {
  const dur = 1300 / speed;
  const p = useProgress(animKey, dur, !!latest);
  const color = latest ? KIND[latest.kind] : 'var(--accent)';

  const targets = latest ? [].concat(latest.to) : [];
  const paths = targets.map((t) => route(scn, latest.from, t));
  const hotLinks = new Set();
  paths.forEach((path) => path.slice(1).forEach((n, i) => { hotLinks.add(`${path[i]}|${n}`); hotLinks.add(`${n}|${path[i]}`); }));
  const activeNodes = new Set(latest ? [latest.from, ...targets] : []);

  return (
    <svg className="net" viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet">
      {scn.links.map(([a, b, label]) => {
        if (!visible.has(a) || !visible.has(b)) return null;
        const A = scn.nodes[a], B = scn.nodes[b];
        const hot = hotLinks.has(`${a}|${b}`) && p < 1;
        return (
          <g key={a + b}>
            <line className={`link ${hot ? 'hot' : ''}`} style={{ '--hot': color }} x1={A.x} y1={A.y} x2={B.x} y2={B.y} />
            {label && <text className="link-label" x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 - 10} textAnchor="middle">{label}</text>}
          </g>
        );
      })}

      {Object.entries(scn.nodes).map(([id, n]) => {
        if (!visible.has(id)) return null;
        const subs = (n.sub || '').split('\n').filter(Boolean);
        return (
          <g key={id} className={`node ${activeNodes.has(id) ? 'active' : ''}`} style={{ '--hot': color }} transform={`translate(${n.x} ${n.y})`}>
            <g className="node-enter">
              <DeviceIcon type={n.type} />
              <text className="node-label" y={50} textAnchor="middle">{n.label}</text>
              {subs.map((s, i) => <text key={i} className="node-sub" y={66 + i * 14} textAnchor="middle">{s}</text>)}
            </g>
          </g>
        );
      })}

      {latest && paths.map((path, i) => {
        const pts = path.map((id) => scn.nodes[id]);
        const stopAt = latest.lost ? latest.lostAt ?? 0.55 : 1;
        const t = ease(p) * stopAt;
        const pt = pointAt(pts, t);
        const w = latest.label.length * 7.2 + 18;
        const done = p >= 1;
        if (done && !latest.lost) return null;
        return (
          <g key={i} style={{ cursor: 'pointer' }} onClick={() => onInspect(latest.no)}>
            {done && latest.lost ? (
              <g transform={`translate(${pt.x} ${pt.y})`}>
                <g className="burst">
                  <circle r="16" fill="#ef4444" opacity=".2" />
                  <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
                </g>
                <text y="-24" textAnchor="middle" className="chip-text" style={{ fill: '#ef4444' }}>{latest.label} ✕</text>
              </g>
            ) : (
              <g transform={`translate(${pt.x} ${pt.y})`}>
                <rect x={-w / 2} y={-11} width={w} height={22} rx="3" fill={color} />
                <text className="chip-text" y="4" textAnchor="middle">{latest.label.toUpperCase()}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

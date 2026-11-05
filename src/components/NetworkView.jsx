import { DeviceIcon } from './Icons.jsx';
import { KIND, route, useElapsed, journey, journeyState, holdText } from '../lib/util.js';

const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

export default function NetworkView({ scn, visible, latest, animKey, speed, paused, onInspect }) {
  const j = latest ? journey(scn, latest) : null;
  // run a little past the journey so the arrival pulse and fade-out finish
  const t = useElapsed(animKey, { enabled: !!latest, max: j ? j.total + 900 : 1, paused, rate: speed });
  const color = latest ? KIND[latest.kind] : 'var(--accent)';
  const state = j ? journeyState(j, t) : null;

  const targets = latest ? [].concat(latest.to) : [];
  const paths = latest ? targets.map((tg) => route(scn, latest.from, tg)) : [];

  // current link highlight
  const hot = new Set();
  if (state && state.phase === 'travel') paths.forEach((p) => { const a = p[state.seg], b = p[state.seg + 1]; if (a && b) { hot.add(`${a}|${b}`); hot.add(`${b}|${a}`); } });
  const done = new Set();
  if (state) paths.forEach((p) => p.slice(1).forEach((n, i) => { if (i < state.seg || (i === state.seg && state.phase !== 'travel')) { done.add(`${p[i]}|${n}`); done.add(`${n}|${p[i]}`); } }));

  // narration
  let caption = null;
  if (state && latest) {
    const name = (id) => scn.nodes[id]?.label;
    const p0 = j.path;
    if (state.phase === 'travel') caption = { tag: `Hop ${state.seg + 1}/${j.hops}`, text: `${name(p0[state.seg])} → ${name(p0[state.seg + 1])}: ${latest.label}` };
    else if (state.phase === 'hold') caption = { tag: name(state.node), text: holdText(scn, latest, state.node), k: state.holdK, key: `hold-${state.node}` };
    else if (state.phase === 'lost') caption = { tag: 'Lost', text: latest.lostWhy || `${latest.label} never arrives. ${latest.note}`, bad: true };
    else caption = { tag: 'Delivered', text: `${targets.map(name).join(' and ')} received it: ${latest.note}` };
  }

  return (
    <>
      {caption && (
        <div className={`narrate ${caption.bad ? 'bad' : ''} ${paused ? 'is-paused' : ''}`} style={{ '--kc': color }} key={caption.key || caption.tag + caption.text} aria-live="polite">
          <span className="tag">{caption.tag}</span>
          <span>{caption.text}</span>
          {paused && <span className="paused-badge">Paused</span>}
          {caption.k != null && <i className="narrate-timer" style={{ transform: `scaleX(${1 - caption.k})` }} aria-hidden="true" />}
        </div>
      )}
      <svg className="net" viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {scn.links.map(([a, b, label]) => {
          if (!visible.has(a) || !visible.has(b)) return null;
          const A = scn.nodes[a], B = scn.nodes[b];
          const isHot = hot.has(`${a}|${b}`), isDone = done.has(`${a}|${b}`);
          return (
            <g key={a + b}>
              <line className={`link ${isHot ? 'hot' : ''} ${isDone ? 'trod' : ''}`} style={{ '--hot': color }} x1={A.x} y1={A.y} x2={B.x} y2={B.y} />
              {label && <text className="link-label" x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 - 10} textAnchor="middle">{label}</text>}
            </g>
          );
        })}

        {Object.entries(scn.nodes).map(([id, n]) => {
          if (!visible.has(id)) return null;
          const subs = (n.sub || '').split('\n').filter(Boolean);
          const holding = state?.phase === 'hold' && state.node === id;
          const sender = latest && id === latest.from && state?.phase === 'travel' && state.seg === 0;
          const receiver = latest && targets.includes(id) && state?.phase === 'arrived';
          return (
            <g key={id} className={`node ${holding || sender || receiver ? 'active' : ''}`} style={{ '--hot': color }} transform={`translate(${n.x} ${n.y})`}>
              {(holding || receiver) && (
                <circle r={36 + (holding ? (state.after % 1400) / 1400 : Math.min(1, state.after / 900)) * 30} fill="none" stroke={color} strokeWidth="2"
                  opacity={1 - (holding ? (state.after % 1400) / 1400 : Math.min(1, state.after / 900))} />
              )}
              <g className="node-enter">
                <DeviceIcon type={n.type} />
                <text className="node-label" y={50} textAnchor="middle">{n.label}</text>
                {subs.map((s, i) => <text key={i} className="node-sub" y={66 + i * 14} textAnchor="middle">{s}</text>)}
              </g>
            </g>
          );
        })}

        {latest && state && paths.map((path, i) => {
          const pts = path.map((id) => scn.nodes[id]);
          const a = pts[state.seg], b = pts[state.seg + 1] || a;
          const pt = lerp(a, b, state.k);
          const w = latest.label.length * 7.4 + 22;
          if (state.phase === 'arrived' && !latest.lost) {
            if (state.after > 700) return null;
            const fade = 1 - state.after / 700;
            const end = pts[pts.length - 1];
            return <g key={i} opacity={fade} transform={`translate(${end.x} ${end.y - 60})`}><rect x={-w / 2} y={-11} width={w} height={22} rx="4" fill={color} /><text className="chip-text" y="4" textAnchor="middle">✓ {latest.label.toUpperCase()}</text></g>;
          }
          if (state.phase === 'lost') {
            return (
              <g key={i} transform={`translate(${pt.x} ${pt.y})`}>
                <g className="burst">
                  <circle r="18" fill="#ef4444" opacity=".2" />
                  <path d="M-9 -9 L9 9 M9 -9 L-9 9" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                </g>
                <text y="-26" textAnchor="middle" className="chip-text" style={{ fill: '#ef4444' }}>{latest.label} ✕</text>
              </g>
            );
          }
          return (
            <g key={i} style={{ cursor: 'pointer' }} onClick={() => onInspect(latest.no)}>
              {state.phase === 'travel' && <line x1={a.x} y1={a.y} x2={pt.x} y2={pt.y} stroke={color} strokeWidth="5" strokeLinecap="round" opacity=".35" />}
              <g transform={`translate(${pt.x} ${pt.y})`} filter="url(#glow)">
                <rect x={-w / 2} y={-12} width={w} height={24} rx="4" fill={color} />
                <text className="chip-text" y="4" textAnchor="middle">{latest.label.toUpperCase()}</text>
              </g>
            </g>
          );
        })}
      </svg>
    </>
  );
}

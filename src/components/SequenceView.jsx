import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { KIND, useProgress } from '../lib/util.js';

export default function SequenceView({ scn, stepIdx, sent, animKey, speed, onInspect }) {
  const box = useRef();
  const [w, setW] = useState(800);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const p = useProgress(animKey, 700 / speed, sent.length > 0);

  const cols = scn.seq;
  const pad = 150;
  const colX = (id) => {
    const i = cols.indexOf(id);
    return pad + (i * (w - pad - 40)) / Math.max(1, cols.length - 1);
  };

  // rows: step headers and packets
  const rows = [];
  for (let s = 0; s <= stepIdx; s++) {
    const step = scn.steps[s];
    rows.push({ type: 'step', s, step });
    for (const pk of sent) if (pk.step === s) rows.push({ type: 'pk', pk });
  }
  let y = 16;
  const placed = rows.map((r) => { const o = { ...r, y }; y += r.type === 'step' ? 30 : 46; return o; });
  const height = Math.max(y + 20, 200);
  const latestNo = sent.length ? sent[sent.length - 1].no : -1;

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [sent.length, stepIdx]);

  return (
    <div className="seq">
      <div className="seq-head">
        {cols.map((c) => (
          <div key={c} style={{ left: colX(c) }}><b>{scn.nodes[c].label}</b><small>{(scn.nodes[c].sub || '').split('\n')[0]}</small></div>
        ))}
      </div>
      <div className="seq-scroll" ref={box}>
        {stepIdx < 0 ? <div className="seq-empty">Press STEP or PLAY to start the exchange.</div> : (
          <svg width={w} height={height} style={{ display: 'block' }}>
            {cols.map((c) => <line key={c} x1={colX(c)} x2={colX(c)} y1={0} y2={height} stroke="var(--line2)" strokeDasharray="3 5" />)}
            {placed.map((r, i) => {
              if (r.type === 'step') {
                return (
                  <g key={'s' + i}>
                    <line x1={10} x2={w - 10} y1={r.y + 4} y2={r.y + 4} stroke="var(--line)" />
                    <text x={14} y={r.y + 20} fill="var(--accent)" fontSize="10.5" letterSpacing=".08em">STEP {r.s + 1} · {r.step.title.toUpperCase()}</text>
                  </g>
                );
              }
              const pk = r.pk;
              const c = KIND[pk.kind];
              const anim = pk.no === latestNo ? p : 1;
              return [].concat(pk.to).map((to, j) => {
                const x1 = colX(pk.from), x2 = colX(to);
                const stop = pk.lost ? 0.6 : 1;
                const xe = x1 + (x2 - x1) * stop * anim;
                const y1 = r.y + 14, y2 = r.y + 34;
                const ye = y1 + (y2 - y1) * stop * anim;
                const dir = x2 > x1 ? 1 : -1;
                const mx = (x1 + xe) / 2, my = (y1 + ye) / 2;
                return (
                  <g key={`${pk.no}-${j}`} style={{ cursor: 'pointer' }} onClick={() => onInspect(pk.no)}>
                    <text x={14} y={r.y + 30} fill="var(--muted)" fontSize="10.5">{pk.t.toFixed(3)}s</text>
                    <line x1={x1} y1={y1} x2={xe} y2={ye} stroke={c} strokeWidth="2" />
                    {anim >= 1 && !pk.lost && <path d={`M${x2} ${y2} l${-9 * dir} -7 l0 9 z`} fill={c} />}
                    {anim >= 1 && pk.lost && <path d={`M${xe - 6} ${ye - 6} l12 12 m0 -12 l-12 12`} stroke="#ef4444" strokeWidth="3" />}
                    {j === 0 && anim > 0.3 && (
                      <g transform={`translate(${mx} ${my - 4}) rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI})`}>
                        <rect x={-(pk.label.length * 3.6 + 8)} y={-10} width={pk.label.length * 7.2 + 16} height={16} rx="2" fill={c} />
                        <text textAnchor="middle" y={2} fontSize="10" fontWeight="700" fill="#0a0e17">{pk.label.toUpperCase()}</text>
                      </g>
                    )}
                  </g>
                );
              });
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

import { LAYERS } from '../data/layers.js';
import { STUDY } from '../data/study.js';
import { byLayer } from '../data/scenarios/index.js';

// Lay header fields onto 32-bit rows, splitting fields that cross a row boundary
function layout(fields) {
  const rows = [[]];
  let used = 0;
  for (const [name, bits, note] of fields) {
    let left = bits, first = true;
    while (left > 0) {
      const take = Math.min(left, 32 - used);
      rows[rows.length - 1].push({ name: first ? name : '', cont: !first, bits: take, total: bits, note });
      used += take; left -= take; first = false;
      if (used === 32) { rows.push([]); used = 0; }
    }
  }
  if (!rows[rows.length - 1].length) rows.pop();
  return rows;
}

function HeaderDiagram({ h, color }) {
  const rows = layout(h.rows);
  return (
    <div className="hdr">
      <h5>{h.name}</h5>
      <div className="hdr-ruler">{[0, 8, 16, 24].map((b) => <span key={b}>{b}</span>)}<span>31</span></div>
      {rows.map((r, i) => (
        <div className="hdr-row" key={i}>
          {r.map((f, j) => (
            <div key={j} className={`hdr-f ${f.cont ? 'cont' : ''}`} style={{ flex: f.bits, '--lc': color }} title={`${f.name || 'continued'}: ${f.total} bits${f.note ? ` (${f.note})` : ''}`}>
              <span>{f.name || '…'}</span>
              {!f.cont && <small>{f.note === 'variable' ? 'variable' : `${f.total} bit${f.total > 1 ? 's' : ''}`}</small>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function StudyView({ layer, setLayer, onPick }) {
  const S = STUDY[layer];
  const L = LAYERS[layer];
  const lessons = byLayer(layer);
  return (
    <>
      <div className="lab-switch" aria-label="Choose study layer">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button key={n} className={n === layer ? 'on' : ''} style={{ '--lc': LAYERS[n].color }} title={`${LAYERS[n].name} study guide`} onClick={() => setLayer(n)}>{n}</button>
        ))}
      </div>
      <div className="lab study" style={{ '--lc': L.color }}>
        <div className="kicker" style={{ color: L.color }}>Layer {layer} study guide. Its unit of data is called a {L.pdu.toLowerCase()}.</div>
        <h3>{S.title}</h3>
        <p className="lab-sub" style={{ fontSize: 12.5, color: 'var(--text)' }}>{S.purpose}</p>
        <p className="lab-sub"><b>In the TCP/IP model:</b> {S.tcpip}</p>

        <section>
          <h4>Core concepts</h4>
          <div className="concepts">
            {S.concepts.map(([k, v]) => <div key={k} className="concept"><b>{k}</b><p>{v}</p></div>)}
          </div>
        </section>

        <section>
          <h4>Header anatomy</h4>
          <p className="lab-sub">Each row is 32 bits (4 bytes), the way RFCs draw headers. Hover a field for its size.</p>
          {S.headers.map((h) => <HeaderDiagram key={h.name} h={h} color={L.color} />)}
        </section>

        <div className="grid2">
          <section>
            <h4>How it works, step by step</h4>
            <ol className="how">{S.how.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </section>
          <section>
            <h4>Exam & interview pointers</h4>
            <ul className="how">{S.exam.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        </div>

        <section>
          <h4>Try it on your own computer</h4>
          <table className="mini">
            <tbody>{S.commands.map(([c, d]) => <tr key={c}><td><code>{c}</code></td><td style={{ color: 'var(--muted)' }}>{d}</td></tr>)}</tbody>
          </table>
        </section>

        <section>
          <h4>Troubleshooting at this layer</h4>
          <table className="mini">
            <thead><tr><th>Symptom</th><th>Likely cause / fix</th></tr></thead>
            <tbody>{S.troubleshoot.map(([s, c]) => <tr key={s}><td>{s}</td><td>{c}</td></tr>)}</tbody>
          </table>
        </section>

        <section>
          <h4>Lessons for this layer</h4>
          <div className="row">
            {lessons.map((s) => <button key={s.id} className="btn" onClick={() => onPick(s.id)}>▶ {s.name}: {s.tag}</button>)}
          </div>
        </section>
      </div>
    </>
  );
}

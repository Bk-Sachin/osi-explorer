import { LAYERS, LAYER_ORDER } from '../data/layers.js';
import { useProgress } from '../lib/util.js';

const IMPLICIT = {
  7: 'Application data created by the program',
  6: 'Encoding / compression applied by libraries (no header of its own here)',
  5: 'Conversation state kept by the app / OS (no header of its own here)',
  1: 'Bits converted to a signal by the network card',
};

export default function StackView({ scn, packet, animKey, speed, onInspect }) {
  const p = useProgress(animKey, 2600 / speed, !!packet);
  if (!packet) {
    return (
      <div className="stack">
        <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--display)' }}>Encapsulation</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0, lineHeight: 1.6 }}>
          Each layer wraps the data from the layer above with its own header, like envelopes inside envelopes. The receiver opens them in reverse order. Send a packet (STEP) to watch it happen.
        </p>
        {LAYER_ORDER.map((n) => (
          <div key={n} className="stack-row" style={{ '--lc': LAYERS[n].color }}>
            <span className="n">{n}</span>
            <span className="t"><b>{LAYERS[n].name}</b> · PDU: {LAYERS[n].pdu}<small>{LAYERS[n].job}</small></span>
          </div>
        ))}
      </div>
    );
  }

  const fr = packet.frame;
  const byOsi = (n) => fr.layers.filter((l) => l.osi === n);
  // light rows: sender 7→1 during first half, receiver 1→7 during second half
  const sendLit = Math.floor(Math.min(1, p * 2) * 7.999); // 0..7
  const recvLit = p < 0.5 ? -1 : Math.floor((p - 0.5) * 2 * 7.999);
  const fromN = scn.nodes[packet.from], toN = scn.nodes[[].concat(packet.to)[0]];
  const totalSize = fr.size;

  const row = (n, side, lit) => {
    const ls = byOsi(n);
    const L = LAYERS[n];
    const verb = side === 'send' ? 'adds' : 'reads & strips';
    return (
      <div key={side + n} className={`stack-row ${lit ? 'lit' : ''} ${ls.length ? '' : 'none'}`} style={{ '--lc': L.color }}>
        <span className="n">{n}</span>
        <span className="t">
          <b>{L.name}</b> <span style={{ color: 'var(--muted)' }}>· {L.pdu}</span>
          <small>{ls.length ? `${verb} ${ls.map((l) => `${l.name} (${l.size} B)`).join(' + ')}` : IMPLICIT[n] || 'Nothing at this layer for this packet'}</small>
        </span>
      </div>
    );
  };

  return (
    <div className="stack">
      <div className="stack-cols">
        <div className="stack-col">
          <h4>Sender · {fromN.label} · encapsulate ↓</h4>
          {LAYER_ORDER.map((n, i) => row(n, 'send', i < sendLit))}
        </div>
        <div className="stack-mid">
          <span>{packet.label}</span>
          <div className="wire" />
          <span>{totalSize} B</span>
        </div>
        <div className="stack-col">
          <h4>Receiver · {toN.label} · decapsulate ↑</h4>
          {LAYER_ORDER.map((n, i) => row(n, 'recv', 6 - i < recvLit))}
        </div>
      </div>
      <div className="wirebar" title="Bytes on the wire, by layer" onClick={() => onInspect(packet.no)} style={{ cursor: 'pointer' }}>
        {fr.layers.map((l, i) => (
          <div key={i} style={{ flex: Math.max(l.size, totalSize * 0.04), background: LAYERS[l.osi].color }} title={`${l.name}: ${l.size} bytes`}>
            {l.name} {l.size}B
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 10.5, margin: '6px 0 0' }}>Bar = bytes on the wire by layer (click to inspect every field). Routers only open up to Layer 3; switches only Layer 2.</p>
    </div>
  );
}

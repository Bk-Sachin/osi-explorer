import { LAYERS, LAYER_ORDER } from '../data/layers.js';
import { useElapsed } from '../lib/util.js';

const IMPLICIT = {
  7: 'Application data created by the program',
  6: 'Encoding / compression applied by libraries (no header of its own here)',
  5: 'Conversation state kept by the app / OS (no header of its own here)',
  1: 'Bits converted to a signal by the network card',
};
const ROW_MS = 1100;
const WIRE_MS = 1800;
const TOTAL = ROW_MS * 7 + WIRE_MS + ROW_MS * 7;
export const STACK_TOTAL = TOTAL;

export default function StackView({ scn, packet, animKey, speed, paused, onInspect }) {
  const ms = useElapsed(animKey, { enabled: !!packet, max: TOTAL + 50, paused, rate: speed });
  if (!packet) {
    return (
      <div className="stack">
        <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--display)' }}>Encapsulation</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0, lineHeight: 1.6 }}>
          Each layer wraps the data from the layer above with its own header, like envelopes inside envelopes. The receiver opens them in reverse order. Send a packet (STEP) to watch it happen, layer by layer.
        </p>
        {LAYER_ORDER.map((n) => (
          <div key={n} className="stack-row" style={{ '--lc': LAYERS[n].color }}>
            <span className="n">{n}</span>
            <span className="t"><b>{LAYERS[n].name}</b>, unit: {LAYERS[n].pdu.toLowerCase()}<small>{LAYERS[n].job}</small></span>
          </div>
        ))}
      </div>
    );
  }

  const fr = packet.frame;
  const byOsi = (n) => fr.layers.filter((l) => l.osi === n);
  const sendIdx = Math.min(7, Math.floor(ms / ROW_MS)); // rows lit 0..7
  const wireDone = ms >= ROW_MS * 7 + WIRE_MS;
  const recvIdx = ms < ROW_MS * 7 + WIRE_MS ? -1 : Math.min(7, Math.floor((ms - ROW_MS * 7 - WIRE_MS) / ROW_MS) + 1);
  const onWire = ms >= ROW_MS * 7 && !wireDone;
  const fromN = scn.nodes[packet.from], toN = scn.nodes[[].concat(packet.to)[0]];

  // caption for the row currently being processed
  let cap;
  const describe = (n, verb) => {
    const ls = byOsi(n), L = LAYERS[n];
    return ls.length
      ? <><b>Layer {n} · {L.name}</b> {verb} {ls.map((l) => `${l.name} (${l.size} B): ${l.summary}`).join(' + ')}. The result is called a <b>{L.pdu.toLowerCase()}</b>.</>
      : <><b>Layer {n} · {L.name}</b>: {IMPLICIT[n] || 'nothing to add for this packet'}.</>;
  };
  if (ms < ROW_MS * 7) cap = describe(7 - sendIdx, 'adds');
  else if (onWire) cap = <><b>On the wire</b>: {fr.size} bytes travel as signals from {fromN.label} to {toN.label}{packet.lost ? ' …and this one never makes it.' : '.'}</>;
  else if (recvIdx >= 1 && recvIdx <= 7 && ms < TOTAL) cap = describe(recvIdx, 'reads and strips');
  else cap = <><b>Done</b>: {toN.label} has unwrapped every layer. {packet.note}</>;
  const capLayer = ms < ROW_MS * 7 ? 7 - sendIdx : recvIdx >= 1 && recvIdx <= 7 && ms < TOTAL ? recvIdx : packet.lost ? 1 : 7;

  const row = (n, side, lit, current) => {
    const ls = byOsi(n);
    const L = LAYERS[n];
    const verb = side === 'send' ? 'adds' : 'reads & strips';
    return (
      <div key={side + n} className={`stack-row ${lit ? 'lit' : ''} ${current ? 'cur' : ''} ${ls.length ? '' : 'none'}`} style={{ '--lc': L.color }}>
        <span className="n">{n}</span>
        <span className="t">
          <b>{L.name}</b> <span style={{ color: 'var(--muted)' }}>{L.pdu.toLowerCase()}</span>
          <small>{ls.length ? `${verb} ${ls.map((l) => `${l.name} (${l.size} B)`).join(' + ')}` : IMPLICIT[n] || 'Nothing at this layer for this packet'}</small>
        </span>
      </div>
    );
  };

  const sendingRow = ms < ROW_MS * 7 ? sendIdx : -1;
  return (
    <div className="stack">
      <div className="stack-cols">
        <div className="stack-col">
          <h4>Sender: {fromN.label} wraps it</h4>
          {LAYER_ORDER.map((n, i) => row(n, 'send', i <= sendIdx && ms > 0, i === sendingRow))}
        </div>
        <div className="stack-mid">
          <span>{packet.label}</span>
          <div className={`wire ${onWire ? 'live' : ''}`} />
          <span>{fr.size} B</span>
        </div>
        <div className="stack-col">
          <h4>Receiver: {toN.label} unwraps it</h4>
          {LAYER_ORDER.map((n, i) => row(n, 'recv', !packet.lost && 7 - i <= recvIdx, !packet.lost && 7 - i === recvIdx && ms < TOTAL))}
        </div>
      </div>
      <div className="stack-caption" style={{ '--lc': LAYERS[capLayer].color }}>{cap}</div>
      <div className="wirebar" title="Bytes on the wire, by layer" onClick={() => onInspect(packet.no)} style={{ cursor: 'pointer' }}>
        {fr.layers.map((l, i) => (
          <div key={i} style={{ flex: Math.max(l.size, fr.size * 0.04), background: LAYERS[l.osi].color }} title={`${l.name}: ${l.size} bytes`}>
            {l.name} {l.size}B
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 10.5, margin: '6px 0 0' }}>Bar = bytes on the wire by layer (click to inspect every field). Routers only open up to Layer 3; switches only Layer 2.</p>
    </div>
  );
}

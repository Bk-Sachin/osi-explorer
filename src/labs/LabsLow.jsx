import { useMemo, useState } from 'react';
import { useProgress } from '../lib/util.js';

/* ======================= Layer 1: Signal Lab ======================= */
const ENC = {
  nrz: { name: 'NRZ-L', desc: '1 = high, 0 = low. Simple, but long runs of the same bit give no transitions, so the receiver\'s clock can drift.' },
  nrzi: { name: 'NRZI', desc: 'A 1 flips the level, a 0 keeps it. Used in USB and (with 4B5B) 100BASE-FX.' },
  manchester: { name: 'Manchester', desc: 'Every bit has a transition in the middle: low→high = 1, high→low = 0. Self-clocking; used by 10BASE-T. Costs twice the bandwidth.' },
  mlt3: { name: 'MLT-3', desc: 'Cycles 0 → + → 0 → − on each 1, holds on 0. Lower frequency than NRZI; used by 100BASE-TX.' },
};
const MEDIA = {
  copper: { name: 'Copper (Cat 6)', v: '≈ 0.65 c (195,000 km/s)', reach: '100 m', note: 'Voltage on twisted pairs. Twisting cancels interference.' },
  fiber: { name: 'Fiber', v: '≈ 0.68 c (204,000 km/s)', reach: '550 m – 80 km', note: 'Light pulses: on/off. Immune to electrical noise.' },
  radio: { name: 'Wi-Fi radio', v: '≈ 1 c (300,000 km/s)', reach: '≈ 30–50 m indoors', note: 'Bits modulated onto a 2.4/5/6 GHz carrier. Shared, noisy medium.' },
};

function encode(bits, enc) {
  const out = []; // two samples per bit
  let lvl = -1, m = 0; const mlt = [0, 1, 0, -1];
  for (const b of bits) {
    if (enc === 'nrz') out.push(b ? 1 : -1, b ? 1 : -1);
    else if (enc === 'nrzi') { if (b) lvl = -lvl; out.push(lvl, lvl); }
    else if (enc === 'manchester') out.push(b ? -1 : 1, b ? 1 : -1);
    else { if (b) m = (m + 1) % 4; out.push(mlt[m], mlt[m]); }
  }
  return out;
}
function decode(samples, enc) {
  const bits = [];
  let prev = enc === 'nrzi' ? -1 : 0;
  for (let i = 0; i < samples.length; i += 2) {
    const a = samples[i], b = samples[i + 1];
    if (enc === 'nrz') bits.push(a + b > 0 ? 1 : 0);
    else if (enc === 'nrzi') { const l = a + b > 0 ? 1 : -1; bits.push(l !== prev ? 1 : 0); prev = l; }
    else if (enc === 'manchester') bits.push(b > a ? 1 : 0);
    else { const avg = (a + b) / 2; const l = avg > 0.5 ? 1 : avg < -0.5 ? -1 : 0; bits.push(l !== prev ? 1 : 0); prev = l; }
  }
  return bits;
}

export function SignalLab() {
  const [text, setText] = useState('Hi!');
  const [enc, setEnc] = useState('manchester');
  const [medium, setMedium] = useState('copper');
  const [noise, setNoise] = useState(0.15);
  const [seed, setSeed] = useState(1);
  const bits = useMemo(() => [...new TextEncoder().encode(text.slice(0, 8))].flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((k) => (b >> k) & 1)), [text]);
  const clean = useMemo(() => encode(bits, enc), [bits, enc]);
  const noisy = useMemo(() => {
    let s = seed * 9301;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const k = medium === 'fiber' ? 0.4 : medium === 'radio' ? 1.6 : 1;
    return clean.map((v) => v + (r() * 2 - 1) * noise * 2.2 * k);
  }, [clean, noise, seed, medium]);
  const got = decode(noisy, enc);
  const errors = got.filter((b, i) => b !== bits[i]).length;

  const W = Math.max(600, bits.length * 22), H = 150, mid = H / 2, amp = 48;
  const step = W / Math.max(1, clean.length);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${i * step} ${mid - v * amp} L${(i + 1) * step} ${mid - v * amp}`).join(' ');

  return (
    <div>
      <h3>Signal Lab, layer 1</h3>
      <p className="lab-sub">Type a few characters and watch them become bits and then a signal. Add noise and see when the receiver starts misreading bits; Layer 2's checksum is what catches those errors.</p>
      <div className="row">
        <label className="field">Text (≤ 8 chars)<input type="text" value={text} maxLength={8} onChange={(e) => setText(e.target.value)} /></label>
        <label className="field">Line coding
          <select value={enc} onChange={(e) => setEnc(e.target.value)}>{Object.entries(ENC).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        </label>
        <label className="field">Medium
          <select value={medium} onChange={(e) => setMedium(e.target.value)}>{Object.entries(MEDIA).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        </label>
        <label className="field">Noise {Math.round(noise * 100)}%<input type="range" min="0" max="1" step="0.01" value={noise} onChange={(e) => setNoise(+e.target.value)} /></label>
        <button className="btn" onClick={() => setSeed((s) => s + 1)}>↻ New noise</button>
      </div>
      <div className="panel-box">
        <h5>Bits sent ({bits.length})</h5>
        <div className="mono-out bits">{bits.map((b, i) => <span key={i} style={{ marginRight: i % 8 === 7 ? 8 : 0 }}>{b}</span>)}</div>
      </div>
      <div className="panel-box" style={{ overflowX: 'auto' }}>
        <h5>Signal on the wire · {ENC[enc].name}</h5>
        <svg width={W} height={H}>
          {bits.map((_, i) => <line key={i} x1={i * step * 2} x2={i * step * 2} y1={8} y2={H - 8} stroke="var(--line)" />)}
          <line x1={0} x2={W} y1={mid} y2={mid} stroke="var(--line2)" strokeDasharray="4 4" />
          <path d={path(clean)} fill="none" stroke="var(--faint)" strokeWidth="1.5" />
          <path d={path(noisy)} fill="none" stroke="var(--l1)" strokeWidth="2" />
        </svg>
        <p style={{ color: 'var(--muted)', margin: '6px 0 0', fontSize: 11 }}>{ENC[enc].desc}</p>
      </div>
      <div className="panel-box">
        <h5>Bits the receiver decoded · <span className={errors ? 'bad' : 'good'}>{errors ? `${errors} bit error${errors > 1 ? 's' : ''}` : 'no errors'}</span></h5>
        <div className="mono-out bits">{got.map((b, i) => <span key={i} className={b !== bits[i] ? 'err' : ''} style={{ marginRight: i % 8 === 7 ? 8 : 0 }}>{b}</span>)}</div>
        <div className="kv" style={{ marginTop: 10 }}>
          <span>Propagation</span><span>{MEDIA[medium].v}</span>
          <span>Typical reach</span><span>{MEDIA[medium].reach}</span>
          <span>Medium</span><span>{MEDIA[medium].note}</span>
        </div>
      </div>
    </div>
  );
}

/* ======================= Layer 2: Switch Lab ======================= */
const HOSTS = [
  { id: 'A', mac: 'aa:00:00:00:00:0a', port: 1, x: 90, y: 60 },
  { id: 'B', mac: 'aa:00:00:00:00:0b', port: 2, x: 510, y: 60 },
  { id: 'C', mac: 'aa:00:00:00:00:0c', port: 3, x: 90, y: 230 },
  { id: 'D', mac: 'aa:00:00:00:00:0d', port: 4, x: 510, y: 230 },
];
const SWP = { x: 300, y: 145 };

export function SwitchLab() {
  const [mode, setMode] = useState('switch');
  const [src, setSrc] = useState('A');
  const [dst, setDst] = useState('B');
  const [table, setTable] = useState({});
  const [log, setLog] = useState([]);
  const [shot, setShot] = useState(null); // {src, outs:[ids], n}
  const p = useProgress(shot?.n ?? 0, 2600, !!shot);

  const send = () => {
    const s = HOSTS.find((h) => h.id === src);
    const bcast = dst === '*';
    const d = HOSTS.find((h) => h.id === dst);
    if (!bcast && s.id === d.id) return;
    const next = { ...table };
    let outs, why;
    if (mode === 'hub') {
      outs = HOSTS.filter((h) => h.id !== s.id).map((h) => h.id);
      why = 'Hub (Layer 1): repeats the signal out of every port. Everyone sees everything; collisions possible.';
    } else {
      const learned = !table[s.mac];
      next[s.mac] = { port: s.port, age: 0 };
      if (bcast) { outs = HOSTS.filter((h) => h.id !== s.id).map((h) => h.id); why = 'Broadcast ff:ff:ff:ff:ff:ff → flood to all other ports.'; }
      else if (table[d.mac]) { outs = [d.id]; why = `Known: ${d.mac} is on port ${table[d.mac].port} → forward there only.`; }
      else { outs = HOSTS.filter((h) => h.id !== s.id).map((h) => h.id); why = `Unknown destination ${d.mac} → flood (then learn from the reply).`; }
      if (learned) why = `Learned ${s.mac} → port ${s.port}. ` + why;
    }
    setTable(next);
    setShot({ src: s.id, outs, n: (shot?.n ?? 0) + 1, dst: bcast ? '*' : d.id });
    setLog((l) => [`${s.id} → ${bcast ? 'broadcast' : dst}: ${why}`, ...l].slice(0, 30));
  };

  const pos = (id) => HOSTS.find((h) => h.id === id);
  const chip = (from, to, t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });

  return (
    <div>
      <h3>Switch Lab, layer 2</h3>
      <p className="lab-sub">Send frames between four hosts. A switch learns which MAC address lives on which port from the source of every frame, floods unknown destinations, and then forwards precisely. Flip to Hub mode to see the old, wasteful way.</p>
      <div className="row">
        <div className="seg">{['switch', 'hub'].map((m) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setTable({}); setLog([]); }}>{m === 'switch' ? 'Switch (L2)' : 'Hub (L1)'}</button>)}</div>
        <label className="field">From<select value={src} onChange={(e) => setSrc(e.target.value)}>{HOSTS.map((h) => <option key={h.id}>{h.id}</option>)}</select></label>
        <label className="field">To<select value={dst} onChange={(e) => setDst(e.target.value)}>{HOSTS.map((h) => <option key={h.id}>{h.id}</option>)}<option value="*">Broadcast</option></select></label>
        <button className="btn primary" onClick={send}>Send frame</button>
        <button className="btn" onClick={() => { setTable({}); setLog([]); setShot(null); }}>Clear table</button>
      </div>
      <div className="grid2" style={{ marginTop: 10 }}>
        <div className="panel-box">
          <svg viewBox="0 0 600 290" width="100%">
            {HOSTS.map((h) => <line key={h.id} x1={h.x} y1={h.y} x2={SWP.x} y2={SWP.y} stroke={shot && (shot.outs.includes(h.id) || shot.src === h.id) && p < 1 ? 'var(--l2)' : 'var(--line2)'} strokeWidth="2" strokeDasharray="5 5" />)}
            <rect x={SWP.x - 60} y={SWP.y - 22} width="120" height="44" rx="6" fill="var(--node-fill)" stroke="var(--node)" strokeWidth="1.8" />
            <text x={SWP.x} y={SWP.y + 5} textAnchor="middle" fill="var(--text)" fontFamily="var(--display)" fontWeight="600">{mode === 'hub' ? 'HUB' : 'SWITCH'}</text>
            {HOSTS.map((h) => {
              const hit = shot && p >= 1 && shot.outs.includes(h.id);
              const accepted = hit && (shot.dst === '*' || shot.dst === h.id);
              return (
                <g key={h.id}>
                  <rect x={h.x - 34} y={h.y - 20} width="68" height="40" rx="5" fill="var(--node-fill)" stroke={hit ? (accepted ? 'var(--l4)' : '#ef4444') : 'var(--node)'} strokeWidth="1.8" />
                  <text x={h.x} y={h.y + 5} textAnchor="middle" fill="var(--text)" fontWeight="700">{h.id}</text>
                  <text x={h.x} y={h.y + 36} textAnchor="middle" fill="var(--muted)" fontSize="10">{h.mac} · P{h.port}</text>
                  {hit && <text x={h.x} y={h.y - 28} textAnchor="middle" fontSize="10" fill={accepted ? 'var(--l4)' : '#ef4444'}>{accepted ? 'accepted' : 'not for me: discarded'}</text>}
                </g>
              );
            })}
            {shot && p < 1 && (() => {
              const s = pos(shot.src);
              const pts = p < 0.5 ? [chip(s, SWP, p * 2)] : shot.outs.map((o) => chip(SWP, pos(o), (p - 0.5) * 2));
              return pts.map((pt, i) => <rect key={i} x={pt.x - 18} y={pt.y - 9} width="36" height="18" rx="3" fill="var(--l2)" />);
            })()}
          </svg>
        </div>
        <div>
          <div className="panel-box">
            <h5>MAC address table {mode === 'hub' && '(hubs have none)'}</h5>
            <table className="mini">
              <thead><tr><th>MAC</th><th>Port</th><th>Host</th></tr></thead>
              <tbody>
                {Object.entries(table).map(([m, v]) => <tr key={m + v.port} className="flash"><td>{m}</td><td>P{v.port}</td><td>{HOSTS.find((h) => h.mac === m).id}</td></tr>)}
                {!Object.keys(table).length && <tr><td colSpan="3" style={{ color: 'var(--muted)' }}>empty</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="panel-box">
            <h5>Decisions</h5>
            <div className="log">{log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <div style={{ color: 'var(--muted)' }}>Send a frame to begin.</div>}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= Layer 3: Routing Lab ======================= */
const toInt = (ip) => ip.split('.').reduce((a, o) => ((a << 8) | (+o & 255)) >>> 0, 0);
const toIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
const maskOf = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
const validIp = (s) => /^(\d{1,3})(\.\d{1,3}){3}$/.test(s) && s.split('.').every((o) => +o <= 255);
const bin = (n) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0'));

const ROUTES = [
  { net: '192.168.1.0', p: 24, via: 'direct', iface: 'eth0', note: 'Local LAN' },
  { net: '10.0.0.0', p: 8, via: '10.255.0.1', iface: 'eth1', note: 'Corporate network' },
  { net: '10.20.0.0', p: 16, via: '10.255.0.2', iface: 'eth1', note: 'Branch office' },
  { net: '10.20.30.0', p: 24, via: '10.255.0.3', iface: 'eth1', note: 'Branch lab' },
  { net: '172.16.0.0', p: 12, via: '172.31.255.1', iface: 'eth2', note: 'Data centre' },
  { net: '0.0.0.0', p: 0, via: '203.0.113.1', iface: 'wan0', note: 'Default route: the internet' },
];

export function RoutingLab() {
  const [ip, setIp] = useState('192.168.1.130');
  const [prefix, setPrefix] = useState(26);
  const [dest, setDest] = useState('10.20.30.7');
  const ok = validIp(ip);
  const n = ok ? toInt(ip) : 0, m = maskOf(prefix);
  const net = (n & m) >>> 0, bc = (net | (~m >>> 0)) >>> 0;
  const hosts = prefix >= 31 ? (prefix === 32 ? 1 : 2) : 2 ** (32 - prefix) - 2;

  const dOk = validIp(dest);
  const d = dOk ? toInt(dest) : 0;
  const matches = ROUTES.map((r) => dOk && ((d & maskOf(r.p)) >>> 0) === toInt(r.net));
  const best = matches.reduce((b, mt, i) => (mt && (b < 0 || ROUTES[i].p > ROUTES[b].p) ? i : b), -1);

  return (
    <div>
      <h3>Routing Lab, layer 3</h3>
      <p className="lab-sub">An IPv4 address is 32 bits: the prefix length says how many of them name the network. Routers forward by finding every route that matches the destination and picking the most specific one (longest prefix match).</p>
      <div className="grid2">
        <div className="panel-box">
          <h5>Subnet calculator</h5>
          <div className="row">
            <label className="field">IP address<input type="text" value={ip} onChange={(e) => setIp(e.target.value.trim())} /></label>
            <label className="field">Prefix /{prefix}<input type="range" min="0" max="32" value={prefix} onChange={(e) => setPrefix(+e.target.value)} /></label>
          </div>
          {ok ? (
            <>
              <div className="mono-out" style={{ margin: '10px 0' }}>
                {['Address', 'Mask'].map((lbl, k) => (
                  <div key={lbl}><span style={{ color: 'var(--muted)', display: 'inline-block', width: 70 }}>{lbl}</span>
                    {bin(k ? m : n).map((o, oi) => (
                      <span key={oi} style={{ marginRight: 6 }}>{[...o].map((b, bi) => <span key={bi} style={{ color: oi * 8 + bi < prefix ? 'var(--l3)' : 'var(--l4)' }}>{b}</span>)}</span>
                    ))}
                  </div>
                ))}
                <div style={{ fontSize: 10.5, color: 'var(--muted)' }}><span style={{ color: 'var(--l3)' }}>■ network bits</span> · <span style={{ color: 'var(--l4)' }}>■ host bits</span></div>
              </div>
              <div className="kv">
                <span>Subnet mask</span><span>{toIp(m)}</span>
                <span>Network</span><span>{toIp(net)}/{prefix}</span>
                <span>Broadcast</span><span>{toIp(bc)}</span>
                <span>Usable hosts</span><span>{prefix >= 31 ? toIp(net) + ' – ' + toIp(bc) : `${toIp(net + 1)} – ${toIp(bc - 1)}`}</span>
                <span>Host count</span><span>{hosts.toLocaleString()}</span>
              </div>
            </>
          ) : <p className="bad">Enter a valid IPv4 address.</p>}
        </div>
        <div className="panel-box">
          <h5>Routing table lookup</h5>
          <label className="field">Destination IP<input type="text" value={dest} onChange={(e) => setDest(e.target.value.trim())} /></label>
          <div className="row" style={{ margin: '6px 0' }}>
            {['192.168.1.42', '10.1.2.3', '10.20.99.1', '10.20.30.7', '172.20.0.9', '8.8.8.8'].map((x) => <button key={x} className="btn sm" onClick={() => setDest(x)}>{x}</button>)}
          </div>
          <table className="mini">
            <thead><tr><th>Destination</th><th>Next hop</th><th>If</th><th></th></tr></thead>
            <tbody>
              {ROUTES.map((r, i) => (
                <tr key={i} className={i === best ? 'match' : ''} style={{ opacity: matches[i] ? 1 : 0.5 }}>
                  <td>{r.net}/{r.p}</td><td>{r.via}</td><td>{r.iface}</td>
                  <td>{i === best ? '★ chosen' : matches[i] ? 'matches' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dOk && best >= 0 && (
            <p style={{ lineHeight: 1.6, marginBottom: 0 }}>
              {matches.filter(Boolean).length} route(s) match; the longest prefix is <b>/{ROUTES[best].p}</b> ({ROUTES[best].note}).{' '}
              {ROUTES[best].via === 'direct' ? 'The destination is on a directly connected network: ARP for it and deliver.' : `Forward to ${ROUTES[best].via} out of ${ROUTES[best].iface}, TTL − 1.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

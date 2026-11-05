import { useEffect, useRef, useState } from 'react';

const hexs = (bytes, max = 64) => [...bytes].slice(0, max).map((b) => b.toString(16).padStart(2, '0')).join(' ') + (bytes.length > max ? ` … (+${bytes.length - max})` : '');

/* ======================= Layer 4: Transport Lab ======================= */
function initSim(n) {
  return { tick: 0, segs: Array.from({ length: n }, () => ({ st: 'wait', sentAt: -1, tries: 0 })), base: 0, next: 0, dup: 0, idle: 0, retx: 0, sent: 0, lastAck: 0, log: [] };
}

export function TransportLab() {
  const [proto, setProto] = useState('tcp');
  const [N, setN] = useState(12);
  const [W, setW] = useState(4);
  const [loss, setLoss] = useState(20);
  const [sim, setSim] = useState(() => initSim(12));
  const [auto, setAuto] = useState(false);
  const reset = (n = N) => { setSim(initSim(n)); setAuto(false); };

  const done = proto === 'tcp' ? sim.base >= N : sim.next >= N && sim.segs.every((s) => s.st !== 'fly');

  const tick = () => setSim((s0) => {
    const s = { ...s0, segs: s0.segs.map((x) => ({ ...x })), log: [...s0.log] };
    s.tick++;
    const log = (m) => s.log.unshift(`t=${s.tick}: ${m}`);
    // 1. arrivals
    let arrived = false;
    s.segs.forEach((g, i) => {
      if (g.st === 'fly' && g.sentAt < s.tick) {
        if (Math.random() * 100 < loss) { g.st = 'lost'; log(`segment ${i + 1} lost`); }
        else { g.st = 'recv'; arrived = true; }
      } else if (g.st === 'lost' && proto === 'tcp') g.st = 'gap';
    });
    if (proto === 'udp') {
      for (let k = 0; k < 2 && s.next < N; k++) { s.segs[s.next].st = 'fly'; s.segs[s.next].sentAt = s.tick; s.next++; s.sent++; }
      return s;
    }
    // 2. receiver ACK (cumulative)
    let ack = 0; while (ack < N && s.segs[ack].st === 'recv') ack++;
    if (arrived) {
      if (ack > s.lastAck) { log(`ACK ${ack + 1}${ack >= N ? ' (all data)' : ''}`); s.dup = 0; s.idle = 0; }
      else { s.dup++; log(`duplicate ACK ${ack + 1} (#${s.dup})`); }
    } else s.idle++;
    s.lastAck = ack; s.base = ack;
    // 3. retransmit on 3 dup ACKs or timeout
    if (s.base < N && (s.dup >= 3 || s.idle >= 3) && s.segs[s.base].st !== 'fly') {
      log(`${s.dup >= 3 ? 'fast retransmit' : 'timeout'}: resend segment ${s.base + 1}`);
      s.segs[s.base].st = 'fly'; s.segs[s.base].sentAt = s.tick; s.segs[s.base].tries++; s.retx++; s.sent++; s.dup = 0; s.idle = 0;
    }
    // 4. send new within window
    while (s.next < N && s.next < s.base + W) {
      s.segs[s.next].st = 'fly'; s.segs[s.next].sentAt = s.tick; s.segs[s.next].tries++; s.next++; s.sent++;
    }
    return s;
  });

  const tickRef = useRef(tick); tickRef.current = tick;
  useEffect(() => {
    if (!auto || done) { if (done) setAuto(false); return; }
    const id = setInterval(() => tickRef.current(), 1400);
    return () => clearInterval(id);
  }, [auto, done]);

  const delivered = sim.segs.filter((g) => g.st === 'recv').length;
  const COLORS = { wait: 'var(--line2)', fly: '#f5b700', lost: '#ef4444', gap: 'color-mix(in srgb, #ef4444 35%, var(--panel2))', recv: 'var(--l4)' };

  return (
    <div>
      <h3>Transport Lab, layer 4</h3>
      <p className="lab-sub">Send a file as numbered segments over a lossy network. TCP keeps a window of unacknowledged segments in flight, notices gaps through duplicate ACKs or timeouts, and retransmits. Switch to UDP to see what "no guarantees" means.</p>
      <div className="row">
        <div className="seg">{['tcp', 'udp'].map((p) => <button key={p} className={proto === p ? 'on' : ''} onClick={() => { setProto(p); reset(); }}>{p.toUpperCase()}</button>)}</div>
        <label className="field">Segments {N}<input type="range" min="4" max="24" value={N} onChange={(e) => { setN(+e.target.value); reset(+e.target.value); }} /></label>
        {proto === 'tcp' && <label className="field">Window {W}<input type="range" min="1" max="8" value={W} onChange={(e) => setW(+e.target.value)} /></label>}
        <label className="field">Loss {loss}%<input type="range" min="0" max="60" value={loss} onChange={(e) => setLoss(+e.target.value)} /></label>
        <button className="btn" onClick={tick} disabled={done}>Tick ›</button>
        <button className="btn primary" onClick={() => setAuto((a) => !a)} disabled={done}>{auto ? '❚❚ Pause' : '▶ Auto'}</button>
        <button className="btn" onClick={() => reset()}>↻ Reset</button>
      </div>
      <div className="panel-box">
        <h5>Sender's byte stream {proto === 'tcp' && `· window [${sim.base + 1}–${Math.min(N, sim.base + W)}]`}</h5>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', position: 'relative' }}>
          {sim.segs.map((g, i) => {
            const inWin = proto === 'tcp' && i >= sim.base && i < sim.base + W;
            return (
              <div key={i} title={g.st} style={{ width: 38, height: 38, borderRadius: 4, display: 'grid', placeItems: 'center', background: COLORS[g.st], color: g.st === 'wait' ? 'var(--muted)' : '#0a0e17', fontWeight: 700, outline: inWin ? '2px solid var(--accent)' : 'none', outlineOffset: 2, fontSize: 12, position: 'relative' }}>
                {i + 1}{g.tries > 1 && <sup style={{ position: 'absolute', top: 2, right: 3, fontSize: 9 }}>×{g.tries}</sup>}
              </div>
            );
          })}
        </div>
        <div className="legend" style={{ marginTop: 10 }}>
          {[['wait', 'not sent'], ['fly', 'in flight'], ['lost', 'lost'], ['recv', 'received'], ...(proto === 'tcp' ? [['gap', 'missing (awaiting resend)']] : [])].map(([k, l]) => <span key={k}><i style={{ background: COLORS[k] }} />{l}</span>)}
          {proto === 'tcp' && <span><i style={{ background: 'none', outline: '2px solid var(--accent)' }} />send window</span>}
        </div>
      </div>
      <div className="grid2">
        <div className="panel-box">
          <h5>Result</h5>
          <div className="kv">
            <span>Ticks (round trips)</span><span>{sim.tick}</span>
            <span>Segments sent</span><span>{sim.sent}</span>
            <span>Retransmissions</span><span>{sim.retx}</span>
            <span>Delivered</span><span className={done && delivered < N ? 'bad' : done ? 'good' : ''}>{delivered} / {N}{done ? (delivered === N ? ' ✓ complete & in order' : ' ✗ data missing') : ''}</span>
          </div>
        </div>
        <div className="panel-box">
          <h5>Event log</h5>
          <div className="log">{sim.log.length ? sim.log.map((l, i) => <div key={i}>{l}</div>) : <div style={{ color: 'var(--muted)' }}>Press Tick or Auto.</div>}</div>
        </div>
      </div>
    </div>
  );
}

/* ======================= Layer 5: Session Lab ======================= */
export function SessionLab() {
  const [st, setSt] = useState({ conn: false, ticket: false, cookie: null, idle: 0, full: 0, resumed: 0, bytes: 0, rtt: 0 });
  const [timeout, setTo] = useState(30);
  const [log, setLog] = useState([]);
  const add = (m, cls) => setLog((l) => [{ m, cls }, ...l].slice(0, 40));

  const act = {
    connect: () => {
      if (st.conn) return add('Already connected.');
      if (st.ticket) { setSt({ ...st, conn: true, resumed: st.resumed + 1, bytes: st.bytes + 600, rtt: st.rtt + 2, idle: 0 }); add('TCP + resumed TLS (ticket accepted): no certificate, ≈ 600 B, 2 RTT total.', 'good'); }
      else { setSt({ ...st, conn: true, ticket: true, full: st.full + 1, bytes: st.bytes + 5200, rtt: st.rtt + 2 }); add('TCP + full TLS handshake: certificate verified, ≈ 5.2 KB. Server issued a session ticket.'); }
    },
    login: () => {
      if (!st.conn) return add('No connection: connect first.', 'bad');
      setSt({ ...st, cookie: 'sid=' + Math.random().toString(16).slice(2, 10), idle: 0, bytes: st.bytes + 900, rtt: st.rtt + 1 });
      add('POST /login → 303 + Set-Cookie. The server now remembers you.', 'good');
    },
    request: () => {
      if (!st.conn) return add('GET /inbox failed: no transport connection.', 'bad');
      const expired = st.cookie && st.idle >= timeout;
      if (!st.cookie || expired) { setSt({ ...st, cookie: expired ? null : st.cookie, bytes: st.bytes + 400, rtt: st.rtt + 1 }); return add(`GET /inbox → 401 Unauthorized${expired ? ' (session expired after ' + st.idle + ' min idle)' : ' (no session cookie)'}.`, 'bad'); }
      setSt({ ...st, idle: 0, bytes: st.bytes + 3000, rtt: st.rtt + 1 });
      add(`GET /inbox with Cookie: ${st.cookie} → 200 OK. Idle timer reset.`, 'good');
    },
    drop: () => { if (!st.conn) return add('Not connected.'); setSt({ ...st, conn: false }); add('Network changed: TCP connection lost. Cookie and ticket survive.', 'bad'); },
    wait: () => { setSt({ ...st, idle: st.idle + 15 }); add(`15 minutes pass… (idle ${st.idle + 15} min)`); },
    logout: () => { if (!st.cookie) return add('Not logged in.'); setSt({ ...st, cookie: null }); add('Logout: server deletes the session; cookie is now useless.'); },
    forget: () => { setSt({ ...st, ticket: false }); add('Client cleared its TLS ticket cache: the next connect is a full handshake.'); },
  };

  return (
    <div>
      <h3>Session Lab, layer 5</h3>
      <p className="lab-sub">A session outlives individual connections. Connect, log in, drop the connection, and reconnect: see how TLS tickets avoid repeating the expensive handshake and how the session cookie keeps you logged in until it expires or you log out.</p>
      <div className="row">
        <button className="btn primary" onClick={act.connect}>Connect</button>
        <button className="btn" onClick={act.login}>Log in</button>
        <button className="btn" onClick={act.request}>GET /inbox</button>
        <button className="btn" onClick={act.drop}>✂ Drop connection</button>
        <button className="btn" onClick={act.wait}>⏱ Wait 15 min</button>
        <button className="btn" onClick={act.logout}>Log out</button>
        <button className="btn" onClick={act.forget}>Clear ticket</button>
        <label className="field">Idle timeout
          <select value={timeout} onChange={(e) => setTo(+e.target.value)}>{[15, 30, 60].map((t) => <option key={t} value={t}>{t} min</option>)}</select>
        </label>
      </div>
      <div className="grid2" style={{ marginTop: 10 }}>
        <div className="panel-box">
          <h5>State</h5>
          <div className="kv">
            <span>Transport (L4)</span><span className={st.conn ? 'good' : 'bad'}>{st.conn ? '● connected' : '○ no connection'}</span>
            <span>TLS ticket (L5)</span><span className={st.ticket ? 'good' : ''}>{st.ticket ? '● stored: resumption possible' : '○ none'}</span>
            <span>App session (L5)</span><span className={st.cookie && st.idle < timeout ? 'good' : 'bad'}>{st.cookie ? (st.idle >= timeout ? `● ${st.cookie} (expired)` : `● ${st.cookie}`) : '○ logged out'}</span>
            <span>Idle</span><span>{st.idle} / {timeout} min</span>
            <span>Full handshakes</span><span>{st.full}</span>
            <span>Resumed</span><span>{st.resumed}</span>
            <span>Bytes spent</span><span>{(st.bytes / 1000).toFixed(1)} KB · {st.rtt} round trips</span>
          </div>
        </div>
        <div className="panel-box">
          <h5>Session log</h5>
          <div className="log">{log.length ? log.map((l, i) => <div key={i} className={l.cls}>{l.m}</div>) : <div style={{ color: 'var(--muted)' }}>Try: Connect → Log in → GET → Drop → Connect → GET</div>}</div>
        </div>
      </div>
    </div>
  );
}

/* ======================= Layer 6: Presentation Lab ======================= */
function utf16(s) { const out = []; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); out.push(c >> 8, c & 255); } return new Uint8Array(out); }
function ascii(s) { return new Uint8Array([...s].map((c) => (c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63))); }
async function gzip(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(cs).arrayBuffer());
}
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));

export function PresentationLab() {
  const [text, setText] = useState('Café ☕ costs €3.50 — 日本語もOK');
  const [cs, setCs] = useState('utf8');
  const [res, setRes] = useState(null);
  const [tamper, setTamper] = useState(false);
  const keyRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const enc = cs === 'utf8' ? new TextEncoder().encode(text) : cs === 'utf16' ? utf16(text) : ascii(text);
      const z = await gzip(enc);
      const payload = z || enc;
      let ct = null, iv = null, dec = null, err = null;
      try {
        if (!keyRef.current) keyRef.current = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt']);
        iv = crypto.getRandomValues(new Uint8Array(12));
        ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyRef.current, payload));
        const wire = ct.slice();
        if (tamper) wire[3] ^= 0x01;
        try {
          const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyRef.current, wire));
          let unz = pt;
          if (z) unz = new Uint8Array(await new Response(new Blob([pt]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
          dec = cs === 'utf8' ? new TextDecoder().decode(unz) : cs === 'utf16' ? new TextDecoder('utf-16be').decode(unz) : new TextDecoder('ascii').decode(unz);
        } catch { err = 'Authentication tag check FAILED: the record was modified in transit, so it is rejected.'; }
      } catch { err = 'Web Crypto is unavailable (needs https or localhost).'; }
      const moji = new TextDecoder('windows-1252').decode(new TextEncoder().encode(text));
      if (alive) setRes({ enc, z, ct, iv, dec, err, moji });
    })();
    return () => { alive = false; };
  }, [text, cs, tamper]);

  return (
    <div>
      <h3>Presentation Lab, layer 6</h3>
      <p className="lab-sub">Follow your text through the presentation pipeline exactly as HTTPS does it: characters → bytes (encoding) → fewer bytes (gzip) → unreadable bytes (AES-GCM, real Web Crypto) → and all the way back. Tamper with one bit to see integrity protection reject it.</p>
      <div className="row">
        <label className="field" style={{ flex: 1, minWidth: 260 }}>Your text<input type="text" value={text} onChange={(e) => setText(e.target.value)} /></label>
        <label className="field">Character encoding
          <select value={cs} onChange={(e) => setCs(e.target.value)}><option value="utf8">UTF-8</option><option value="utf16">UTF-16BE</option><option value="ascii">ASCII (7-bit)</option></select>
        </label>
        <button className="btn" onClick={() => setText((t) => (t + ' ').repeat(15).trim())}>Repeat ×15</button>
        <label className="row" style={{ gap: 6, fontSize: 11 }}><input type="checkbox" checked={tamper} onChange={(e) => setTamper(e.target.checked)} /> Flip 1 bit in transit</label>
      </div>
      {res && (
        <div className="pipeline" style={{ marginTop: 10 }}>
          <div className="pipe-stage" style={{ '--sc': 'var(--l7)' }}><div className="ph"><b>0 · Application text</b><span>{[...text].length} characters</span></div><div className="mono-out">{text}</div></div>
          <div className="pipe-stage"><div className="ph"><b>1 · Encode ({cs.toUpperCase()})</b><span>{res.enc.length} bytes</span></div><div className="mono-out">{hexs(res.enc)}</div>
            {cs === 'ascii' && <div className="bad" style={{ fontSize: 11, marginTop: 4 }}>ASCII can't represent non-English characters: they became "?" (0x3f). Information lost!</div>}
            {cs === 'utf8' && <div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>If the receiver wrongly assumes Windows-1252: <span className="bad">{res.moji}</span></div>}
          </div>
          <div className="pipe-stage"><div className="ph"><b>2 · Compress (gzip)</b><span>{res.z ? `${res.z.length} bytes (${res.z.length < res.enc.length ? '−' : '+'}${Math.abs(Math.round((1 - res.z.length / res.enc.length) * 100))}%)` : 'not supported'}</span></div>
            {res.z && <div className="mono-out">{hexs(res.z, 48)}</div>}
            {res.z && res.z.length >= res.enc.length && <div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>Short text grows: gzip adds an 18-byte header. Try "Repeat ×15".</div>}
          </div>
          <div className="pipe-stage" style={{ '--sc': 'var(--l5)' }}><div className="ph"><b>3 · Encrypt (AES-128-GCM)</b><span>{res.ct ? `${res.ct.length} bytes (+16 tag)` : '-'}</span></div>
            {res.ct && <><div className="mono-out">{hexs(res.ct, 48)}</div><div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>IV {hexs(res.iv)} · new random IV each time, so the same text never encrypts the same way twice.</div></>}
          </div>
          {res.ct && <div className="pipe-stage" style={{ '--sc': 'var(--l3)' }}><div className="ph"><b>Bonus · Base64 (text-safe)</b><span>{b64(res.ct).length} chars</span></div><div className="mono-out">{b64(res.ct).slice(0, 120)}{b64(res.ct).length > 120 ? '…' : ''}</div></div>}
          <div className="pipe-stage" style={{ '--sc': res.err ? '#ef4444' : 'var(--l4)' }}><div className="ph"><b>4 · Receiver: decrypt → decompress → decode</b><span>{res.err ? 'rejected' : 'round trip OK'}</span></div>
            <div className={`mono-out ${res.err ? 'bad' : 'good'}`}>{res.err || res.dec}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================= Layer 7: HTTP Lab ======================= */
const USERS = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Linus' }];
const STATUS = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 405: 'Method Not Allowed' };
const EXPLAIN = {
  200: 'Success: here is what you asked for.', 201: 'A new resource was created; Location says where.', 204: 'Done, nothing to send back.',
  301: 'It moved permanently; the browser follows Location automatically.', 400: 'The request itself was malformed.',
  401: 'You need to authenticate (send credentials).', 404: 'No resource at that path.', 405: 'That path exists but doesn\'t allow this method.',
};

function serve(method, path, headers, body) {
  const auth = /authorization:\s*bearer\s+letmein/i.test(headers);
  const json = (o) => JSON.stringify(o, null, 2);
  if (path === '/' && method === 'GET') return [200, { 'Content-Type': 'text/html; charset=utf-8' }, '<h1>Welcome!</h1>'];
  if (path === '/' && method === 'HEAD') return [200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': '17' }, ''];
  if (path === '/') return [405, { Allow: 'GET, HEAD' }, ''];
  if (path === '/old-page') return [301, { Location: '/' }, ''];
  if (path === '/api/users' && method === 'GET') return [200, { 'Content-Type': 'application/json' }, json(USERS)];
  if (path === '/api/users' && method === 'POST') {
    try { const o = JSON.parse(body || '{}'); if (!o.name) throw 0; return [201, { 'Content-Type': 'application/json', Location: '/api/users/3' }, json({ id: 3, name: o.name })]; }
    catch { return [400, { 'Content-Type': 'application/json' }, json({ error: 'Body must be JSON like {"name":"Grace"}' })]; }
  }
  const m = path.match(/^\/api\/users\/(\d+)$/);
  if (m) {
    const u = USERS.find((x) => x.id === +m[1]);
    if (!u) return [404, { 'Content-Type': 'application/json' }, json({ error: 'No such user' })];
    if (method === 'GET') return [200, { 'Content-Type': 'application/json' }, json(u)];
    if (method === 'DELETE') return auth ? [204, {}, ''] : [401, { 'WWW-Authenticate': 'Bearer' }, ''];
    return [405, { Allow: 'GET, DELETE' }, ''];
  }
  if (path === '/admin') return auth ? [200, { 'Content-Type': 'text/plain' }, 'Secret admin dashboard'] : [401, { 'WWW-Authenticate': 'Bearer realm="admin"' }, ''];
  return [404, { 'Content-Type': 'text/html' }, '<h1>404 Not Found</h1>'];
}

const PRESETS = [
  ['GET', '/', ''], ['GET', '/api/users', ''], ['POST', '/api/users', '{"name":"Grace"}'], ['GET', '/old-page', ''],
  ['GET', '/admin', ''], ['DELETE', '/api/users/2', ''], ['PUT', '/', ''], ['GET', '/nope', ''],
];

export function HttpLab() {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/users');
  const [headers, setHeaders] = useState('Accept: */*\nUser-Agent: osi-explorer/1.0');
  const [body, setBody] = useState('');
  const [out, setOut] = useState(null);

  const send = () => {
    const hasBody = ['POST', 'PUT'].includes(method) && body;
    const reqHead = [`${method} ${path} HTTP/1.1`, 'Host: api.example', ...headers.split('\n').filter(Boolean), ...(hasBody ? ['Content-Type: application/json', `Content-Length: ${new TextEncoder().encode(body).length}`] : [])];
    const [code, h, b] = serve(method, path, headers, body);
    const resHead = [`HTTP/1.1 ${code} ${STATUS[code]}`, 'Date: ' + new Date().toUTCString(), ...Object.entries(h).map(([k, v]) => `${k}: ${v}`), ...(b && !h['Content-Length'] ? [`Content-Length: ${new TextEncoder().encode(b).length}`] : [])];
    setOut({ req: reqHead.join('\r\n') + '\r\n\r\n' + (hasBody ? body : ''), res: resHead.join('\r\n') + '\r\n\r\n' + (method === 'HEAD' ? '' : b), code });
  };

  return (
    <div>
      <h3>HTTP Lab, layer 7</h3>
      <p className="lab-sub">Build a raw HTTP request and send it to a pretend API. Try the presets, then experiment: different methods, a JSON body, or add <code>Authorization: Bearer letmein</code> to get into /admin.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        {PRESETS.map(([m, p, b]) => <button key={m + p} className="btn sm" onClick={() => { setMethod(m); setPath(p); setBody(b); }}>{m} {p}</button>)}
      </div>
      <div className="row">
        <label className="field">Method<select value={method} onChange={(e) => setMethod(e.target.value)}>{['GET', 'HEAD', 'POST', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>Path<input type="text" value={path} onChange={(e) => setPath(e.target.value)} /></label>
        <button className="btn primary" onClick={send}>Send ›</button>
      </div>
      <div className="grid2" style={{ marginTop: 8 }}>
        <label className="field">Headers<textarea value={headers} onChange={(e) => setHeaders(e.target.value)} /></label>
        <label className="field">Body (POST / PUT)<textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder='{"name":"Grace"}' /></label>
      </div>
      {out && (
        <div className="grid2">
          <div className="panel-box"><h5>Request on the wire</h5><pre className="mono-out" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{out.req}</pre></div>
          <div className="panel-box" style={{ borderColor: out.code < 300 ? 'var(--l4)' : out.code < 400 ? 'var(--l5)' : '#ef4444' }}>
            <h5>Response · <span className={out.code < 400 ? 'good' : 'bad'}>{out.code} {STATUS[out.code]}</span></h5>
            <pre className="mono-out" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{out.res}</pre>
            <p style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 0 }}>{EXPLAIN[out.code]}</p>
          </div>
        </div>
      )}
    </div>
  );
}

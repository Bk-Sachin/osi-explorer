import { useEffect, useMemo, useState } from 'react';
import { LAYERS } from '../data/layers.js';
import { KIND } from '../lib/util.js';
import { hex, fmtSize } from '../lib/packet.js';

export default function Inspector({ scn, no, maxNo, onNav, onClose, srcOf, dstOf }) {
  const pk = scn.packets.find((p) => p.no === no);
  const [mode, setMode] = useState('wire');
  const [hl, setHl] = useState(null); // {start,end}
  useEffect(() => { setMode('wire'); setHl(null); }, [no]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && no < maxNo) onNav(no + 1);
      if (e.key === 'ArrowLeft' && no > 1) onNav(no - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [no, maxNo, onNav, onClose]);

  const fr = mode === 'decrypted' && pk.decrypted ? pk.decrypted : pk.frame;
  const fields = useMemo(() => fr.layers.flatMap((l) => l.fields.map((f) => ({ ...f, osi: l.osi }))), [fr]);
  const byteField = useMemo(() => {
    const m = new Array(fr.size);
    fields.forEach((f, i) => { for (let b = f.start; b < f.end; b++) m[b] = i; });
    return m;
  }, [fr, fields]);

  const rows = [];
  for (let off = 0; off < fr.bytes.length; off += 16) rows.push(off);
  const shownRows = rows.slice(0, 120);
  const isHl = (b) => hl && b >= hl.start && b < hl.end;
  const color = KIND[pk.kind];

  return (
    <div className="modal" role="dialog" aria-label="Packet inspector">
      <div className="modal-head">
        <span className="no" style={{ display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', background: color, color: '#0a0e17', fontWeight: 700 }}>{pk.no}</span>
        <div className="grow">
          <h3>{pk.label}</h3>
          <small>{srcOf(pk)} → {dstOf(pk)}, {pk.proto}, {fmtSize(pk.frame.size)}, at {pk.t.toFixed(3)}s</small>
        </div>
        {pk.decrypted && (
          <div className="toggle" title="TLS hides this content; with the session keys you could see it">
            <button className={mode === 'wire' ? 'on' : ''} onClick={() => setMode('wire')}>On the wire</button>
            <button className={mode === 'decrypted' ? 'on' : ''} onClick={() => setMode('decrypted')}>🔓 Decrypted view</button>
          </div>
        )}
        <button className="btn icon" disabled={no <= 1} onClick={() => onNav(no - 1)} aria-label="Previous packet">‹</button>
        <button className="btn icon" disabled={no >= maxNo} onClick={() => onNav(no + 1)} aria-label="Next packet">›</button>
        <button className="btn icon" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="layerbar">
        <div className="seen">{mode === 'decrypted' ? 'What the endpoints see after TLS decryption (an eavesdropper never sees this)' : pk.note}</div>
        <div className="bars">
          {fr.layers.map((l, i) => (
            <div key={i} style={{ flex: Math.max(l.size, fr.size * 0.06) }}>
              <i style={{ background: LAYERS[l.osi].color }} />
              <span>{l.name}</span>
              <small>Layer {l.osi}, {l.size} B</small>
            </div>
          ))}
        </div>
      </div>

      <div className="insp">
        <div className="insp-fields">
          {fr.layers.map((l, li) => (
            <div key={li} className="insp-layer" style={{ '--lc': LAYERS[l.osi].color }}>
              <h4>{l.name}, {l.size} bytes <small>{l.summary}</small><span className="osi">Layer {l.osi}, {LAYERS[l.osi].name}</span></h4>
              {l.fields.map((f, fi) => (
                <div key={fi} className={`fld ${hl && hl.start === f.start && hl.end === f.end ? 'hl' : ''}`}
                  onMouseEnter={() => setHl({ start: f.start, end: f.end })} onMouseLeave={() => setHl(null)}>
                  <div className="fname">{f.name}</div>
                  <div>
                    <div className="fval">{f.value}{f.eg && <span className="eg">E.G.</span>}{f.opaque && <span className="op">··</span>}</div>
                    <div className="fdesc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="insp-hex">
          <div className="hh">{fr.size} bytes in this {mode === 'decrypted' ? 'decrypted payload' : 'frame'}</div>
          {shownRows.map((off) => {
            const slice = fr.bytes.slice(off, off + 16);
            return (
              <div className="hexrow" key={off}>
                <span className="off">{hex(off, 4)}</span>
                <span className="bytes">
                  {slice.map((b, i) => {
                    const idx = off + i;
                    const f = fields[byteField[idx]];
                    return (
                      <span key={i} className={`${isHl(idx) ? 'hl' : ''} ${f?.opaque ? 'oq' : ''}`} style={{ color: f ? LAYERS[f.osi].color : undefined }}
                        onMouseEnter={() => f && setHl({ start: f.start, end: f.end })} onMouseLeave={() => setHl(null)}>{hex(b)}</span>
                    );
                  })}
                </span>
                <span className="asc">
                  {slice.map((b, i) => (
                    <span key={i} className={isHl(off + i) ? 'hl' : ''} style={{ color: 'var(--muted)' }}>{b >= 32 && b < 127 ? String.fromCharCode(b) : '.'}</span>
                  ))}
                </span>
              </div>
            );
          })}
          {rows.length > shownRows.length && <div style={{ color: 'var(--muted)', marginTop: 6 }}>… {fr.size - shownRows.length * 16} more bytes</div>}
        </div>
      </div>

      <div className="modal-foot">
        <span><span className="eg" style={{ marginLeft: 0 }}>E.G.</span> example value: differs in every real capture</span>
        <span>·· bytes the lesson can't show: encrypted, random or file contents</span>
        <span>Hover a field or a byte to link them. Arrow keys move between packets; Esc closes.</span>
      </div>
    </div>
  );
}

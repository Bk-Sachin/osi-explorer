import { useState } from 'react';
import { LAYERS } from '../data/layers.js';

// What each layer wraps around a single "GET /" request
const WRAP = {
  1: { label: 'Signal', adds: 'Turns the whole frame into pulses on the cable, starting with a preamble so the receiver can sync its clock.', sample: '10101010 10101011 …' },
  2: { label: 'Ethernet frame', adds: 'Addresses the next device on this link by MAC address, and adds a checksum at the end to catch corruption.', sample: 'to 00:1e:58:a1:00:01' },
  3: { label: 'IP packet', adds: 'Puts the global address on the envelope, so routers can pass it from network to network.', sample: '192.168.1.10 → 203.0.113.10' },
  4: { label: 'TCP segment', adds: 'Numbers the bytes and names the program on each end (ports), so nothing is lost or delivered out of order.', sample: 'port 52344 → 80, seq 1' },
  5: { label: 'Session', adds: 'Keeps the conversation going: the connection is reused, and a cookie says who you are.', sample: 'keep-alive, Cookie: sid=…' },
  6: { label: 'Encoding', adds: 'Agrees how to read the bytes: UTF-8 text, maybe gzip, and encryption when it\'s HTTPS.', sample: 'charset=utf-8' },
  7: { label: 'HTTP request', adds: 'The message itself, in a language the web server understands.', sample: 'GET / HTTP/1.1' },
};

export default function Envelope() {
  const [sel, setSel] = useState(4);
  const L = LAYERS[sel];

  const layer = (n) => {
    if (n > 7) return <div className="env-letter" aria-hidden="true">GET / HTTP/1.1<br />Host: www.example.com</div>;
    return (
      <div className={`env-layer ${sel === n ? 'sel' : ''}`} style={{ '--lc': LAYERS[n].color, '--i': 8 - n }}>
        <button className="env-tab" onClick={() => setSel(n)} aria-pressed={sel === n}>
          <span className="env-n">{n}</span>{WRAP[n].label}
        </button>
        {layer(n + 1)}
      </div>
    );
  };

  return (
    <figure className="env" aria-label="A web request wrapped by all seven layers">
      {layer(1)}
      <figcaption className="env-cap" style={{ '--lc': L.color }} aria-live="polite">
        <strong>Layer {sel}: {L.name}</strong>
        <span>{WRAP[sel].adds}</span>
        <code>{WRAP[sel].sample}</code>
      </figcaption>
    </figure>
  );
}

// Packet builder: produces real header bytes plus per-field explanations,
// so the inspector can show a genuine hex dump linked to each field.

export const hex = (n, w = 2) => n.toString(16).padStart(w, '0');
const u8 = (n) => [n & 255];
const u16 = (n) => [(n >> 8) & 255, n & 255];
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const macB = (s) => s.split(':').map((h) => parseInt(h, 16));
const ipB = (s) => s.split('.').map(Number);
export const asciiB = (s) => [...new TextEncoder().encode(s)];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}
export function opaqueBytes(n, seed = 7) {
  const r = rng(seed);
  return Array.from({ length: n }, () => Math.floor(r() * 256));
}

// Internet checksum (RFC 1071)
function inetChecksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    sum += (bytes[i] << 8) + (bytes[i + 1] ?? 0);
    while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
  }
  return ~sum & 0xffff;
}

// CRC-32 (IEEE 802.3)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const field = (name, bytes, value, desc, opts = {}) => ({ name, bytes, value, desc, ...opts });

/* ------------------------------------------------------------------ */
/* Layer builders. Each returns a spec { build(inner, ctx) => layer }   */
/* ------------------------------------------------------------------ */

export function physical() {
  return {
    prefix: true,
    build: () => ({
      name: 'Physical (PHY)',
      osi: 1,
      summary: 'preamble + start delimiter',
      fields: [
        field('Preamble', Array(7).fill(0x55), '10101010 ×7', 'Alternating bits let the receiver lock its clock onto the signal before real data arrives.'),
        field('Start frame delimiter', [0xd5], '10101011', 'The final "11" says: the frame starts right after this byte.'),
      ],
    }),
  };
}

export function ethernet({ dst, src, type = 0x0800, dstNote, srcNote, fcs = false, pad = true, vlan }) {
  const typeName = { 0x0800: 'IPv4', 0x0806: 'ARP', 0x86dd: 'IPv6' }[type] || 'unknown';
  return {
    build: (inner) => {
      const tci = vlan ? ((vlan.pcp || 0) << 13) | (vlan.id & 0xfff) : 0;
      const tag = vlan ? [0x81, 0x00, ...u16(tci)] : [];
      const header = [...macB(dst), ...macB(src), ...tag, ...u16(type)];
      const fields = [
        field('Destination', macB(dst), dst, dstNote || 'MAC address of the next device on this link.'),
        field('Source', macB(src), src, srcNote || 'MAC address of the sender\'s network card.'),
      ];
      if (vlan) {
        fields.push(field('802.1Q TPID', [0x81, 0x00], '0x8100 (VLAN tag)', 'Tag Protocol ID: "a VLAN tag follows" (sits where the Type field normally is).'));
        fields.push(field('802.1Q TCI', u16(tci), `PCP ${vlan.pcp || 0}, DEI 0, VLAN ${vlan.id}`, 'Priority (3 bits, for QoS), drop-eligible (1 bit) and the 12-bit VLAN ID (1–4094).'));
      }
      fields.push(field('Type', u16(type), `0x${hex(type, 4)} (${typeName})`, 'Tells the receiver which protocol is inside the frame.'));
      const padLen = pad ? Math.max(0, 60 - (14 + inner.length)) : 0;
      const trailer = [];
      if (padLen) trailer.push(field('Padding', Array(padLen).fill(0), `${padLen} bytes`, 'Ethernet frames must be at least 64 bytes (incl. FCS), so short ones are padded with zeros.'));
      if (fcs) {
        const padBytes = Array(padLen).fill(0);
        const crc = crc32([...header, ...inner, ...padBytes]);
        // FCS is transmitted least-significant byte first
        const crcBytes = [crc & 255, (crc >>> 8) & 255, (crc >>> 16) & 255, (crc >>> 24) & 255];
        trailer.push(field('Frame check sequence', crcBytes, `0x${hex(crc, 8)}`, 'CRC-32 over the whole frame. The receiver recomputes it; if it differs, the frame is silently dropped.'));
      }
      return { name: 'Ethernet II', osi: 2, summary: `${src} → ${dst}`, fields, trailer };
    },
  };
}

export function wifi({ addr1, addr2, addr3, toDS = true, etype }) {
  return {
    build: () => ({
      name: '802.11 (Wi-Fi)',
      osi: 2,
      summary: `${addr2} → ${addr1}`,
      fields: [
        field('Frame control', [0x08, toDS ? 0x01 : 0x02], `Data, ${toDS ? 'To DS' : 'From DS'}`, 'Frame type and direction: a data frame going to (or from) the access point.'),
        field('Duration', u16(44), '44 µs', 'How long the medium will be busy, so other stations wait.'),
        field('Address 1 (receiver)', macB(addr1), addr1, 'The radio that should pick this frame out of the air.'),
        field('Address 2 (transmitter)', macB(addr2), addr2, 'The radio that sent it.'),
        field('Address 3', macB(addr3), addr3, 'Final destination beyond the access point (e.g. the router).'),
        field('Sequence control', u16(0x1a20), '0x1a20', 'Lets the receiver discard duplicate retransmissions.', { eg: true }),
        etype === 0x888e
          ? field('LLC/SNAP', [0xaa, 0xaa, 0x03, 0, 0, 0, 0x88, 0x8e], '802.1X (EAPOL)', 'Says an EAPOL authentication message follows.')
          : field('LLC/SNAP', [0xaa, 0xaa, 0x03, 0, 0, 0, 0x08, 0x00], 'IPv4', 'Says an IPv4 packet follows, like Ethernet\'s Type field.'),
      ],
    }),
  };
}

export function arp({ op, sha, spa, tha, tpa }) {
  return {
    build: () => ({
      name: 'ARP',
      osi: 2,
      summary: op === 1 ? `Who has ${tpa}? Tell ${spa}` : `${spa} is at ${sha}`,
      fields: [
        field('Hardware type', u16(1), '1 (Ethernet)', 'Kind of link-layer address being resolved.'),
        field('Protocol type', u16(0x0800), '0x0800 (IPv4)', 'Kind of network-layer address being resolved.'),
        field('Hardware size', [6], '6', 'MAC addresses are 6 bytes.'),
        field('Protocol size', [4], '4', 'IPv4 addresses are 4 bytes.'),
        field('Opcode', u16(op), op === 1 ? '1 (request)' : '2 (reply)', op === 1 ? 'A question broadcast to everyone on the LAN.' : 'The answer, sent straight back to whoever asked.'),
        field('Sender MAC', macB(sha), sha, 'MAC of the device sending this ARP message.'),
        field('Sender IP', ipB(spa), spa, 'IP of the device sending this ARP message.'),
        field('Target MAC', macB(tha), tha, op === 1 ? 'Unknown yet, so all zeros: this is what we are asking for.' : 'MAC of the device that asked.'),
        field('Target IP', ipB(tpa), tpa, op === 1 ? 'The IP whose MAC we want.' : 'IP of the device that asked.'),
      ],
    }),
  };
}

const PROTO = { 1: 'ICMP', 6: 'TCP', 17: 'UDP' };
export function ipv4({ src, dst, proto = 6, ttl = 64, id = 0x1c46, df = true, ttlNote, mf = false, fragOffset = 0, srcNote, dstNote }) {
  return {
    ip: { src, dst, proto },
    build: (inner) => {
      const total = 20 + inner.length;
      const flags = (df ? 0x4000 : 0) | (mf ? 0x2000 : 0) | ((fragOffset / 8) & 0x1fff);
      const fragged = mf || fragOffset;
      const hdr = [0x45, 0x00, ...u16(total), ...u16(id), ...u16(flags), ttl, proto, 0, 0, ...ipB(src), ...ipB(dst)];
      const ck = inetChecksum(hdr);
      return {
        name: 'IPv4',
        osi: 3,
        summary: `${src} → ${dst}`,
        fields: [
          field('Version, header length', [0x45], '4, 20 bytes', 'IPv4, with no options.'),
          field('DSCP, ECN', [0x00], '0, 0', 'Priority and congestion marks; 0 means ordinary traffic.'),
          field('Total length', u16(total), `${total} bytes`, 'This header plus everything inside it.'),
          field('Identification', u16(id), `0x${hex(id, 4)}`, 'Lets the receiver reassemble fragments of the same packet.', { eg: true }),
          fragged
            ? field('Flags, fragment offset', u16(flags), `${mf ? 'More fragments' : 'Last fragment'}, offset ${fragOffset}`, `${mf ? 'MF=1: more pieces follow.' : 'MF=0: this is the final piece.'} Offset ${fragOffset} (stored as ${fragOffset / 8} × 8 bytes) says where this piece belongs in the original payload.`)
            : field('Flags', u16(flags), df ? "Don't fragment" : 'none', df ? 'Routers must not split this packet; they report an error instead.' : 'Routers may split it if a link is too small.'),
          field('Time to live', [ttl], `${ttl}`, ttlNote || 'Each router subtracts 1. At 0 the packet is dropped, so loops cannot last forever.'),
          field('Protocol', [proto], `${proto} (${PROTO[proto] || '?'})`, 'Which transport protocol is inside.'),
          field('Header checksum', u16(ck), `0x${hex(ck, 4)}`, 'Covers this header only; every router recomputes it after lowering the TTL.'),
          field('Source', ipB(src), src, srcNote || 'The original sender. Unlike MACs, this stays the same end to end (unless NAT rewrites it).'),
          field('Destination', ipB(dst), dst, dstNote || 'The final destination, across any number of networks.'),
        ],
      };
    },
  };
}

function pseudoHeader(ctx, proto, len) {
  if (!ctx.ip) return [];
  return [...ipB(ctx.ip.src), ...ipB(ctx.ip.dst), 0, proto, ...u16(len)];
}

const FLAG_BITS = { FIN: 1, SYN: 2, RST: 4, PSH: 8, ACK: 16, URG: 32 };
export function tcp({ sport, dport, seq = 0, ack = 0, flags = [], win = 64240, seqNote, ackNote, opts = false }) {
  return {
    build: (inner, ctx) => {
      const optBytes = opts ? [0x02, 0x04, 0x05, 0xb4, 0x01, 0x03, 0x03, 0x07, 0x04, 0x02, 0x01, 0x01] : [];
      const hlen = 20 + optBytes.length;
      const fl = flags.reduce((a, f) => a | FLAG_BITS[f], 0);
      const base = [...u16(sport), ...u16(dport), ...u32(seq), ...u32(ack), (hlen / 4) << 4, fl, ...u16(win), 0, 0, 0, 0, ...optBytes];
      const ck = inetChecksum([...pseudoHeader(ctx, 6, hlen + inner.length), ...base, ...inner]);
      const fields = [
        field('Source port', u16(sport), `${sport}`, sport > 49151 ? 'A temporary port the OS picked for this connection.' : 'Well-known port of the service.'),
        field('Destination port', u16(dport), `${dport}`, dport < 1024 ? 'Well-known port that identifies the service (80 = HTTP, 443 = HTTPS).' : 'The client\'s temporary port.'),
        field('Sequence number', u32(seq), `${seq}`, seqNote || 'Position of this segment\'s first byte in the stream (shown relative, like Wireshark).'),
        field('Acknowledgment', u32(ack), `${ack}`, ackNote || 'The next byte this side expects to receive: everything before it arrived.'),
        field('Header length', [(hlen / 4) << 4], `${hlen} bytes`, opts ? '20 bytes plus options (MSS, window scale, SACK).' : 'Basic 20-byte header, no options.'),
        field('Flags', [fl], flags.length ? flags.join(', ') : 'none', 'SYN opens, ACK acknowledges, PSH pushes data to the app, FIN closes, RST aborts.'),
        field('Window', u16(win), `${win}`, 'How many bytes the sender of this segment can still buffer: flow control.'),
        field('Checksum', u16(ck), `0x${hex(ck, 4)}`, 'Covers header, data and a pseudo-header of the IP addresses.'),
        field('Urgent pointer', [0, 0], '0', 'Almost never used.'),
      ];
      if (opts) fields.push(field('Options', optBytes, 'MSS=1460, WS=128, SACK', 'Negotiated only in SYNs: max segment size, window scaling, selective ACKs.'));
      return { name: 'TCP', osi: 4, summary: `${sport} → ${dport} [${flags.join(', ')}]`, fields };
    },
  };
}

export function udp({ sport, dport }) {
  return {
    build: (inner, ctx) => {
      const len = 8 + inner.length;
      const base = [...u16(sport), ...u16(dport), ...u16(len), 0, 0];
      const ck = inetChecksum([...pseudoHeader(ctx, 17, len), ...base, ...inner]) || 0xffff;
      return {
        name: 'UDP',
        osi: 4,
        summary: `${sport} → ${dport}`,
        fields: [
          field('Source port', u16(sport), `${sport}`, 'Where replies should go.'),
          field('Destination port', u16(dport), `${dport}`, 'Which service should receive it (53 = DNS).'),
          field('Length', u16(len), `${len} bytes`, 'Header plus data. That is the whole header: UDP is tiny.'),
          field('Checksum', u16(ck), `0x${hex(ck, 4)}`, 'Detects corruption. No retransmission, no ordering: that is up to the app.'),
        ],
      };
    },
  };
}

const ICMP_TYPES = { 0: 'Echo reply', 8: 'Echo request', 11: 'Time exceeded', 3: 'Destination unreachable' };
export function icmp({ type, code = 0, id = 1, seq = 1, data = 32, embedded, mtu }) {
  return {
    build: () => {
      const rest = type === 0 || type === 8 ? [...u16(id), ...u16(seq)] : mtu ? [0, 0, ...u16(mtu)] : [0, 0, 0, 0];
      const body = embedded || asciiB('abcdefghijklmnopqrstuvwabcdefghi'.slice(0, data));
      const ck = inetChecksum([type, code, 0, 0, ...rest, ...body]);
      const fields = [
        field('Type', [type], `${type} (${ICMP_TYPES[type]})`, type === 11 ? 'A router dropped the packet because its TTL reached 0.' : type === 8 ? 'Are you there?' : type === 3 ? 'A router or host could not deliver the packet.' : 'Yes, I am here.'),
        field('Code', [code], type === 3 && code === 4 ? '4 (Fragmentation needed, DF set)' : type === 3 && code === 3 ? '3 (Port unreachable)' : `${code}`, type === 3 ? 'Why it could not be delivered.' : 'Refines the type; 0 here.'),
        field('Checksum', u16(ck), `0x${hex(ck, 4)}`, 'Covers the whole ICMP message.'),
      ];
      if (type === 0 || type === 8) {
        fields.push(field('Identifier', u16(id), `${id}`, 'Matches replies to the ping process that sent them.', { eg: true }));
        fields.push(field('Sequence', u16(seq), `${seq}`, 'Counts each ping so lost ones can be spotted.'));
        fields.push(field('Data', body, `${body.length} bytes`, 'Filler bytes the target simply echoes back.'));
      } else {
        if (mtu) fields.push(field('Unused, next-hop MTU', rest, `MTU ${mtu}`, 'Path MTU discovery: "the next link only carries packets up to this size, resend smaller".'));
        else fields.push(field('Unused', [0, 0, 0, 0], '0', 'Reserved.'));
        fields.push(field('Original datagram', body, `${body.length} bytes`, 'The start of the packet that died, so the sender knows which one it was.', { opaque: !embedded }));
      }
      return { name: 'ICMP', osi: 3, summary: ICMP_TYPES[type], fields };
    },
  };
}

function dnsName(name) {
  const out = [];
  for (const label of name.split('.')) out.push(label.length, ...asciiB(label));
  out.push(0);
  return out;
}
export function dns({ id = 0x3b2a, qname, response = false, answer, ttl = 3600, rd = true }) {
  return {
    build: () => {
      const flags = response ? 0x8180 : rd ? 0x0100 : 0x0000;
      const fields = [
        field('Transaction ID', u16(id), `0x${hex(id, 4)}`, 'Random number that ties the answer to the question.', { eg: true }),
        field('Flags', u16(flags), response ? 'Standard response, no error' : 'Standard query, recursion desired', response ? 'QR=1 marks a response; RA says the resolver does recursion.' : 'RD=1 asks the resolver to do the whole lookup for us.'),
        field('Questions', u16(1), '1', 'One question follows.'),
        field('Answer RRs', u16(response ? 1 : 0), response ? '1' : '0', 'Number of answer records.'),
        field('Authority RRs', u16(0), '0', 'Name-server records (none).'),
        field('Additional RRs', u16(0), '0', 'Extra records (none).'),
        field('Query name', dnsName(qname), qname, 'Encoded as length-prefixed labels: 3www7example3com0.'),
        field('Query type, class', [...u16(1), ...u16(1)], 'A, IN', 'Asking for an IPv4 address (A record) on the Internet class.'),
      ];
      if (response) {
        fields.push(field('Answer name', [0xc0, 0x0c], 'pointer → ' + qname, 'Compression: points back to the name in the question instead of repeating it.'));
        fields.push(field('Type, class', [...u16(1), ...u16(1)], 'A, IN', 'An IPv4 address record.'));
        fields.push(field('TTL', u32(ttl), `${ttl} s`, 'How long caches may keep this answer.', { eg: true }));
        fields.push(field('Data length', u16(4), '4', 'An IPv4 address is 4 bytes.'));
        fields.push(field('Address', ipB(answer), answer, 'The answer: the server\'s IP address.'));
      }
      return { name: 'DNS', osi: 7, summary: response ? `A ${answer}` : `A? ${qname}`, fields };
    },
  };
}

const DHCP_TYPES = { 1: 'DISCOVER', 2: 'OFFER', 3: 'REQUEST', 5: 'ACK', 6: 'NAK', 7: 'RELEASE' };
// DHCP (BOOTP format). options: [code, valueBytes, label, desc]
export function dhcp({ msgType, xid = 0x3903f326, chaddr, yiaddr = '0.0.0.0', siaddr = '0.0.0.0', ciaddr = '0.0.0.0', broadcast = true, options = [] }) {
  return {
    build: () => {
      const op = [1, 3, 7].includes(msgType) ? 1 : 2;
      const opt = (code, bytes) => [code, bytes.length, ...bytes];
      const fields = [
        field('Op', [op], op === 1 ? '1 (BOOTREQUEST)' : '2 (BOOTREPLY)', 'Client → server messages are requests; server → client are replies.'),
        field('Hardware type, length', [1, 6], 'Ethernet, 6 bytes', 'The client identifies itself by a 6-byte MAC.'),
        field('Hops', [0], '0', 'Incremented by DHCP relay agents that forward the message between subnets.'),
        field('Transaction ID', u32(xid), `0x${hex(xid, 8)}`, 'Random number chosen by the client; every message in this exchange reuses it.', { eg: true }),
        field('Seconds, flags', [0, 0, ...u16(broadcast ? 0x8000 : 0)], broadcast ? 'Broadcast flag set' : 'Unicast OK', 'Broadcast flag: "I have no IP yet, broadcast your reply".'),
        field('Client IP (ciaddr)', ipB(ciaddr), ciaddr, 'Filled only when the client already has an address (renewal).'),
        field('Your IP (yiaddr)', ipB(yiaddr), yiaddr, op === 2 ? 'The address the server is offering/assigning to this client.' : 'Empty in requests.'),
        field('Server IP (siaddr)', ipB(siaddr), siaddr, 'Next server for network boot (often 0).'),
        field('Relay IP (giaddr)', [0, 0, 0, 0], '0.0.0.0', 'Set by a relay agent so the server knows which subnet the client is on.'),
        field('Client MAC (chaddr)', [...macB(chaddr), ...Array(10).fill(0)], chaddr, 'The client\'s hardware address, padded to 16 bytes.'),
        field('Server name + boot file', Array(192).fill(0), '(unused, 192 bytes)', 'Legacy BOOTP fields for diskless booting; normally empty.'),
        field('Magic cookie', [0x63, 0x82, 0x53, 0x63], '99.130.83.99', 'Marks the start of DHCP options (distinguishes DHCP from plain BOOTP).'),
        field('Option 53: message type', opt(53, [msgType]), DHCP_TYPES[msgType], 'Which of the four DORA messages this is.'),
        ...options.map(([code, bytes, label, desc]) => field(`Option ${code}: ${label.split(':')[0]}`, opt(code, bytes), label.split(':').slice(1).join(':').trim() || label, desc)),
        field('End', [255], '255', 'End of options.'),
      ];
      return { name: 'DHCP', osi: 7, summary: `DHCP ${DHCP_TYPES[msgType]}`, fields };
    },
  };
}
export const ipBytes = ipB;

// Plain-text protocol (HTTP, SMTP...). lines: [text, desc, fieldName?]
export function textProto({ name, osi = 7, summary, lines, body, bodyDesc, opaqueBody }) {
  return {
    build: () => {
      const fields = lines.map(([text, desc, fname]) =>
        field(fname || text.split(/[: ]/)[0] || 'Blank line', asciiB(text + '\r\n'), text || '(empty line)', desc),
      );
      if (body) fields.push(field('Body', asciiB(body), `${body.length} bytes`, bodyDesc || 'The content itself.'));
      if (opaqueBody) fields.push(field('Body', opaqueBytes(opaqueBody, 11), `${opaqueBody} bytes`, bodyDesc || 'The content itself.', { opaque: true }));
      return { name, osi, summary, fields };
    },
  };
}

const TLS_CT = { handshake: 22, ccs: 20, appdata: 23, alert: 21 };
// TLS record. msgFields: extra fields after the record header
export function tls({ type = 'handshake', osi = 5, name, summary, msgFields = [], opaqueLen = 0, seed = 5, opaqueName = 'Encrypted data', opaqueDesc }) {
  return {
    build: () => {
      const inner = msgFields.map(([n, bytes, v, d, o]) => field(n, bytes, v, d, o || {}));
      if (opaqueLen) inner.push(field(opaqueName, opaqueBytes(opaqueLen, seed), `${opaqueLen} bytes`, opaqueDesc || 'Ciphertext: without the session keys it looks like random noise.', { opaque: true }));
      const len = inner.reduce((a, f) => a + f.bytes.length, 0);
      return {
        name: name || 'TLS record',
        osi,
        summary,
        fields: [
          field('Content type', [TLS_CT[type]], `${TLS_CT[type]} (${type === 'appdata' ? 'Application data' : type === 'ccs' ? 'Change cipher spec' : type === 'alert' ? 'Alert' : 'Handshake'})`, 'What kind of TLS record this is.'),
          field('Version', [0x03, 0x03], '0x0303 (TLS 1.2 label)', 'TLS 1.3 still writes 1.2 here for compatibility with old middleboxes.'),
          field('Length', u16(len), `${len} bytes`, 'Size of what follows in this record.'),
          ...inner,
        ],
      };
    },
  };
}

// Generic layer from raw field list: [name, bytes, value, desc, opts]
export function custom({ name, osi, summary, fields }) {
  return { build: () => ({ name, osi, summary, fields: fields.map(([n, b, v, d, o]) => field(n, b, v, d, o || {})) }) };
}

/* Build a frame from outermost to innermost layer specs. */
export function frame(...specs) {
  const ctx = {};
  for (const s of specs) if (s.ip) ctx.ip = s.ip;
  const built = new Array(specs.length);
  let inner = [];
  for (let i = specs.length - 1; i >= 0; i--) {
    if (specs[i].prefix) continue;
    const layer = specs[i].build(inner, ctx);
    const head = layer.fields.flatMap((f) => f.bytes);
    const tail = (layer.trailer || []).flatMap((f) => f.bytes);
    built[i] = layer;
    inner = [...head, ...inner, ...tail];
  }
  for (let i = 0; i < specs.length; i++) if (specs[i].prefix) built[i] = specs[i].build();

  // assign offsets: headers in order, then trailers from innermost outward
  let off = 0;
  const bytes = [];
  const layers = built.map((l) => ({ ...l, fields: l.fields.map((f) => ({ ...f })), trailer: (l.trailer || []).map((f) => ({ ...f })) }));
  layers.forEach((l, li) => {
    l.start = off;
    for (const f of l.fields) {
      f.start = off; off += f.bytes.length; f.end = off; f.layer = li;
      bytes.push(...f.bytes);
    }
  });
  for (let li = layers.length - 1; li >= 0; li--) {
    for (const f of layers[li].trailer) {
      f.start = off; off += f.bytes.length; f.end = off; f.layer = li;
      bytes.push(...f.bytes);
    }
  }
  layers.forEach((l, li) => {
    const all = [...l.fields, ...l.trailer];
    l.size = all.reduce((a, f) => a + f.bytes.length, 0);
    l.fields = all;
    l.end = Math.max(...all.map((f) => f.end));
  });
  return { layers, bytes, size: bytes.length };
}

export const fmtSize = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

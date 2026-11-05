import { frame, ethernet, ipv4, tcp, tls, textProto, opaqueBytes, asciiB } from '../../lib/packet.js';

const CL = { ip: '192.168.1.10', mac: '3c:22:fb:10:4a:10' };
const GW = { mac: '00:1e:58:a1:00:01' };
const SRV = '203.0.113.20';
const out = () => ethernet({ src: CL.mac, dst: GW.mac });
const inn = () => ethernet({ src: GW.mac, dst: CL.mac });
const up = (o) => ipv4({ src: CL.ip, dst: SRV, ttl: 128, ...o });
const down = (o) => ipv4({ src: SRV, dst: CL.ip, ttl: 52, ...o });

const nodesBase = {
  client: { label: 'Browser', sub: CL.ip, type: 'laptop', x: 140, y: 360 },
  router: { label: 'Router', sub: '192.168.1.1', type: 'router', x: 380, y: 270 },
  inet: { label: 'Internet', type: 'cloud', x: 610, y: 330 },
  server: { label: 'Web Server', sub: SRV, type: 'server', x: 860, y: 230 },
};
const linksBase = [['client', 'router'], ['router', 'inet'], ['inet', 'server']];

const hs = (b) => [['Handshake type', [b], b === 1 ? '1 (ClientHello)' : b === 2 ? '2 (ServerHello)' : b === 4 ? '4 (NewSessionTicket)' : `${b}`, b === 1 ? 'The client opens the negotiation.' : b === 2 ? 'The server picks from what the client offered.' : 'A ticket the client can present later to skip the full handshake.']];

/* ---------------------------- Layer 6 ---------------------------- */

const page = '<p>Café prices: €3.50 — 日本語メニュー</p>';
const pageBytes = asciiB(page);

export const presentation = {
  id: 'presentation',
  layer: 6,
  name: 'Encode · Compress · Encrypt',
  full: 'Presentation layer at work in HTTPS',
  tag: 'UTF-8, gzip and TLS encryption',
  summary:
    'The presentation layer makes data mean the same thing on both sides. Text must be encoded into bytes (UTF-8), large content is compressed (gzip, Brotli), and everything is encrypted (TLS) so only the two endpoints can read it. In the TCP/IP world these jobs live in libraries the application uses.',
  facts: [
    ['OSI layer', 'Presentation (6)'],
    ['Encoding', 'UTF-8 (1–4 bytes per character)'],
    ['Compression', 'gzip / Brotli via Content-Encoding'],
    ['Encryption', 'TLS 1.3: AES-GCM or ChaCha20'],
    ['Defined in', 'RFC 3629, RFC 1952, RFC 8446'],
  ],
  legend: [
    { kind: 'hs', label: 'Negotiation' },
    { kind: 'enc', label: 'Encrypted data' },
  ],
  nodes: nodesBase,
  links: linksBase,
  seq: ['client', 'server'],
  steps: [
    {
      title: 'Characters to bytes', sub: 'Text has to be encoded',
      text: 'A computer only stores numbers. "é", "€" and "日" don\'t fit in ASCII\'s 128 slots, so the web uses UTF-8: ASCII stays 1 byte, é is 2 bytes, € and 日 are 3. Sender and receiver must agree, or you get mojibake like "CafÃ©".',
      show: ['client', 'router', 'inet', 'server'],
      facts: [['"é"', 'U+00E9 → c3 a9'], ['"€"', 'U+20AC → e2 82 ac'], ['"日"', 'U+65E5 → e6 97 a5'], ['This snippet', `${[...page].length} characters → ${pageBytes.length} bytes`]],
      packets: [],
    },
    {
      title: 'Agree on a format', sub: 'Negotiating ciphers',
      text: 'Before encrypting, both sides must agree how. The ClientHello offers cipher suites and a key share; the ServerHello picks one. From then on, everything (even the certificate) is encrypted.',
      show: [],
      facts: [['Offered', 'AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305'], ['Chosen', 'TLS_AES_128_GCM_SHA256'], ['Key exchange', 'X25519 (ECDHE)']],
      packets: [
        { t: 0, from: 'client', to: 'server', label: 'ClientHello', kind: 'hs', proto: 'TLSv1.3', info: 'Client Hello (SNI=shop.example)', note: 'I speak: AES-GCM, ChaCha20. Here\'s my key share.',
          frame: frame(out(), up({ id: 0x5101 }), tcp({ sport: 52810, dport: 443, flags: ['PSH', 'ACK'], seq: 1, ack: 1 }),
            tls({ osi: 6, name: 'TLS handshake', summary: 'Client Hello', msgFields: [...hs(1),
              ['Cipher suites', [0x13, 0x01, 0x13, 0x02, 0x13, 0x03], '3 suites', 'AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305: the formats the client can decrypt.'],
              ['Key share (X25519)', opaqueBytes(32, 41), '32 bytes', 'Client\'s half of the Diffie-Hellman exchange.', { opaque: true }],
            ], opaqueLen: 180, seed: 3, opaqueName: 'Other extensions', opaqueDesc: 'SNI, supported versions, ALPN (h2, http/1.1), signature algorithms…' })) },
        { t: 0.031, from: 'server', to: 'client', label: 'ServerHello', kind: 'hs', proto: 'TLSv1.3', info: 'Server Hello, Encrypted Extensions, Certificate, Finished', note: 'Let\'s use AES-128-GCM. Here\'s my key share and (encrypted) certificate.',
          frame: frame(inn(), down({ id: 0x9a01 }), tcp({ sport: 443, dport: 52810, flags: ['PSH', 'ACK'], seq: 1, ack: 230 }),
            tls({ osi: 6, name: 'TLS handshake', summary: 'Server Hello', msgFields: [...hs(2),
              ['Cipher suite', [0x13, 0x01], 'TLS_AES_128_GCM_SHA256', 'The one format both sides will use.'],
              ['Key share (X25519)', opaqueBytes(32, 42), '32 bytes', 'Server\'s half. Both sides now compute the same secret without ever sending it.', { opaque: true }],
            ], opaqueLen: 900, seed: 9, opaqueName: 'Encrypted handshake', opaqueDesc: 'Certificate, its signature and Finished, already encrypted with the new keys.' })) },
      ],
    },
    {
      title: 'Encrypted request', sub: 'Plain HTTP, sealed inside TLS',
      text: 'The browser writes an ordinary HTTP request, including Accept-Encoding to say it can decompress gzip and Brotli. TLS encrypts it; on the wire it is just an "Application Data" record. Use the inspector\'s decrypted view to see what\'s inside.',
      show: [],
      facts: [['Plaintext', 'GET /menu HTTP/1.1'], ['On the wire', 'Record type 23, random-looking bytes'], ['Integrity', '16-byte GCM auth tag']],
      packets: [
        { t: 0.033, from: 'client', to: 'server', label: 'App data', kind: 'enc', proto: 'TLSv1.3', info: 'Application Data (encrypted HTTP request)', note: 'Anyone on the path sees only ciphertext.',
          frame: frame(out(), up({ id: 0x5102 }), tcp({ sport: 52810, dport: 443, flags: ['PSH', 'ACK'], seq: 230, ack: 1050 }), tls({ type: 'appdata', osi: 6, name: 'TLS record', summary: 'Application Data', opaqueLen: 110, seed: 21 })),
          decrypted: frame(textProto({ name: 'HTTP request (decrypted)', summary: 'GET /menu', lines: [
            ['GET /menu HTTP/1.1', 'The request, exactly as the browser wrote it.', 'Request line'],
            ['Host: shop.example', 'Which site.', 'Host'],
            ['Accept-Encoding: gzip, br', 'Presentation negotiation: "I can decompress gzip or Brotli".', 'Accept-Encoding'],
            ['Accept-Charset: utf-8', 'I read UTF-8 text.', 'Accept-Charset'],
            ['', 'End of headers.', 'End of headers'],
          ] })) },
      ],
    },
    {
      title: 'Compressed + encrypted reply', sub: '4.8 KB of HTML in 1.4 KB',
      text: 'The server compresses the HTML with gzip (text compresses well: repeated tags) and labels it Content-Encoding: gzip. Then TLS encrypts the compressed bytes. Order matters: compress first, then encrypt, since encrypted data looks random and won\'t compress.',
      show: [],
      facts: [['Original', '4,812 bytes HTML'], ['gzip', '1,390 bytes (−71%)'], ['Encrypted', '1,390 + 17 bytes (tag + type)']],
      packets: [
        { t: 0.064, from: 'server', to: 'client', label: 'App data', kind: 'enc', proto: 'TLSv1.3', info: 'Application Data (encrypted, gzip HTTP response)', note: 'Compressed, then encrypted.',
          frame: frame(inn(), down({ id: 0x9a02 }), tcp({ sport: 443, dport: 52810, flags: ['PSH', 'ACK'], seq: 1050, ack: 340 }), tls({ type: 'appdata', osi: 6, name: 'TLS record', summary: 'Application Data', opaqueLen: 1407, seed: 22 })),
          decrypted: frame(textProto({ name: 'HTTP response (decrypted)', summary: '200 OK, gzip', lines: [
            ['HTTP/1.1 200 OK', 'Success.', 'Status line'],
            ['Content-Type: text/html; charset=utf-8', 'Presentation info: it\'s HTML, encoded as UTF-8.', 'Content-Type'],
            ['Content-Encoding: gzip', 'The body is gzip-compressed; decompress before reading.', 'Content-Encoding'],
            ['Content-Length: 1390', 'Compressed size.', 'Content-Length'],
            ['', 'End of headers.', 'End of headers'],
          ], opaqueBody: 1300, bodyDesc: 'gzip stream (starts 1f 8b). Still unreadable until decompressed.' })) },
      ],
    },
    {
      title: 'Decrypt · decompress · decode', sub: 'Unwrapping in reverse order',
      text: 'The browser reverses each step: TLS decrypts and checks the tag (any tampering = rejected), gzip expands the bytes, and UTF-8 decoding turns bytes back into "Café — 日本語". Now Layer 7 can render it.',
      show: [],
      facts: [['1. Decrypt', 'AES-128-GCM + verify tag'], ['2. Decompress', 'gzip → 4,812 bytes'], ['3. Decode', 'UTF-8 → characters']],
      packets: [],
    },
  ],
  quiz: [
    { q: 'Why compress before encrypting, not after?', options: ['Encryption is slower on big data', 'Encrypted data looks random and can\'t be compressed', 'It\'s required by HTTP'], answer: 1, why: 'Good ciphertext has no patterns, so compression finds nothing to shrink.' },
    { q: 'How many bytes does "€" take in UTF-8?', options: ['1', '2', '3'], answer: 2, why: '€ is U+20AC, which needs 3 bytes: e2 82 ac.' },
    { q: 'Which header tells the browser the body is gzip?', options: ['Content-Type', 'Content-Encoding', 'Accept-Charset'], answer: 1, why: 'Content-Encoding describes compression; Content-Type describes the media type and charset.' },
  ],
};

/* ---------------------------- Layer 5 ---------------------------- */

export const session = {
  id: 'session',
  layer: 5,
  name: 'Sessions',
  full: 'Opening, keeping and resuming a conversation',
  tag: 'TLS handshake, login, ticket, resume',
  summary:
    'The session layer manages a conversation over time: setting it up, knowing who is on the other end, surviving interruptions, and closing it cleanly. On the modern web this is done by TLS (handshakes, session tickets, resumption) together with application session tokens like cookies.',
  facts: [
    ['OSI layer', 'Session (5)'],
    ['Setup', 'TLS handshake (1-RTT)'],
    ['Resumption', 'Pre-shared key from a session ticket'],
    ['App session', 'Session cookie / token'],
    ['Teardown', 'close_notify + TCP FIN'],
  ],
  legend: [
    { kind: 'hs', label: 'Session control' },
    { kind: 'enc', label: 'Session data' },
    { kind: 'tcp', label: 'TCP' },
  ],
  nodes: { ...nodesBase, client: { ...nodesBase.client, label: 'Mail app' }, server: { ...nodesBase.server, label: 'Mail Server' } },
  links: linksBase,
  seq: ['client', 'server'],
  steps: [
    {
      title: 'Open the session', sub: 'Full TLS handshake',
      text: 'The app opens a secure session. A full handshake costs one round trip and requires the server to prove its identity with a certificate, which is relatively expensive.',
      show: ['client', 'router', 'inet', 'server'],
      facts: [['Handshake', 'Full (certificate verified)'], ['Cost', '1 RTT + signature checks']],
      packets: [
        { t: 0, from: 'client', to: 'server', label: 'ClientHello', kind: 'hs', proto: 'TLSv1.3', info: 'Client Hello', note: 'Start a new session.',
          frame: frame(out(), up({ id: 0x6101 }), tcp({ sport: 53001, dport: 443, flags: ['PSH', 'ACK'], seq: 1, ack: 1 }), tls({ osi: 5, name: 'TLS handshake', summary: 'Client Hello', msgFields: hs(1), opaqueLen: 220, seed: 31, opaqueName: 'Hello contents', opaqueDesc: 'Random, cipher suites, key share, extensions.' })) },
        { t: 0.03, from: 'server', to: 'client', label: 'ServerHello+Cert', kind: 'hs', proto: 'TLSv1.3', info: 'Server Hello, Certificate, Finished', note: 'Here\'s proof I\'m mail.example.',
          frame: frame(inn(), down({ id: 0xa101 }), tcp({ sport: 443, dport: 53001, flags: ['PSH', 'ACK'], seq: 1, ack: 225 }), tls({ osi: 5, name: 'TLS handshake', summary: 'Server Hello + Certificate', msgFields: hs(2), opaqueLen: 2400, seed: 32, opaqueName: 'Certificate chain + Finished', opaqueDesc: 'Encrypted certificate chain (~2 KB) and handshake MAC.' })) },
        { t: 0.032, from: 'client', to: 'server', label: 'Finished', kind: 'hs', proto: 'TLSv1.3', info: 'Change Cipher Spec, Finished', note: 'Session established.',
          frame: frame(out(), up({ id: 0x6102 }), tcp({ sport: 53001, dport: 443, flags: ['PSH', 'ACK'], seq: 225, ack: 2410 }), tls({ type: 'appdata', osi: 5, name: 'TLS record', summary: 'Finished', opaqueLen: 53, seed: 33, opaqueName: 'Encrypted Finished', opaqueDesc: 'Proves the client saw the same handshake.' })) },
      ],
    },
    {
      title: 'Who are you?', sub: 'Authenticate once, get a token',
      text: 'The user logs in. The server creates an application session and returns a session cookie. Every later request just presents the cookie instead of the password: the server now remembers the conversation.',
      show: [],
      facts: [['Token', 'sid=7f3a… (HttpOnly, Secure)'], ['Lifetime', '14 days, or until logout']],
      packets: [
        { t: 0.05, from: 'client', to: 'server', label: 'POST /login', kind: 'enc', proto: 'HTTP', info: 'POST /login (inside TLS)', note: 'username + password',
          frame: frame(out(), up({ id: 0x6103 }), tcp({ sport: 53001, dport: 443, flags: ['PSH', 'ACK'], seq: 278, ack: 2410 }), tls({ type: 'appdata', osi: 6, summary: 'Application Data', opaqueLen: 160, seed: 34 })),
          decrypted: frame(textProto({ name: 'HTTP (decrypted)', summary: 'POST /login', lines: [
            ['POST /login HTTP/1.1', 'Sending credentials.', 'Request line'],
            ['Host: mail.example', 'Site.', 'Host'],
            ['Content-Type: application/x-www-form-urlencoded', 'Form data.', 'Content-Type'],
            ['', 'End of headers.', 'End of headers'],
          ], body: 'user=ana&pass=••••••', bodyDesc: 'Credentials: safe only because the session is encrypted.' })) },
        { t: 0.081, from: 'server', to: 'client', label: 'Set-Cookie', kind: 'enc', proto: 'HTTP', info: '303 See Other, Set-Cookie: sid=…', note: 'Here\'s your session ID.',
          frame: frame(inn(), down({ id: 0xa102 }), tcp({ sport: 443, dport: 53001, flags: ['PSH', 'ACK'], seq: 2410, ack: 455 }), tls({ type: 'appdata', osi: 6, summary: 'Application Data', opaqueLen: 140, seed: 35 })),
          decrypted: frame(textProto({ name: 'HTTP (decrypted)', summary: '303 + Set-Cookie', lines: [
            ['HTTP/1.1 303 See Other', 'Login OK, go to the inbox.', 'Status line'],
            ['Set-Cookie: sid=7f3a9c1e; HttpOnly; Secure; Max-Age=1209600', 'The session token. HttpOnly hides it from scripts; Secure keeps it on HTTPS.', 'Set-Cookie'],
            ['Location: /inbox', 'Where to go next.', 'Location'],
            ['', 'End of headers.', 'End of headers'],
          ] })) },
      ],
    },
    {
      title: 'A ticket for later', sub: 'NewSessionTicket',
      text: 'The server also hands the client a TLS session ticket: an encrypted blob only the server can open. If the connection breaks, the client can present it to resume without a full handshake.',
      show: [],
      facts: [['Ticket lifetime', '7 days max (TLS 1.3)'], ['Stored by', 'Client TLS library']],
      packets: [
        { t: 0.082, from: 'server', to: 'client', label: 'Ticket', kind: 'hs', proto: 'TLSv1.3', info: 'New Session Ticket', note: 'Show me this next time.',
          frame: frame(inn(), down({ id: 0xa103 }), tcp({ sport: 443, dport: 53001, flags: ['PSH', 'ACK'], seq: 2550, ack: 455 }), tls({ type: 'appdata', osi: 5, name: 'TLS record', summary: 'New Session Ticket', opaqueLen: 250, seed: 36, opaqueName: 'Encrypted ticket', opaqueDesc: 'Lifetime, age offset and the ticket itself (only the server can decrypt it).' })) },
      ],
    },
    {
      title: 'Interruption', sub: 'The connection drops',
      text: 'The laptop switches from Wi-Fi to a hotspot and the TCP connection dies; a segment in flight is lost. Layer 4 can\'t save it: the old connection is gone. But the session (cookie + ticket) still exists on both sides.',
      show: [],
      facts: [['TCP connection', 'Dead'], ['Session cookie', 'Still valid'], ['TLS ticket', 'Still valid']],
      packets: [
        { t: 3.2, from: 'client', to: 'server', label: 'GET /inbox', kind: 'enc', proto: 'TLSv1.3', info: 'Application Data [lost: network changed]', note: 'Never arrives.', lost: true,
          frame: frame(out(), up({ id: 0x6104 }), tcp({ sport: 53001, dport: 443, flags: ['PSH', 'ACK'], seq: 455, ack: 2810 }), tls({ type: 'appdata', osi: 6, summary: 'Application Data', opaqueLen: 120, seed: 37 })) },
      ],
    },
    {
      title: 'Resume', sub: 'Abbreviated handshake with the ticket',
      text: 'On a new TCP connection the client sends a ClientHello with a pre_shared_key extension carrying the ticket. The server accepts it: no certificate, no signature, fewer bytes. The cookie rides along and the user is still logged in.',
      show: [],
      facts: [['Certificate sent', 'No'], ['Handshake size', '≈ 300 B vs ≈ 2.6 KB'], ['User re-login', 'Not needed']],
      packets: [
        { t: 4.1, from: 'client', to: 'server', label: 'Hello+PSK', kind: 'hs', proto: 'TLSv1.3', info: 'Client Hello (pre_shared_key)', note: 'It\'s me again: here\'s my ticket.',
          frame: frame(out(), up({ id: 0x6201 }), tcp({ sport: 53077, dport: 443, flags: ['PSH', 'ACK'], seq: 1, ack: 1 }), tls({ osi: 5, name: 'TLS handshake', summary: 'Client Hello + PSK', msgFields: [...hs(1), ['pre_shared_key', opaqueBytes(250, 36), 'ticket (250 B)', 'The ticket from earlier. Proves we already had a session.', { opaque: true }]], opaqueLen: 90, seed: 38, opaqueName: 'Hello contents' })) },
        { t: 4.13, from: 'server', to: 'client', label: 'ServerHello', kind: 'hs', proto: 'TLSv1.3', info: 'Server Hello (PSK accepted), Finished', note: 'Welcome back. No certificate needed.',
          frame: frame(inn(), down({ id: 0xa201 }), tcp({ sport: 443, dport: 53077, flags: ['PSH', 'ACK'], seq: 1, ack: 345 }), tls({ osi: 5, name: 'TLS handshake', summary: 'Server Hello (resumed)', msgFields: [...hs(2), ['Selected identity', [0, 0], '0', 'Accepts ticket #0: session resumed.']], opaqueLen: 90, seed: 39, opaqueName: 'Encrypted Finished' })) },
        { t: 4.15, from: 'client', to: 'server', label: 'GET /inbox', kind: 'enc', proto: 'HTTP', info: 'GET /inbox (Cookie: sid=…)', note: 'Cookie: sid=7f3a9c1e',
          frame: frame(out(), up({ id: 0x6202 }), tcp({ sport: 53077, dport: 443, flags: ['PSH', 'ACK'], seq: 345, ack: 120 }), tls({ type: 'appdata', osi: 6, summary: 'Application Data', opaqueLen: 130, seed: 40 })),
          decrypted: frame(textProto({ name: 'HTTP (decrypted)', summary: 'GET /inbox', lines: [
            ['GET /inbox HTTP/1.1', 'Retrying the lost request.', 'Request line'],
            ['Host: mail.example', 'Site.', 'Host'],
            ['Cookie: sid=7f3a9c1e', 'The application session survives the broken connection.', 'Cookie'],
            ['', 'End of headers.', 'End of headers'],
          ] })) },
      ],
    },
    {
      title: 'Close cleanly', sub: 'close_notify, then FIN',
      text: 'When the user logs out, the server invalidates the cookie. TLS sends a close_notify alert so neither side mistakes the end for an attack that cut the stream short, then TCP closes with FIN.',
      show: [],
      facts: [['Session cookie', 'Invalidated on logout'], ['TLS', 'close_notify'], ['TCP', 'FIN / ACK']],
      packets: [
        { t: 60, from: 'client', to: 'server', label: 'close_notify', kind: 'hs', proto: 'TLSv1.3', info: 'Alert (close_notify)', note: 'I\'m done.',
          frame: frame(out(), up({ id: 0x6203 }), tcp({ sport: 53077, dport: 443, flags: ['PSH', 'ACK'], seq: 475, ack: 900 }), tls({ type: 'appdata', osi: 5, summary: 'Alert', opaqueLen: 19, seed: 41, opaqueName: 'Encrypted alert', opaqueDesc: 'close_notify, encrypted like everything else.' })) },
        { t: 60.001, from: 'client', to: 'server', label: 'FIN', kind: 'tcp', proto: 'TCP', info: '53077 → 443 [FIN, ACK]', note: 'Closing the TCP connection.',
          frame: frame(out(), up({ id: 0x6204 }), tcp({ sport: 53077, dport: 443, flags: ['FIN', 'ACK'], seq: 499, ack: 900 })) },
      ],
    },
  ],
  quiz: [
    { q: 'What lets the client skip the certificate on reconnect?', options: ['The TCP sequence number', 'A TLS session ticket (PSK)', 'The DNS cache'], answer: 1, why: 'The ticket proves a previous session; the server resumes with a pre-shared key.' },
    { q: 'The TCP connection died. Why is the user still logged in?', options: ['The app session (cookie) is separate from the connection', 'TCP reconnects automatically', 'The password is cached in the packet'], answer: 0, why: 'Sessions outlive individual transport connections; that\'s the point of Layer 5.' },
    { q: 'Why send close_notify before FIN?', options: ['To speed up TCP', 'So a cut-off stream can\'t be mistaken for a clean end', 'To delete the cookie'], answer: 1, why: 'Without it, an attacker could truncate data and the receiver couldn\'t tell.' },
  ],
};

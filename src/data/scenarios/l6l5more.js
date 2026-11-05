import { frame, ethernet, ipv4, tcp, tls, textProto, custom, opaqueBytes, asciiB } from '../../lib/packet.js';

const CL = { ip: '192.168.1.10', mac: '3c:22:fb:10:4a:10' };
const GW = '00:1e:58:a1:00:01';
const out = () => ethernet({ src: CL.mac, dst: GW });
const inn = () => ethernet({ src: GW, dst: CL.mac });

/* ======================= Layer 6: Certificates ======================= */
const BANK = '203.0.113.44';
const up = (o = {}) => ipv4({ src: CL.ip, dst: BANK, ttl: 128, ...o });
const down = (o = {}) => ipv4({ src: BANK, dst: CL.ip, ttl: 54, ...o });
const t1 = (o) => tcp({ sport: 55120, dport: 443, flags: ['PSH', 'ACK'], ...o });
const t2 = (o) => tcp({ sport: 443, dport: 55120, flags: ['PSH', 'ACK'], ...o });

const certLayer = (name, osi, rows) => custom({ name, osi, summary: rows[0][2], fields: rows.map(([n, v, d, len, o]) => [n, len ? opaqueBytes(len, n.length) : asciiB(v), v, d, o || (len ? { opaque: true } : {})]) });

export const certificates = {
  id: 'certs',
  layer: 6,
  name: 'Certificates & Trust',
  full: 'How TLS proves who the server is',
  tag: 'X.509 chains, signatures, key exchange',
  summary:
    'Encryption is useless if you\'re encrypting to an impostor. In TLS the server sends an X.509 certificate: a document binding its name to a public key, signed by a Certificate Authority your device already trusts. The client verifies the chain, the name and the dates, then checks that the server really holds the matching private key.',
  keyIdeas: [
    'Symmetric vs asymmetric cryptography, and why TLS uses both',
    'What\'s inside an X.509 certificate (subject, SAN, issuer, validity, public key, signature)',
    'Chain of trust: leaf → intermediate → root in your OS/browser trust store',
    'CertificateVerify: proving possession of the private key',
    'Forward secrecy with ephemeral (EC)DHE keys; what happens when validation fails',
  ],
  facts: [
    ['OSI layer', 'Presentation (6): encryption & data integrity'],
    ['Certificate format', 'X.509 v3, DER-encoded ASN.1'],
    ['Key exchange', 'ECDHE (X25519) → forward secrecy'],
    ['Signatures', 'ECDSA P-256 / RSA-PSS / Ed25519'],
    ['Defined in', 'RFC 5280 (X.509), RFC 8446 (TLS 1.3)'],
  ],
  legend: [{ kind: 'hs', label: 'Handshake' }, { kind: 'enc', label: 'Encrypted' }, { kind: 'err', label: 'Alert' }],
  nodes: {
    client: { label: 'Browser', sub: CL.ip, type: 'laptop', x: 130, y: 360 },
    router: { label: 'Router', sub: '192.168.1.1', type: 'router', x: 360, y: 280 },
    inet: { label: 'Internet', type: 'cloud', x: 600, y: 330 },
    bank: { label: 'bank.example', sub: BANK, type: 'server', x: 860, y: 230 },
  },
  links: [['client', 'router'], ['router', 'inet'], ['inet', 'bank']],
  seq: ['client', 'bank'],
  steps: [
    {
      title: 'Two kinds of keys', sub: 'Asymmetric to agree, symmetric to encrypt',
      text: 'Symmetric ciphers like AES are fast but need both sides to share a secret. Asymmetric (public-key) crypto lets strangers agree on a secret and sign things, but it\'s slow. TLS uses asymmetric crypto only during the handshake, to authenticate and agree keys, then encrypts everything with AES.',
      deep: [
        'Key exchange (ECDHE): each side generates a fresh key pair and sends only the public half. Combining your private key with their public key gives both sides the same shared secret, and an eavesdropper who sees both public halves can\'t compute it.',
        'Because these key pairs are thrown away after the session, stealing the server\'s long-term private key later doesn\'t decrypt old recordings. That\'s forward secrecy, and TLS 1.3 requires it.',
        'Signing: the server\'s long-term private key (whose public half is in the certificate) is used only to sign, to prove identity, never to encrypt the session.',
      ],
      show: ['client', 'router', 'inet', 'bank'],
      facts: [['Symmetric', 'AES-128-GCM: fast, shared key'], ['Asymmetric', 'X25519, ECDSA: slow, key pairs'], ['TLS uses', 'Asymmetric → derive → symmetric']],
      packets: [],
    },
    {
      title: 'Hello, and a key share', sub: 'ECDHE starts immediately',
      text: 'The ClientHello includes the browser\'s ephemeral X25519 public key and the name it wants (SNI: bank.example). The ServerHello returns the server\'s key share. Both sides now compute the same secret, and everything after this point is encrypted, including the certificate.',
      show: [],
      facts: [['SNI', 'bank.example'], ['Group', 'X25519'], ['Encrypted from', 'Right after ServerHello']],
      packets: [
        { t: 0, from: 'client', to: 'bank', label: 'ClientHello', kind: 'hs', proto: 'TLSv1.3', info: 'Client Hello (SNI=bank.example)', note: 'My key share + "I want bank.example"',
          frame: frame(out(), up({ id: 0x7101 }), t1({ seq: 1, ack: 1 }), tls({ osi: 6, name: 'TLS handshake', summary: 'Client Hello', msgFields: [
            ['Handshake type', [1], '1 (ClientHello)', 'Opens the negotiation.'],
            ['Server name (SNI)', asciiB('bank.example'), 'bank.example', 'Which site we want. Sent in clear text (Encrypted Client Hello is fixing that).'],
            ['Key share (X25519)', opaqueBytes(32, 51), '32 bytes', 'Ephemeral public key: half of the Diffie-Hellman exchange.', { opaque: true }],
          ], opaqueLen: 160, seed: 52, opaqueName: 'Other extensions', opaqueDesc: 'Supported versions, cipher suites, signature algorithms, ALPN.' })) },
        { t: 0.028, from: 'bank', to: 'client', label: 'ServerHello', kind: 'hs', proto: 'TLSv1.3', info: 'Server Hello', note: 'My key share. Switching to encryption now.',
          frame: frame(inn(), down({ id: 0xb101 }), t2({ seq: 1, ack: 220 }), tls({ osi: 6, name: 'TLS handshake', summary: 'Server Hello', msgFields: [
            ['Handshake type', [2], '2 (ServerHello)', 'The server\'s choices.'],
            ['Cipher suite', [0x13, 0x01], 'TLS_AES_128_GCM_SHA256', 'Chosen symmetric cipher and hash.'],
            ['Key share (X25519)', opaqueBytes(32, 53), '32 bytes', 'Server\'s ephemeral public key. Shared secret now known to both.', { opaque: true }],
          ] })) },
      ],
    },
    {
      title: 'The certificate', sub: '"This public key belongs to bank.example"',
      text: 'The server sends its certificate chain (encrypted on the wire; use the decrypted view). The leaf certificate says: subject bank.example, valid Jan–Dec 2026, here is my public key, signed by "Example Issuing CA". The intermediate certificate says Example Issuing CA is vouched for by "Example Root CA".',
      deep: [
        'Browsers check the Subject Alternative Name (SAN) list, not the old Common Name. A cert can cover many names, e.g. bank.example and *.bank.example (a wildcard covers one label only).',
        'Certificates are encoded in ASN.1 DER. The PEM files you see on servers ("-----BEGIN CERTIFICATE-----") are just Base64 of those bytes: another Layer 6 encoding.',
        'Certificate Transparency: every publicly trusted certificate must be logged in public append-only logs, so a CA that issues a rogue cert for your domain gets caught.',
      ],
      show: [],
      facts: [['Leaf', 'bank.example (SAN)'], ['Issuer', 'Example Issuing CA'], ['Root', 'Example Root CA (in trust store)'], ['Valid', '2026-01-10 → 2026-12-10']],
      packets: [
        { t: 0.029, from: 'bank', to: 'client', label: 'Certificate', kind: 'enc', proto: 'TLSv1.3', info: 'Application Data (encrypted Certificate)', note: 'Leaf + intermediate certificate',
          frame: frame(inn(), down({ id: 0xb102 }), t2({ seq: 130, ack: 220 }), tls({ type: 'appdata', osi: 6, summary: 'Encrypted Certificate', opaqueLen: 2350, seed: 54 })),
          decrypted: frame(certLayer('X.509 leaf certificate', 6, [
            ['Subject', 'CN=bank.example', 'Who this certificate identifies.'],
            ['Subject Alt Names', 'bank.example, www.bank.example', 'The exact hostnames it is valid for. Browsers check this list.'],
            ['Issuer', 'CN=Example Issuing CA', 'Who signed it.'],
            ['Validity', '2026-01-10 → 2026-12-10', 'Outside these dates the certificate is rejected.'],
            ['Public key', 'ECDSA P-256', 'The key the server will prove it owns.', 65],
            ['Key usage', 'digitalSignature, serverAuth', 'What the key may be used for.'],
            ['Signature', 'ecdsa-with-SHA256 by Issuing CA', 'The CA\'s signature over all fields above. Changing any byte breaks it.', 72],
          ]), certLayer('X.509 intermediate', 6, [
            ['Subject', 'CN=Example Issuing CA', 'The intermediate CA.'],
            ['Issuer', 'CN=Example Root CA', 'Signed by the root, which lives in the OS/browser trust store.'],
            ['Basic constraints', 'CA:TRUE, pathlen:0', 'Allowed to sign leaf certificates only.'],
            ['Signature', 'by Example Root CA', 'Root\'s signature over this certificate.', 72],
          ])) },
      ],
    },
    {
      title: 'Verify, then prove', sub: 'Chain check + CertificateVerify',
      text: 'The browser verifies: (1) the leaf\'s signature with the intermediate\'s public key, (2) the intermediate\'s signature with a root it already trusts, (3) the name matches bank.example, (4) dates are valid, and (5) it isn\'t revoked. Then the server signs a hash of the whole handshake with its private key (CertificateVerify): only the real owner of the certificate could do that.',
      deep: [
        'Why CertificateVerify matters: certificates are public. Anyone can copy bank.example\'s certificate and send it. Only the holder of the private key can produce a valid signature over this particular handshake, which includes the fresh random values, so it can\'t be replayed.',
        'Revocation is checked via OCSP or CRLs, and servers often "staple" a fresh OCSP response into the handshake to save the client a lookup.',
        'Finished messages contain a MAC over the entire transcript, so if anyone tampered with any earlier message (say, deleting strong cipher suites from the ClientHello) the Finished check fails.',
      ],
      show: [],
      facts: [['Chain', 'leaf ✓ → intermediate ✓ → root ✓'], ['Name', 'bank.example ✓'], ['Dates', 'valid ✓'], ['Key possession', 'CertificateVerify ✓']],
      packets: [
        { t: 0.03, from: 'bank', to: 'client', label: 'Verify+Finished', kind: 'enc', proto: 'TLSv1.3', info: 'Application Data (CertificateVerify, Finished)', note: 'Signature over the handshake transcript',
          frame: frame(inn(), down({ id: 0xb103 }), t2({ seq: 2480, ack: 220 }), tls({ type: 'appdata', osi: 6, summary: 'Encrypted', opaqueLen: 130, seed: 55 })),
          decrypted: frame(custom({ name: 'TLS handshake (decrypted)', osi: 6, summary: 'CertificateVerify + Finished', fields: [
            ['CertificateVerify algorithm', [0x04, 0x03], 'ecdsa_secp256r1_sha256', 'How the signature was made.'],
            ['Signature', opaqueBytes(72, 56), '72 bytes', 'Private-key signature over a hash of every handshake message so far.', { opaque: true }],
            ['Finished (verify data)', opaqueBytes(32, 57), '32 bytes', 'HMAC over the transcript with a key derived from the shared secret.', { opaque: true }],
          ] })) },
        { t: 0.032, from: 'client', to: 'bank', label: 'Finished', kind: 'enc', proto: 'TLSv1.3', info: 'Application Data (Finished)', note: 'Verified. Secure channel ready.',
          frame: frame(out(), up({ id: 0x7102 }), t1({ seq: 220, ack: 2610 }), tls({ type: 'appdata', osi: 6, summary: 'Encrypted Finished', opaqueLen: 53, seed: 58 })) },
      ],
    },
    {
      title: 'When trust fails', sub: 'An impostor on public Wi-Fi',
      text: 'Now imagine a fake hotspot intercepts the connection and presents its own self-signed certificate for bank.example. The signature doesn\'t chain to any trusted root, so the browser aborts with a fatal "bad_certificate" alert and shows a full-page warning. No password is ever sent.',
      deep: [
        'Common real errors: NET::ERR_CERT_DATE_INVALID (expired: renew it; Let\'s Encrypt certs last 90 days), ERR_CERT_COMMON_NAME_INVALID (name mismatch), and ERR_CERT_AUTHORITY_INVALID (self-signed or missing intermediate). A server that forgets to send its intermediate often works in one browser (which cached it) and fails in another.',
        'Companies that inspect HTTPS traffic install their own root CA on employee laptops. That\'s the same "attack", but authorised. HSTS and certificate pinning make apps refuse anything but the expected keys.',
      ],
      show: [],
      facts: [['Presented', 'Self-signed cert for bank.example'], ['Chain', '✗ no trusted root'], ['Result', 'Fatal alert, connection closed']],
      packets: [
        { t: 5, from: 'client', to: 'bank', label: 'Alert', kind: 'err', proto: 'TLSv1.3', info: 'Alert (Level: Fatal, Description: Bad Certificate)', note: 'Certificate rejected: connection aborted',
          frame: frame(out(), up({ id: 0x7201 }), t1({ seq: 220, ack: 1900 }), tls({ type: 'alert', osi: 6, name: 'TLS alert', summary: 'Fatal: bad_certificate', msgFields: [['Level', [2], '2 (fatal)', 'The connection must be closed.'], ['Description', [42], '42 (bad_certificate)', 'The certificate failed verification.']] })) },
      ],
    },
  ],
  quiz: [
    { q: 'Why can\'t an attacker just copy the bank\'s certificate?', options: ['Certificates are secret', 'They\'d also need the private key to sign CertificateVerify', 'Copying is blocked by TCP'], answer: 1, why: 'The certificate is public; possession of the private key is what\'s proven.' },
    { q: 'What gives TLS 1.3 forward secrecy?', options: ['Long certificates', 'Ephemeral (EC)DHE keys discarded after the session', 'AES-256'], answer: 1, why: 'Session keys can\'t be recomputed later even if the server key leaks.' },
    { q: 'Which field must contain the hostname for browsers to accept it?', options: ['Issuer', 'Subject Alternative Name', 'Key usage'], answer: 1, why: 'Modern browsers validate the SAN list.' },
    { q: 'What anchors the chain of trust?', options: ['The website', 'A root CA in the OS/browser trust store', 'DNS'], answer: 1, why: 'Roots are pre-installed and self-signed; everything else must chain to one.' },
  ],
};

/* ======================= Layer 5: WebSocket ======================= */
const CHAT = '203.0.113.60';
const KEY = [0x37, 0xfa, 0x21, 0x3d];
const OPS = { 1: 'Text', 2: 'Binary', 8: 'Close', 9: 'Ping', 10: 'Pong' };
function ws({ opcode, text = '', mask, closeCode }) {
  const payload = closeCode ? [closeCode >> 8, closeCode & 255, ...asciiB(text)] : asciiB(text);
  const masked = mask ? payload.map((b, i) => b ^ KEY[i % 4]) : payload;
  const fields = [
    ['FIN, opcode', [0x80 | opcode], `FIN=1, ${opcode} (${OPS[opcode]})`, 'FIN=1: this frame is a complete message. The opcode says text, binary or a control frame.'],
    ['Mask, length', [(mask ? 0x80 : 0) | payload.length], `${mask ? 'masked' : 'unmasked'}, ${payload.length} bytes`, mask ? 'Client→server frames MUST be masked (protects broken proxies from cache poisoning).' : 'Server→client frames are never masked.'],
  ];
  if (mask) fields.push(['Masking key', KEY, '37 fa 21 3d', 'Random 4 bytes; each payload byte is XORed with key[i mod 4].', { eg: true }]);
  if (payload.length) fields.push(['Payload', masked, closeCode ? `code ${closeCode} "${text}"` : `"${text}"`, mask ? `XOR-masked bytes; unmasked it reads ${closeCode ? 'a close code + reason' : `"${text}"`}.` : 'Plain payload.']);
  return custom({ name: 'WebSocket frame', osi: 5, summary: `${OPS[opcode]}${text ? `: ${text}` : ''}`, fields });
}
const wsUp = (seq, ack) => [out(), ipv4({ src: CL.ip, dst: CHAT, ttl: 128 }), tcp({ sport: 56000, dport: 443, flags: ['PSH', 'ACK'], seq, ack })];
const wsDown = (seq, ack) => [inn(), ipv4({ src: CHAT, dst: CL.ip, ttl: 53 }), tcp({ sport: 443, dport: 56000, flags: ['PSH', 'ACK'], seq, ack })];
const enc = (len, seed) => tls({ type: 'appdata', osi: 6, summary: 'Application Data', opaqueLen: len, seed });

export const websocket = {
  id: 'websocket',
  layer: 5,
  name: 'WebSocket',
  full: 'A long-lived, two-way session over HTTP',
  tag: 'Upgrade, full-duplex frames, ping/pong, close',
  summary:
    'HTTP is request/response: the server can only speak when asked. Chat, live scores and multiplayer games need a persistent session where either side can send at any time. WebSocket starts as an HTTP request, "upgrades" the connection, and then carries small framed messages in both directions for as long as the session lasts.',
  keyIdeas: [
    'Session establishment via the HTTP Upgrade handshake (101 Switching Protocols)',
    'Full-duplex dialogue: the server pushes without being asked',
    'Keep-alive with ping/pong control frames to detect dead sessions',
    'Graceful session teardown with close codes (1000 normal, 1001 going away…)',
    'Frame anatomy: FIN, opcode, mask, length, and client-side XOR masking',
  ],
  facts: [
    ['OSI layer', 'Session (5): dialogue control over a connection'],
    ['URL scheme', 'ws:// (80) · wss:// (443, over TLS)'],
    ['Overhead', '2–14 bytes per frame'],
    ['Message types', 'text, binary, ping, pong, close'],
    ['Defined in', 'RFC 6455'],
  ],
  legend: [{ kind: 'req', label: 'Client' }, { kind: 'res', label: 'Server' }, { kind: 'hs', label: 'Control' }],
  nodes: {
    client: { label: 'Chat app', sub: CL.ip, type: 'laptop', x: 140, y: 360 },
    router: { label: 'Router', sub: '192.168.1.1', type: 'router', x: 380, y: 270 },
    inet: { label: 'Internet', type: 'cloud', x: 610, y: 330 },
    server: { label: 'Chat Server', sub: CHAT, type: 'server', x: 860, y: 230 },
  },
  links: [['client', 'router'], ['router', 'inet'], ['inet', 'server']],
  seq: ['client', 'server'],
  steps: [
    {
      title: 'Ask to upgrade', sub: 'An HTTP request with a twist',
      text: 'Over an existing TLS connection the app sends a normal-looking GET with "Upgrade: websocket" and "Connection: Upgrade", plus a random Sec-WebSocket-Key. It\'s asking: "can we stop doing HTTP on this connection and open a WebSocket session instead?"',
      deep: [
        'Starting as HTTP means WebSockets pass through the same ports, proxies and load balancers as normal web traffic, and can reuse cookies for authentication.',
        'Sec-WebSocket-Protocol can negotiate a sub-protocol (e.g. "chat.v2", "graphql-ws"): an agreement on what the messages mean.',
      ],
      show: ['client', 'router', 'inet', 'server'],
      facts: [['Method', 'GET /chat'], ['Upgrade', 'websocket'], ['Key', 'dGhlIHNhbXBsZSBub25jZQ==']],
      packets: [
        { t: 0, from: 'client', to: 'server', label: 'Upgrade', kind: 'req', proto: 'HTTP', info: 'GET /chat HTTP/1.1 (Upgrade: websocket)', note: 'Please upgrade this connection',
          frame: frame(...wsUp(1, 1), enc(260, 61)),
          decrypted: frame(textProto({ name: 'HTTP request (decrypted)', osi: 7, summary: 'GET /chat Upgrade', lines: [
            ['GET /chat HTTP/1.1', 'An ordinary request line.', 'Request line'],
            ['Host: chat.example', 'Site.', 'Host'],
            ['Upgrade: websocket', 'The protocol we want to switch to.', 'Upgrade'],
            ['Connection: Upgrade', 'This hop should act on the Upgrade header.', 'Connection'],
            ['Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Random 16 bytes, Base64. The server must transform it to prove it understood.', 'Sec-WebSocket-Key'],
            ['Sec-WebSocket-Version: 13', 'The only standard version.', 'Sec-WebSocket-Version'],
            ['Cookie: sid=7f3a9c1e', 'Authenticates the session using the app login.', 'Cookie'],
            ['', 'End of headers.', 'End of headers'],
          ] })) },
      ],
    },
    {
      title: 'Session established', sub: '101 Switching Protocols',
      text: 'The server agrees with status 101 and proves it speaks WebSocket by returning Sec-WebSocket-Accept, which is Base64(SHA-1(key + a fixed GUID)). From this byte on, the connection carries WebSocket frames, not HTTP.',
      deep: ['The accept value stops a confused plain-HTTP server, or a cache, from accidentally "agreeing" to a WebSocket. For the RFC\'s example key the answer is s3pPLMBiTxaQ9kYGzzhZRbK+xOo=.'],
      show: [],
      facts: [['Status', '101 Switching Protocols'], ['Accept', 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='], ['Session', 'open, full duplex']],
      packets: [
        { t: 0.03, from: 'server', to: 'client', label: '101', kind: 'res', proto: 'HTTP', info: 'HTTP/1.1 101 Switching Protocols', note: 'Upgrade accepted: session open',
          frame: frame(...wsDown(1, 261), enc(150, 62)),
          decrypted: frame(textProto({ name: 'HTTP response (decrypted)', osi: 7, summary: '101 Switching Protocols', lines: [
            ['HTTP/1.1 101 Switching Protocols', 'Agreed: this connection now speaks WebSocket.', 'Status line'],
            ['Upgrade: websocket', 'Confirms the protocol.', 'Upgrade'],
            ['Connection: Upgrade', 'Confirms the switch.', 'Connection'],
            ['Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=', 'Base64(SHA-1(key + 258EAFA5-E914-47DA-95CA-C5AB0DC85B11)).', 'Sec-WebSocket-Accept'],
            ['', 'End of headers. WebSocket frames follow.', 'End of headers'],
          ] })) },
      ],
    },
    {
      title: 'Talk both ways', sub: 'Full-duplex messages',
      text: 'The app sends a text message: a tiny frame with a 2-byte header plus a 4-byte mask key. Then the server pushes a message from another user without any request. That\'s the point of a session: either side may speak whenever it has something to say.',
      deep: [
        'Compare polling: without WebSockets the app would send an HTTP request every few seconds asking "anything new?". Each one costs hundreds of bytes of headers and adds latency.',
        'Large messages can be split across frames (FIN=0 on all but the last; continuation opcode 0). Control frames may be interleaved in between.',
      ],
      show: [],
      facts: [['Client frame', '6 B header (masked)'], ['Server frame', '2 B header'], ['HTTP polling equivalent', '≈ 500 B per check']],
      packets: [
        { t: 2.1, from: 'client', to: 'server', label: 'Text →', kind: 'req', proto: 'WebSocket', info: 'WebSocket Text [FIN] [MASKED] "hi all!"', note: '"hi all!"', frame: frame(...wsUp(261, 151), enc(30, 63)), decrypted: frame(ws({ opcode: 1, text: 'hi all!', mask: true })) },
        { t: 3.4, from: 'server', to: 'client', label: '← Push', kind: 'res', proto: 'WebSocket', info: 'WebSocket Text [FIN] "bob: hey ana"', note: 'Server pushes a message unprompted', frame: frame(...wsDown(151, 291), enc(30, 64)), decrypted: frame(ws({ opcode: 1, text: 'bob: hey ana' })) },
      ],
    },
    {
      title: 'Keep the session alive', sub: 'Ping / pong',
      text: 'When the chat is quiet, the server sends a Ping control frame every 30 s and the client must answer with a Pong. This detects dead sessions (a laptop that went to sleep) and keeps NAT routers and firewalls from forgetting the idle connection.',
      deep: ['Home routers typically drop idle TCP mappings after a few minutes, and mobile carriers sometimes after 30 s. Without keep-alives the session would silently die and the next message would vanish.'],
      show: [],
      facts: [['Interval', '30 s (app choice)'], ['Missed pongs', '→ server closes the session']],
      packets: [
        { t: 33.4, from: 'server', to: 'client', label: 'Ping', kind: 'hs', proto: 'WebSocket', info: 'WebSocket Ping [FIN]', note: 'Still there?', frame: frame(...wsDown(181, 291), enc(20, 65)), decrypted: frame(ws({ opcode: 9, text: 'k' })) },
        { t: 33.45, from: 'client', to: 'server', label: 'Pong', kind: 'hs', proto: 'WebSocket', info: 'WebSocket Pong [FIN] [MASKED]', note: 'Yes!', frame: frame(...wsUp(291, 201), enc(24, 66)), decrypted: frame(ws({ opcode: 10, text: 'k', mask: true })) },
      ],
    },
    {
      title: 'End the session', sub: 'Close handshake',
      text: 'The user leaves the chat. The client sends a Close frame with code 1000 (normal closure); the server echoes a Close back. Only after both sides agree does TCP close. This orderly teardown is classic session-layer behaviour: both parties know the dialogue is over and nothing was lost.',
      deep: ['Common close codes: 1000 normal, 1001 going away (tab closed), 1006 abnormal (no close frame, connection died; never sent on the wire), 1008 policy violation, 1011 server error.'],
      show: [],
      facts: [['Close code', '1000 (normal)'], ['Then', 'TCP FIN from both sides']],
      packets: [
        { t: 60, from: 'client', to: 'server', label: 'Close', kind: 'hs', proto: 'WebSocket', info: 'WebSocket Connection Close [FIN] [MASKED] 1000', note: 'Goodbye (1000)', frame: frame(...wsUp(321, 201), enc(30, 67)), decrypted: frame(ws({ opcode: 8, text: 'bye', mask: true, closeCode: 1000 })) },
        { t: 60.03, from: 'server', to: 'client', label: 'Close', kind: 'hs', proto: 'WebSocket', info: 'WebSocket Connection Close [FIN] 1000', note: 'Goodbye (1000)', frame: frame(...wsDown(201, 351), enc(24, 68)), decrypted: frame(ws({ opcode: 8, text: '', closeCode: 1000 })) },
      ],
    },
  ],
  quiz: [
    { q: 'Which status code confirms a WebSocket upgrade?', options: ['200 OK', '101 Switching Protocols', '301 Moved'], answer: 1, why: '101 means the connection now speaks a different protocol.' },
    { q: 'Why does the server send Ping frames?', options: ['To measure bandwidth', 'To detect dead sessions and keep NAT mappings alive', 'To encrypt data'], answer: 1, why: 'Keep-alives prove the peer is alive and refresh middlebox state.' },
    { q: 'Which frames must be masked?', options: ['Client → server', 'Server → client', 'Both'], answer: 0, why: 'RFC 6455 requires clients to mask; servers must not.' },
  ],
};

import { frame, ethernet, ipv4, udp, tcp, dns, dhcp, arp, textProto, ipBytes } from '../../lib/packet.js';

/* =============================== DHCP =============================== */
const MAC = '3c:22:fb:10:4a:10';
const SRV = { ip: '192.168.1.1', mac: '00:1e:58:a1:00:01' };
const BC = 'ff:ff:ff:ff:ff:ff';
const OFFER = '192.168.1.57';
const commonOpts = [
  [1, ipBytes('255.255.255.0'), 'Subnet mask: 255.255.255.0', 'Which part of the address is the network: here 192.168.1.x.'],
  [3, ipBytes(SRV.ip), `Router: ${SRV.ip}`, 'Default gateway: where to send anything that isn\'t local.'],
  [6, [...ipBytes('8.8.8.8'), ...ipBytes('1.1.1.1')], 'DNS servers: 8.8.8.8, 1.1.1.1', 'Resolvers to use for name lookups.'],
  [51, [0, 1, 0x51, 0x80], 'Lease time: 86400 s (24 h)', 'How long the client may keep the address before it must renew.'],
  [54, ipBytes(SRV.ip), `Server ID: ${SRV.ip}`, 'Which DHCP server is speaking (there could be several).'],
];
const bcastOut = () => [ethernet({ src: MAC, dst: BC, dstNote: 'Broadcast: the client doesn\'t know who the DHCP server is.' }), ipv4({ src: '0.0.0.0', dst: '255.255.255.255', proto: 17, ttl: 128, df: false, srcNote: '0.0.0.0: "I have no address yet".', dstNote: 'Limited broadcast: everyone on this LAN.' }), udp({ sport: 68, dport: 67 })];
const fromSrv = () => [ethernet({ src: SRV.mac, dst: MAC }), ipv4({ src: SRV.ip, dst: OFFER, proto: 17, df: false }), udp({ sport: 67, dport: 68 })];

export const dhcpLesson = {
  id: 'dhcp',
  layer: 7,
  name: 'DHCP',
  full: 'Dynamic Host Configuration Protocol',
  tag: 'How a device gets its IP address (DORA)',
  summary:
    'When you join a network your device has no IP address, no gateway and no DNS server. DHCP hands all of that out automatically in four messages: Discover, Offer, Request, Acknowledge (DORA). The address is leased, not owned, and must be renewed.',
  keyIdeas: [
    'Why a brand-new device must use broadcasts (it has no IP yet)',
    'The four DORA messages and what each one means',
    'What a lease is, and the T1 (50%) / T2 (87.5%) renewal timers',
    'Why the client checks for address conflicts with ARP',
    'How DHCP relay agents let one server cover many subnets',
  ],
  facts: [
    ['TCP/IP layer', 'Application (OSI 7), configures Layer 3'],
    ['Ports', 'UDP 67 (server), 68 (client)'],
    ['Messages', 'Discover, Offer, Request, ACK (+NAK, Release, Inform)'],
    ['Hands out', 'IP, subnet mask, gateway, DNS, lease time'],
    ['Defined in', 'RFC 2131, RFC 2132'],
  ],
  legend: [{ kind: 'bcast', label: 'Broadcast' }, { kind: 'res', label: 'Server reply' }, { kind: 'tcp', label: 'ARP check' }],
  nodes: {
    client: { label: 'New laptop', sub: '0.0.0.0\n' + MAC, type: 'laptop', x: 130, y: 360 },
    sw: { label: 'Switch', type: 'switch', x: 430, y: 280 },
    srv: { label: 'Router + DHCP', sub: SRV.ip, type: 'router', x: 760, y: 180 },
    tv: { label: 'Smart TV', sub: '192.168.1.40', type: 'phone', x: 760, y: 420 },
  },
  links: [['client', 'sw'], ['sw', 'srv'], ['sw', 'tv']],
  seq: ['client', 'srv', 'tv'],
  steps: [
    {
      title: 'Discover', sub: '"Is there a DHCP server out there?"',
      text: 'The laptop has no address, so it can only broadcast: source 0.0.0.0, destination 255.255.255.255, MAC ff:ff:ff:ff:ff:ff. Every device on the LAN receives the Discover; only DHCP servers answer it.',
      deep: [
        'Why UDP? There is no IP address yet to build a TCP connection with, and broadcasts only work with connectionless transport.',
        'The Discover can list option 55 (Parameter Request List): the settings the client wants, such as subnet mask, router, DNS and domain name. It may also include option 50 to ask for the address it had last time.',
        'Broadcasts stop at routers. If the DHCP server lives on another subnet, the router runs a DHCP relay agent (Cisco: "ip helper-address") that turns the broadcast into a unicast to the server and fills in giaddr so the server knows which pool to use.',
      ],
      show: ['client', 'sw', 'srv', 'tv'],
      facts: [['Client IP', '0.0.0.0 (none)'], ['Sent to', '255.255.255.255 / ff:ff:ff:ff:ff:ff'], ['Ports', 'UDP 68 → 67']],
      packets: [
        { t: 0, from: 'client', to: ['srv', 'tv'], label: 'Discover', kind: 'bcast', proto: 'DHCP', info: 'DHCP Discover - Transaction ID 0x3903f326', note: 'Anyone have an address for me?', src: '0.0.0.0', dst: '255.255.255.255',
          hold: { sw: 'Switch: destination is the broadcast MAC, so it floods the frame out of every port except the one it came in on.' },
          frame: frame(...bcastOut(), dhcp({ msgType: 1, chaddr: MAC, options: [[55, [1, 3, 6, 15, 51], 'Parameter list: mask, router, DNS, domain, lease', 'The settings the client is asking for.']] })) },
      ],
    },
    {
      title: 'Offer', sub: '"You can have 192.168.1.57"',
      text: 'The server picks a free address from its pool, reserves it briefly, and offers it along with the subnet mask, default gateway, DNS servers and lease time. The smart TV saw the Discover too, but simply ignored it.',
      deep: [
        'Before offering, many servers ping the address to make sure nobody is already using it.',
        'If there are several DHCP servers, the client may receive several Offers. It picks one (usually the first), and the others time out their reservations.',
        'A rogue DHCP server (for example a misconfigured home router plugged into an office network) can hand out wrong gateways and hijack traffic. Managed switches defend against this with "DHCP snooping": only trusted ports may send Offers.',
      ],
      show: [],
      facts: [['Offered IP', OFFER], ['Mask', '255.255.255.0'], ['Gateway', SRV.ip], ['DNS', '8.8.8.8, 1.1.1.1'], ['Lease', '24 hours']],
      packets: [
        { t: 0.004, from: 'srv', to: 'client', label: 'Offer', kind: 'res', proto: 'DHCP', info: `DHCP Offer - ${OFFER}`, note: `Offer: ${OFFER}, gateway ${SRV.ip}`, dst: OFFER,
          frame: frame(...fromSrv(), dhcp({ msgType: 2, chaddr: MAC, yiaddr: OFFER, siaddr: SRV.ip, options: commonOpts })) },
      ],
    },
    {
      title: 'Request', sub: '"Yes please, I\'ll take it"',
      text: 'The client formally requests the offered address. It\'s broadcast again on purpose: any other DHCP server that made an Offer sees it and learns its offer was declined, so it can return that address to its pool.',
      deep: [
        'Option 50 (Requested IP) carries the address and option 54 (Server Identifier) names which server the client chose.',
        'The client still uses 0.0.0.0 as its source. It doesn\'t own the address until the ACK arrives.',
      ],
      show: [],
      facts: [['Requested', OFFER], ['Chosen server', SRV.ip], ['Still broadcast?', 'Yes, to inform all servers']],
      packets: [
        { t: 0.006, from: 'client', to: ['srv', 'tv'], label: 'Request', kind: 'bcast', proto: 'DHCP', info: `DHCP Request - ${OFFER}`, note: `I accept ${OFFER} from ${SRV.ip}`, src: '0.0.0.0', dst: '255.255.255.255',
          frame: frame(...bcastOut(), dhcp({ msgType: 3, chaddr: MAC, options: [[50, ipBytes(OFFER), `Requested IP: ${OFFER}`, 'The address the client is accepting.'], [54, ipBytes(SRV.ip), `Server ID: ${SRV.ip}`, 'The server whose offer was chosen.']] })) },
      ],
    },
    {
      title: 'Acknowledge', sub: 'The lease is official',
      text: 'The server confirms with an ACK and records the lease (MAC → IP, expiry time). The laptop now configures its interface: IP 192.168.1.57/24, gateway 192.168.1.1, DNS 8.8.8.8. Layers 3 and up can finally work.',
      deep: [
        'If the server can\'t honour the request (for example the client asked for an old address from another network), it replies with a NAK, and the client starts over with a Discover.',
        'Many networks configure "reservations": the server always gives the same IP to a particular MAC address. That\'s how printers keep a stable address without static configuration.',
      ],
      show: [],
      facts: [['Your IP', `${OFFER}/24`], ['Lease start', 'now'], ['Lease end', '+24 h']],
      packets: [
        { t: 0.009, from: 'srv', to: 'client', label: 'ACK', kind: 'res', proto: 'DHCP', info: `DHCP ACK - ${OFFER}`, note: `Lease confirmed: ${OFFER} for 24 h`, dst: OFFER,
          frame: frame(...fromSrv(), dhcp({ msgType: 5, chaddr: MAC, yiaddr: OFFER, siaddr: SRV.ip, options: commonOpts })) },
      ],
    },
    {
      title: 'Conflict check', sub: 'Gratuitous ARP',
      text: 'Before using the address, the laptop broadcasts an ARP for its own new IP. If anyone answers, the address is already taken (someone configured it statically), and the client sends DHCPDECLINE. Silence means it\'s safe.',
      deep: ['The same announcement also updates other hosts\' ARP caches with the new IP-to-MAC mapping. This "gratuitous ARP" trick is also used when a server fails over to a standby machine that takes over its IP.'],
      show: [],
      facts: [['ARP for', OFFER], ['Reply received', 'None → address is free']],
      packets: [
        { t: 0.012, from: 'client', to: ['srv', 'tv'], label: 'ARP probe', kind: 'tcp', proto: 'ARP', info: `Who has ${OFFER}? (ARP probe)`, note: 'Is anyone already using my new address?', src: MAC, dst: 'Broadcast',
          frame: frame(ethernet({ src: MAC, dst: BC, type: 0x0806 }), arp({ op: 1, sha: MAC, spa: '0.0.0.0', tha: '00:00:00:00:00:00', tpa: OFFER })) },
      ],
    },
    {
      title: 'Renewal', sub: 'At 50% of the lease (T1)',
      text: 'Twelve hours later (T1 = 50% of the lease) the laptop quietly renews. It now has an address, so this Request is unicast straight to the server. The server ACKs and the 24-hour clock restarts. If the server doesn\'t answer, the client tries any server at T2 (87.5%) and gives the address up when the lease expires.',
      deep: ['Running `ipconfig /release` sends a DHCPRELEASE that returns the address early; `ipconfig /renew` forces a new Request. On Linux: `dhclient -r` and `dhclient`.'],
      show: [],
      facts: [['T1', '12 h: unicast renew'], ['T2', '21 h: broadcast rebind'], ['Expiry', '24 h: stop using the IP']],
      packets: [
        { t: 43200, from: 'client', to: 'srv', label: 'Renew', kind: 'req', proto: 'DHCP', info: `DHCP Request (renewing) - ${OFFER}`, note: 'Can I keep my address?', src: OFFER,
          frame: frame(ethernet({ src: MAC, dst: SRV.mac }), ipv4({ src: OFFER, dst: SRV.ip, proto: 17, df: false }), udp({ sport: 68, dport: 67 }), dhcp({ msgType: 3, chaddr: MAC, ciaddr: OFFER, broadcast: false })) },
        { t: 43200.004, from: 'srv', to: 'client', label: 'ACK', kind: 'res', proto: 'DHCP', info: `DHCP ACK - ${OFFER} (lease renewed)`, note: 'Renewed for another 24 h', dst: OFFER,
          frame: frame(...fromSrv(), dhcp({ msgType: 5, chaddr: MAC, yiaddr: OFFER, ciaddr: OFFER, broadcast: false, options: commonOpts })) },
      ],
    },
  ],
  quiz: [
    { q: 'Why is the DHCP Discover sent as a broadcast?', options: ['It\'s faster', 'The client has no IP and doesn\'t know the server', 'Routers require it'], answer: 1, why: 'With no address and no server address, broadcast is the only way to reach anyone.' },
    { q: 'What does DORA stand for?', options: ['Discover, Offer, Request, Acknowledge', 'Deliver, Open, Read, Accept', 'DNS, Options, Route, ARP'], answer: 0, why: 'The four messages of a normal DHCP exchange.' },
    { q: 'When does a client first try to renew its lease?', options: ['At expiry', 'At 50% of the lease time (T1)', 'Every minute'], answer: 1, why: 'T1 = 50% (unicast renew), T2 = 87.5% (broadcast rebind).' },
    { q: 'What lets one DHCP server serve clients on other subnets?', options: ['A DHCP relay agent on the router', 'A bigger subnet mask', 'NAT'], answer: 0, why: 'The relay forwards the broadcast as unicast and sets giaddr.' },
  ],
};

/* =============================== SMTP =============================== */
const A = { ip: '10.1.0.25', mac: '52:54:00:01:00:25' };
const MX = '198.51.100.25';
const GWM = '52:54:00:01:00:01';
const mOut = () => ethernet({ src: A.mac, dst: GWM });
const mIn = () => ethernet({ src: GWM, dst: A.mac });
let sq = 1, rq = 1;
const smtpLine = (from, label, text, desc, t, kind) => {
  const out = from === 'mta';
  const len = text.length + 2;
  const seq = out ? sq : rq, ack = out ? rq : sq;
  if (out) sq += len; else rq += len;
  return {
    t, from, to: out ? 'mx' : 'mta', label, kind: kind || (out ? 'req' : 'res'), proto: 'SMTP', info: (out ? 'C: ' : 'S: ') + text.split('\r\n')[0], note: text.split('\r\n')[0],
    frame: frame(out ? mOut() : mIn(), out ? ipv4({ src: A.ip, dst: MX }) : ipv4({ src: MX, dst: A.ip, ttl: 50 }), tcp({ sport: out ? 50001 : 25, dport: out ? 25 : 50001, flags: ['PSH', 'ACK'], seq, ack }),
      textProto({ name: 'SMTP', summary: text.split('\r\n')[0], lines: text.split('\r\n').map((l, i) => [l, i === 0 ? desc : 'Continuation line.', i === 0 ? (out ? 'Command' : 'Reply') : 'Line']) })),
  };
};

export const smtpLesson = (() => {
  sq = 1; rq = 1;
  const body = ['From: Alice <alice@example.com>', 'To: Bob <bob@other.org>', 'Subject: Lunch?', 'Date: Thu, 05 Nov 2026 12:00:00 +0000', 'Message-ID: <a1b2@example.com>', 'Content-Type: text/plain; charset=utf-8', '', 'Pizza at 1?', '.'];
  return {
    id: 'smtp',
    layer: 7,
    name: 'SMTP',
    full: 'Simple Mail Transfer Protocol',
    tag: 'How an email crosses the internet',
    summary:
      'Email is store-and-forward. Your app submits a message to your provider\'s mail server, which looks up the recipient domain\'s MX record in DNS and then relays the message to that server using a plain-text conversation of commands and 3-digit reply codes. The recipient later downloads it with IMAP or POP3.',
    keyIdeas: [
      'Mail servers find each other with DNS MX records',
      'The SMTP command/reply dialogue: EHLO, MAIL FROM, RCPT TO, DATA, QUIT',
      'Reply codes: 2xx ok, 3xx continue, 4xx try later, 5xx permanent failure',
      'Envelope vs headers: why the "From:" you see can differ from MAIL FROM',
      'Submission (587) vs relay (25) vs retrieval (IMAP 993 / POP3 995), plus SPF/DKIM/DMARC',
    ],
    facts: [
      ['OSI layer', 'Application (7)'],
      ['Ports', '25 relay · 587 submission · 465 implicit TLS'],
      ['Transport', 'TCP'],
      ['Format', 'Text commands + 3-digit replies'],
      ['Defined in', 'RFC 5321 (SMTP), RFC 5322 (message format)'],
    ],
    legend: [{ kind: 'dns', label: 'DNS' }, { kind: 'req', label: 'Client command' }, { kind: 'res', label: 'Server reply' }],
    nodes: {
      alice: { label: 'Alice', sub: 'mail app', type: 'laptop', x: 90, y: 400 },
      mta: { label: 'mail.example.com', sub: A.ip, type: 'server', x: 280, y: 240 },
      inet: { label: 'Internet', type: 'cloud', x: 520, y: 300 },
      dns: { label: 'DNS Resolver', sub: '10.1.0.53', type: 'dns', x: 520, y: 90 },
      mx: { label: 'mx.other.org', sub: MX, type: 'server', x: 770, y: 220 },
      bob: { label: 'Bob', sub: 'reads via IMAP', type: 'laptop', x: 900, y: 420 },
    },
    links: [['alice', 'mta'], ['mta', 'inet'], ['inet', 'dns'], ['inet', 'mx'], ['mx', 'bob']],
    seq: ['mta', 'dns', 'mx'],
    steps: [
      {
        title: 'Where does bob@other.org live?', sub: 'MX lookup',
        text: 'Alice has already submitted her message to her own server (port 587, logged in, over TLS). Now mail.example.com must deliver it. It asks DNS for the MX (mail exchanger) record of other.org, which names the server that accepts its mail.',
        deep: [
          'A domain can list several MX records with priorities, e.g. "10 mx1" and "20 mx2". Senders try the lowest number first and fall back to the others.',
          'Then a normal A/AAAA lookup turns mx.other.org into an IP. (Our simplified packet shows the A answer directly.)',
        ],
        show: ['alice', 'mta', 'inet', 'dns', 'mx', 'bob'],
        facts: [['Query', 'MX other.org'], ['Answer', '10 mx.other.org'], ['Then', `A mx.other.org → ${MX}`]],
        packets: [
          { t: 0, from: 'mta', to: 'dns', label: 'MX?', kind: 'dns', proto: 'DNS', info: 'Standard query MX other.org', note: 'Who accepts mail for other.org?',
            frame: frame(mOut(), ipv4({ src: A.ip, dst: '10.1.0.53', proto: 17, df: false }), udp({ sport: 41000, dport: 53 }), dns({ id: 0x4d58, qname: 'mx.other.org' })) },
          { t: 0.02, from: 'dns', to: 'mta', label: 'MX answer', kind: 'dns', proto: 'DNS', info: `Standard query response A ${MX}`, note: `mx.other.org → ${MX}`,
            frame: frame(mIn(), ipv4({ src: '10.1.0.53', dst: A.ip, proto: 17, df: false }), udp({ sport: 53, dport: 41000 }), dns({ id: 0x4d58, qname: 'mx.other.org', response: true, answer: MX, ttl: 3600 })) },
        ],
      },
      {
        title: 'Greeting', sub: '220 and EHLO',
        text: 'After a TCP handshake to port 25, the receiving server speaks first with a 220 greeting. The sender introduces itself with EHLO, and the server replies with a multi-line 250 listing its extensions, such as STARTTLS, SIZE limits and 8BITMIME.',
        deep: [
          'EHLO ("extended hello") replaced the original HELO. Each 250- line advertises a capability, and the last line uses "250 " (with a space) to mark the end.',
          'Next the sender would normally issue STARTTLS and redo the conversation encrypted. We skip that here so the dialogue stays readable.',
        ],
        show: [],
        facts: [['Server port', '25 (MTA to MTA)'], ['Capabilities', 'STARTTLS, SIZE, 8BITMIME, PIPELINING']],
        packets: [
          smtpLine('mx', '220', '220 mx.other.org ESMTP ready', 'Greeting: the server is ready. 2xx = success.', 0.06),
          smtpLine('mta', 'EHLO', 'EHLO mail.example.com', 'The client introduces itself by hostname.', 0.07),
          smtpLine('mx', '250', '250-mx.other.org Hello\r\n250-SIZE 52428800\r\n250-STARTTLS\r\n250 8BITMIME', 'Multi-line OK listing the server\'s extensions.', 0.08),
        ],
      },
      {
        title: 'The envelope', sub: 'MAIL FROM and RCPT TO',
        text: 'Like a postal envelope, SMTP sends the sender and recipient addresses separately from the letter. The receiver checks each one: it accepts mail for bob@other.org because that\'s its own domain. An unknown user would get "550 No such user".',
        deep: [
          'The envelope sender (MAIL FROM) is where bounces go. It can differ from the "From:" header shown to Bob, which is exactly what spammers abuse.',
          'Defences: SPF (the domain publishes which IPs may send its mail), DKIM (a cryptographic signature over headers and body), and DMARC (a policy that ties them to the visible From: and says what to do on failure).',
          'BCC works because of the envelope: a BCC recipient gets a RCPT TO but never appears in the headers.',
        ],
        show: [],
        facts: [['Envelope from', 'alice@example.com'], ['Envelope to', 'bob@other.org'], ['Checks', 'SPF, recipient exists, rate limits']],
        packets: [
          smtpLine('mta', 'MAIL FROM', 'MAIL FROM:<alice@example.com>', 'Envelope sender: bounces return here.', 0.09),
          smtpLine('mx', '250', '250 2.1.0 Sender OK', 'Sender accepted.', 0.1),
          smtpLine('mta', 'RCPT TO', 'RCPT TO:<bob@other.org>', 'Envelope recipient. One RCPT per recipient.', 0.11),
          smtpLine('mx', '250', '250 2.1.5 Recipient OK', 'Recipient accepted.', 0.12),
        ],
      },
      {
        title: 'The letter', sub: 'DATA, headers, body, "."',
        text: 'DATA asks to send the message itself. The 354 reply means "go ahead". The message is header lines (From, To, Subject, Date, Message-ID), a blank line, then the body. A line containing only "." ends it. The server replies 250 once it has safely queued the message, and from that moment it is responsible for it.',
        deep: [
          'Attachments and non-English text are encoded with MIME (a Layer 6 concern): multipart bodies, Base64 or quoted-printable, and charsets.',
          'A body line that genuinely starts with "." is sent as ".." ("dot-stuffing") so it can\'t end the message early.',
        ],
        show: [],
        facts: [['Headers', 'From, To, Subject, Date, Message-ID'], ['End marker', 'CRLF . CRLF'], ['Result', '250 queued as 4Fq2']],
        packets: [
          smtpLine('mta', 'DATA', 'DATA', 'Begin the message content.', 0.13),
          smtpLine('mx', '354', '354 End data with <CR><LF>.<CR><LF>', '3xx = intermediate: continue.', 0.14),
          smtpLine('mta', 'Message', body.join('\r\n'), 'RFC 5322 headers, blank line, body, lone dot.', 0.15),
          smtpLine('mx', '250 queued', '250 2.0.0 OK queued as 4Fq2', 'Accepted: the receiving server now owns delivery.', 0.2),
        ],
      },
      {
        title: 'Goodbye & delivery', sub: 'QUIT, then IMAP',
        text: 'QUIT and 221 close the conversation. mx.other.org files the message in Bob\'s mailbox. Later Bob\'s app fetches it with IMAP over TLS (port 993), a different protocol that keeps mail on the server and syncs folders across devices.',
        deep: [
          'If delivery fails temporarily (a 4xx code, or the server is down), the sender keeps the message queued and retries for days. A 5xx code is permanent and produces a bounce email to the envelope sender.',
          'POP3 (995) downloads and usually deletes from the server; IMAP keeps a synced copy, which is why it won.',
        ],
        show: [],
        facts: [['Close', 'QUIT → 221'], ['Retrieval', 'IMAP (993) or POP3 (995)'], ['Retries', '4xx: retry for days · 5xx: bounce']],
        packets: [
          smtpLine('mta', 'QUIT', 'QUIT', 'End of session.', 0.21),
          smtpLine('mx', '221', '221 2.0.0 Bye', 'Closing the connection.', 0.22),
        ],
      },
    ],
    quiz: [
      { q: 'How does a mail server find where to deliver mail for other.org?', options: ['DNS MX record', 'It asks the root server', 'ARP'], answer: 0, why: 'MX records name the mail exchangers for a domain.' },
      { q: 'What does a reply code starting with 4 mean?', options: ['Success', 'Temporary failure: try again later', 'Permanent failure'], answer: 1, why: '4xx = transient; the sender keeps the mail queued and retries.' },
      { q: 'What ends the DATA section?', options: ['A line with only "."', 'QUIT', 'An empty line'], answer: 0, why: 'CRLF.CRLF marks the end; the empty line only separates headers from body.' },
      { q: 'Which mechanism signs an email cryptographically?', options: ['SPF', 'DKIM', 'MX'], answer: 1, why: 'DKIM adds a signature header verified with a public key published in DNS.' },
    ],
  };
})();

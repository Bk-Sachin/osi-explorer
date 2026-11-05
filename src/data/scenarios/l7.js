import { frame, ethernet, ipv4, udp, tcp, dns, textProto } from '../../lib/packet.js';

const CL = { ip: '192.168.1.10', mac: '3c:22:fb:10:4a:10' };
const GW = { ip: '192.168.1.1', mac: '00:1e:58:a1:00:01' };
const DNS = '8.8.8.8';
const WEB = '203.0.113.10';

const toGw = (inner) => ethernet({ src: CL.mac, dst: GW.mac, srcNote: 'The laptop\'s network card.', dstNote: 'The router: anything outside the home network goes to it first.' });
const fromGw = () => ethernet({ src: GW.mac, dst: CL.mac, srcNote: 'The router, delivering on the last hop.', dstNote: 'The laptop\'s network card.' });

const html = '<!doctype html>\n<html><head><title>Example Domain</title></head>\n<body><h1>Example Domain</h1><p>This domain is for use in examples.</p></body></html>\n';

export const http = {
  id: 'http',
  layer: 7,
  name: 'HTTP',
  full: 'Hypertext Transfer Protocol',
  tag: 'How a browser fetches a web page',
  summary:
    'HTTP is how browsers and servers talk. The client sends a request (a method like GET plus a path and headers) and the server returns a status code, headers and usually a body. Before any of that can happen, lower layers must find the server (DNS) and open a reliable pipe (TCP).',
  facts: [
    ['OSI layer', 'Application (7)'],
    ['Default port', '80 (HTTPS: 443)'],
    ['Runs over', 'TCP (HTTP/3: QUIC over UDP)'],
    ['Format', 'Text headers + optional body'],
    ['Methods', 'GET, POST, PUT, DELETE, HEAD'],
    ['Defined in', 'RFC 9110, RFC 9112'],
  ],
  legend: [
    { kind: 'dns', label: 'DNS' },
    { kind: 'tcp', label: 'TCP' },
    { kind: 'req', label: 'Request' },
    { kind: 'res', label: 'Response' },
  ],
  nodes: {
    client: { label: 'Client', sub: CL.ip, type: 'laptop', x: 130, y: 390 },
    router: { label: 'Router', sub: GW.ip, type: 'router', x: 340, y: 290 },
    inet: { label: 'Internet', type: 'cloud', x: 570, y: 340 },
    dns: { label: 'DNS Resolver', sub: DNS, type: 'dns', x: 570, y: 110 },
    web: { label: 'Web Server', sub: WEB, type: 'server', x: 850, y: 250 },
  },
  links: [['client', 'router'], ['router', 'inet'], ['inet', 'dns'], ['inet', 'web']],
  seq: ['client', 'dns', 'web'],
  steps: [
    {
      title: 'Client request',
      sub: 'The browser prepares a request',
      text: 'You type http://www.example.com. The browser will send GET /, but networks deliver to IP addresses, not names. So before anything else it needs the server\'s address.',
      show: ['client', 'router'],
      facts: [['URL', 'http://www.example.com/'], ['Method', 'GET'], ['Next hop', `Router ${GW.ip}`]],
      packets: [],
    },
    {
      title: 'DNS resolution',
      sub: 'Finding the server\'s IP',
      text: 'The laptop asks its DNS resolver (8.8.8.8, learned from DHCP) for the A record of www.example.com. It\'s one small UDP datagram to port 53, and the reply carries the IPv4 address.',
      show: ['inet', 'dns'],
      facts: [['Resolver', `${DNS} (cached answer)`], ['Transport', 'UDP, port 53'], ['Answer', `A ${WEB}`]],
      packets: [
        {
          t: 0.0, from: 'client', to: 'dns', label: 'DNS query', kind: 'dns', proto: 'DNS', info: 'Standard query A www.example.com', note: 'A? www.example.com',
          frame: frame(toGw(), ipv4({ src: CL.ip, dst: DNS, proto: 17, id: 0xd825, df: false, ttl: 128 }), udp({ sport: 59321, dport: 53 }), dns({ qname: 'www.example.com' })),
        },
        {
          t: 0.012, from: 'dns', to: 'client', label: 'DNS reply', kind: 'dns', proto: 'DNS', info: `Standard query response A ${WEB}`, note: `www.example.com → ${WEB}`,
          frame: frame(fromGw(), ipv4({ src: DNS, dst: CL.ip, proto: 17, id: 0x7a11, df: false, ttl: 117 }), udp({ sport: 53, dport: 59321 }), dns({ qname: 'www.example.com', response: true, answer: WEB })),
        },
      ],
    },
    {
      title: 'TCP connection',
      sub: 'A three-way handshake',
      text: 'HTTP/1.1 needs a reliable byte stream, so the laptop opens a TCP connection to port 80. SYN, SYN-ACK, ACK: both sides agree on starting sequence numbers and are ready to talk.',
      show: ['web'],
      facts: [['Client port', '52344 (temporary)'], ['Server port', '80'], ['Round trips', '1 before any data']],
      packets: [
        { t: 0.024, from: 'client', to: 'web', label: 'SYN', kind: 'tcp', proto: 'TCP', info: '52344 → 80 [SYN] Seq=0', note: 'Let\'s talk. My sequence starts at 0.',
          frame: frame(toGw(), ipv4({ src: CL.ip, dst: WEB, ttl: 128, id: 0x4f01 }), tcp({ sport: 52344, dport: 80, flags: ['SYN'], opts: true })) },
        { t: 0.041, from: 'web', to: 'client', label: 'SYN-ACK', kind: 'tcp', proto: 'TCP', info: '80 → 52344 [SYN, ACK] Seq=0 Ack=1', note: 'Agreed. Mine starts at 0 too.',
          frame: frame(fromGw(), ipv4({ src: WEB, dst: CL.ip, ttl: 52, id: 0x0000 }), tcp({ sport: 80, dport: 52344, flags: ['SYN', 'ACK'], ack: 1, win: 65160, opts: true })) },
        { t: 0.058, from: 'client', to: 'web', label: 'ACK', kind: 'tcp', proto: 'TCP', info: '52344 → 80 [ACK] Seq=1 Ack=1', note: 'Connection established.',
          frame: frame(toGw(), ipv4({ src: CL.ip, dst: WEB, ttl: 128, id: 0x4f02 }), tcp({ sport: 52344, dport: 80, flags: ['ACK'], seq: 1, ack: 1, win: 1026 })) },
      ],
    },
    {
      title: 'HTTP exchange',
      sub: 'Request and response',
      text: 'Now the actual application conversation: a readable text request with a method, path and headers. The server answers with a status line ("200 OK"), headers describing the content, then the HTML itself.',
      show: [],
      facts: [['Request', 'GET / HTTP/1.1'], ['Status', '200 OK'], ['Content-Type', 'text/html; charset=UTF-8']],
      packets: [
        {
          t: 0.058, from: 'client', to: 'web', label: 'GET /', kind: 'req', proto: 'HTTP', info: 'GET / HTTP/1.1', note: 'GET / HTTP/1.1  ·  Host: www.example.com',
          frame: frame(toGw(), ipv4({ src: CL.ip, dst: WEB, ttl: 128, id: 0x4f03 }), tcp({ sport: 52344, dport: 80, flags: ['PSH', 'ACK'], seq: 1, ack: 1, win: 1026 }),
            textProto({ name: 'HTTP request', summary: 'GET / HTTP/1.1', lines: [
              ['GET / HTTP/1.1', 'Request line: method GET, path "/", protocol version.', 'Request line'],
              ['Host: www.example.com', 'Which site we want: one server IP can host many sites.', 'Host'],
              ['User-Agent: Mozilla/5.0', 'Identifies the browser.', 'User-Agent'],
              ['Accept: text/html', 'Content types the browser prefers.', 'Accept'],
              ['Connection: keep-alive', 'Keep the TCP connection open for more requests.', 'Connection'],
              ['', 'An empty line ends the headers.', 'End of headers'],
            ] })),
        },
        {
          t: 0.076, from: 'web', to: 'client', label: '200 OK', kind: 'res', proto: 'HTTP', info: 'HTTP/1.1 200 OK (text/html)', note: 'HTTP/1.1 200 OK  ·  text/html',
          frame: frame(fromGw(), ipv4({ src: WEB, dst: CL.ip, ttl: 52, id: 0x8e21 }), tcp({ sport: 80, dport: 52344, flags: ['PSH', 'ACK'], seq: 1, ack: 117, win: 509 }),
            textProto({ name: 'HTTP response', summary: '200 OK', lines: [
              ['HTTP/1.1 200 OK', 'Status line: 200 means success. 3xx redirect, 4xx client error, 5xx server error.', 'Status line'],
              ['Content-Type: text/html; charset=UTF-8', 'What the body is and how its characters are encoded (a Layer 6 concern!).', 'Content-Type'],
              [`Content-Length: ${html.length}`, 'Body size, so the client knows where it ends.', 'Content-Length'],
              ['Cache-Control: max-age=604800', 'The browser may reuse this copy for a week.', 'Cache-Control'],
              ['', 'An empty line ends the headers.', 'End of headers'],
            ], body: html, bodyDesc: 'The HTML document the browser will render.' })),
        },
      ],
    },
    {
      title: 'Page rendering',
      sub: 'The browser displays the content',
      text: 'The browser parses the HTML, builds the page, and would fire more HTTP requests for any images, CSS or scripts, reusing the same keep-alive connection. Seven packets and ~80 ms got you a web page.',
      show: [],
      facts: [['Packets', '7'], ['Time', '≈ 80 ms'], ['Layers used', '7 → 1 on every packet']],
      packets: [],
    },
  ],
  quiz: [
    { q: 'Why does the browser contact DNS before the web server?', options: ['To encrypt the request', 'Because packets are addressed by IP, not by name', 'To ask permission to connect'], answer: 1, why: 'IP (Layer 3) routes by address. DNS turns the human-friendly name into that address.' },
    { q: 'What does "200" in "HTTP/1.1 200 OK" mean?', options: ['The page is 200 bytes', 'Success', 'Redirect to another URL'], answer: 1, why: '2xx codes mean success; 3xx redirect, 4xx client error, 5xx server error.' },
    { q: 'Which header lets one IP address host many websites?', options: ['Host', 'Accept', 'Connection'], answer: 0, why: 'Host tells the server which site you want, so many sites can share one IP.' },
  ],
};

const RES = { ip: '192.168.1.53', mac: '00:1e:58:a1:00:35' };
const ROOT = '198.41.0.4';
const TLD = '192.5.6.30';
const AUTH = '198.51.100.53';
const ANSWER = '93.184.215.14';
const resOut = () => ethernet({ src: RES.mac, dst: GW.mac, srcNote: 'The resolver box.', dstNote: 'The office router.' });
const resIn = () => ethernet({ src: GW.mac, dst: RES.mac, srcNote: 'The office router.', dstNote: 'The resolver box.' });

export const dnsRecursive = {
  id: 'dns',
  layer: 7,
  name: 'DNS',
  full: 'Domain Name System',
  tag: 'Recursive lookup from root to answer',
  summary:
    'DNS is the internet\'s phone book, but no single server knows every name. A recursive resolver walks the tree for you: the root servers point to the .com servers, which point to the domain\'s own authoritative server, which finally answers.',
  facts: [
    ['OSI layer', 'Application (7)'],
    ['Port', '53 (UDP, TCP for large answers)'],
    ['Record types', 'A, AAAA, CNAME, MX, NS, TXT'],
    ['Caching', 'Each answer has a TTL'],
    ['Defined in', 'RFC 1034, RFC 1035'],
  ],
  legend: [
    { kind: 'dns', label: 'Query' },
    { kind: 'res', label: 'Referral / answer' },
  ],
  nodes: {
    client: { label: 'Laptop', sub: CL.ip, type: 'laptop', x: 110, y: 400 },
    resolver: { label: 'Resolver', sub: RES.ip, type: 'dns', x: 330, y: 260 },
    inet: { label: 'Internet', type: 'cloud', x: 560, y: 300 },
    root: { label: 'Root Server', sub: ROOT, type: 'server', x: 560, y: 90 },
    tld: { label: '.com TLD', sub: TLD, type: 'server', x: 850, y: 160 },
    auth: { label: 'Authoritative', sub: AUTH, type: 'server', x: 850, y: 420 },
  },
  links: [['client', 'resolver'], ['resolver', 'inet'], ['inet', 'root'], ['inet', 'tld'], ['inet', 'auth']],
  seq: ['client', 'resolver', 'root', 'tld', 'auth'],
  steps: [
    {
      title: 'Ask the resolver', sub: 'One question, recursion desired',
      text: 'The laptop sends one query and sets RD (recursion desired): "please find the full answer for me". The resolver has nothing cached, so it starts at the top of the tree.',
      show: ['client', 'resolver'], facts: [['Name', 'shop.example.com'], ['Cache', 'empty']],
      packets: [
        { t: 0, from: 'client', to: 'resolver', label: 'Query', kind: 'dns', proto: 'DNS', info: 'Standard query A shop.example.com', note: 'A? shop.example.com (RD=1)',
          frame: frame(ethernet({ src: CL.mac, dst: RES.mac }), ipv4({ src: CL.ip, dst: RES.ip, proto: 17, df: false }), udp({ sport: 50111, dport: 53 }), dns({ id: 0x11aa, qname: 'shop.example.com' })) },
      ],
    },
    {
      title: 'Root servers', sub: '"Try the .com servers"',
      text: 'There are 13 root server names (hundreds of machines via anycast). The root doesn\'t know shop.example.com, but it knows who runs .com, and replies with a referral (NS records).',
      show: ['inet', 'root'], facts: [['Asked', ROOT], ['Got', 'Referral → .com servers']],
      packets: [
        { t: 0.004, from: 'resolver', to: 'root', label: 'Query', kind: 'dns', proto: 'DNS', info: 'Standard query A shop.example.com', note: 'A? shop.example.com (RD=0)',
          frame: frame(resOut(), ipv4({ src: RES.ip, dst: ROOT, proto: 17, df: false }), udp({ sport: 40001, dport: 53 }), dns({ id: 0x2201, qname: 'shop.example.com', rd: false })) },
        { t: 0.021, from: 'root', to: 'resolver', label: 'Referral', kind: 'res', proto: 'DNS', info: 'Referral: com. NS a.gtld-servers.net', note: 'Ask a.gtld-servers.net (192.5.6.30)',
          frame: frame(resIn(), ipv4({ src: ROOT, dst: RES.ip, proto: 17, df: false, ttl: 55 }), udp({ sport: 53, dport: 40001 }), dns({ id: 0x2201, qname: 'shop.example.com', response: true, answer: TLD, ttl: 172800 })) },
      ],
    },
    {
      title: 'TLD servers', sub: '"Try example.com\'s own server"',
      text: 'The .com servers know every .com domain\'s name servers. Another referral: the authoritative server for example.com.',
      show: ['tld'], facts: [['Asked', TLD], ['Got', 'Referral → ns1.example.com']],
      packets: [
        { t: 0.025, from: 'resolver', to: 'tld', label: 'Query', kind: 'dns', proto: 'DNS', info: 'Standard query A shop.example.com', note: 'A? shop.example.com',
          frame: frame(resOut(), ipv4({ src: RES.ip, dst: TLD, proto: 17, df: false }), udp({ sport: 40002, dport: 53 }), dns({ id: 0x2202, qname: 'shop.example.com', rd: false })) },
        { t: 0.044, from: 'tld', to: 'resolver', label: 'Referral', kind: 'res', proto: 'DNS', info: 'Referral: example.com NS ns1.example.com', note: `Ask ns1.example.com (${AUTH})`,
          frame: frame(resIn(), ipv4({ src: TLD, dst: RES.ip, proto: 17, df: false, ttl: 54 }), udp({ sport: 53, dport: 40002 }), dns({ id: 0x2202, qname: 'shop.example.com', response: true, answer: AUTH, ttl: 172800 })) },
      ],
    },
    {
      title: 'Authoritative answer', sub: 'The owner of the zone replies',
      text: 'example.com\'s own server holds the real record. It answers with the A record and a TTL, and the "aa" (authoritative) flag.',
      show: ['auth'], facts: [['Asked', AUTH], ['Answer', `A ${ANSWER}`], ['TTL', '300 s']],
      packets: [
        { t: 0.048, from: 'resolver', to: 'auth', label: 'Query', kind: 'dns', proto: 'DNS', info: 'Standard query A shop.example.com', note: 'A? shop.example.com',
          frame: frame(resOut(), ipv4({ src: RES.ip, dst: AUTH, proto: 17, df: false }), udp({ sport: 40003, dport: 53 }), dns({ id: 0x2203, qname: 'shop.example.com', rd: false })) },
        { t: 0.071, from: 'auth', to: 'resolver', label: 'Answer', kind: 'res', proto: 'DNS', info: `Standard query response A ${ANSWER}`, note: `shop.example.com → ${ANSWER}`,
          frame: frame(resIn(), ipv4({ src: AUTH, dst: RES.ip, proto: 17, df: false, ttl: 50 }), udp({ sport: 53, dport: 40003 }), dns({ id: 0x2203, qname: 'shop.example.com', response: true, answer: ANSWER, ttl: 300 })) },
      ],
    },
    {
      title: 'Back to the laptop', sub: 'Answer delivered and cached',
      text: 'The resolver caches every step (the .com referral for 2 days, the answer for 5 minutes) and replies to the laptop. The next person asking gets it instantly.',
      show: [], facts: [['Total time', '≈ 75 ms'], ['Next lookup', '< 1 ms (cache)']],
      packets: [
        { t: 0.073, from: 'resolver', to: 'client', label: 'Answer', kind: 'res', proto: 'DNS', info: `Standard query response A ${ANSWER}`, note: `shop.example.com → ${ANSWER}`,
          frame: frame(ethernet({ src: RES.mac, dst: CL.mac }), ipv4({ src: RES.ip, dst: CL.ip, proto: 17, df: false }), udp({ sport: 53, dport: 50111 }), dns({ id: 0x11aa, qname: 'shop.example.com', response: true, answer: ANSWER, ttl: 300 })) },
      ],
    },
  ],
  quiz: [
    { q: 'What does a root server answer for shop.example.com?', options: ['The final IP address', 'A referral to the .com servers', 'An error'], answer: 1, why: 'Root servers only know who runs each top-level domain.' },
    { q: 'Why is the second lookup of the same name so fast?', options: ['The resolver cached it (TTL)', 'UDP is faster the second time', 'The root server remembers you'], answer: 0, why: 'Every answer carries a TTL; resolvers cache it until it expires.' },
    { q: 'Which transport does a normal DNS query use?', options: ['TCP port 80', 'UDP port 53', 'ICMP'], answer: 1, why: 'Small question, small answer: one UDP datagram each way.' },
  ],
};

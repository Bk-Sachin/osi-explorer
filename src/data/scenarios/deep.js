// Extra depth for the original lessons: key ideas + per-step "deep dive" notes.
export const DEEP = {
  http: {
    keyIdeas: [
      'Why every web request starts with lower layers: DNS (name → IP) and TCP (reliable pipe)',
      'Anatomy of an HTTP request: method, path, version, headers, blank line, body',
      'Status code classes: 1xx info, 2xx success, 3xx redirect, 4xx client error, 5xx server error',
      'Statelessness, keep-alive connections and caching headers',
      'HTTP/1.1 vs HTTP/2 (binary, multiplexed) vs HTTP/3 (over QUIC/UDP)',
    ],
    steps: {
      0: ['A URL has parts: scheme (http), host (www.example.com), optional port (:80 is implied), path (/), query (?q=…) and fragment (#top, never sent to the server).', 'The browser first checks its own caches: HTTP cache (maybe it already has the page), DNS cache, and HSTS list (which would force https://).'],
      1: ['Lookup order on a typical OS: browser cache → OS resolver cache → hosts file → configured DNS resolver. Run `ipconfig /displaydns` (Windows) to see the OS cache.', 'For HTTPS the browser would also request an AAAA (IPv6) record and possibly an HTTPS/SVCB record that advertises HTTP/3 support.'],
      2: ['Why a handshake? Both sides need to agree on initial sequence numbers (random, to prevent spoofing) and options before any data can be numbered reliably.', 'With HTTPS a TLS handshake follows here (one more round trip in TLS 1.3). HTTP/3 merges transport and crypto handshakes in QUIC to save time.'],
      3: [
        'Methods have meaning: GET retrieves and must be safe (no side effects); POST creates or submits; PUT replaces; PATCH modifies; DELETE removes. GET, PUT and DELETE are idempotent: repeating them has the same effect as doing them once.',
        'HTTP is stateless: the server doesn\'t remember you between requests. Cookies (a Layer 5 idea) bolt sessions onto it.',
        'The 12.8 KB response in a real capture spans several TCP segments. TCP reassembles them into one byte stream before HTTP reads it.',
        'HTTP/2 replaces this text format with binary frames and lets many requests share one connection at once (multiplexing). HPACK compresses repeated headers.',
      ],
      4: ['Rendering triggers more requests: CSS, JS, images, fonts. Browsers open up to 6 parallel HTTP/1.1 connections per host; HTTP/2 uses one connection for all of them.', 'Cache-Control: max-age=604800 means the next visit within a week costs zero network requests for this file.'],
    },
  },
  dns: {
    keyIdeas: ['Hierarchy: root → TLD → authoritative', 'Recursive vs iterative queries', 'Record types: A, AAAA, CNAME, MX, NS, TXT, PTR', 'Caching and TTLs, negative caching', 'DNS security: spoofing, DNSSEC, DoH/DoT'],
    steps: {
      0: ['A stub resolver (your laptop) asks one question and expects a final answer. The recursive resolver (your ISP, 8.8.8.8, 1.1.1.1) does the legwork with iterative queries.'],
      1: ['Resolvers ship with a "root hints" file listing the 13 root server names (a–m.root-servers.net). Each is anycast: the same IP is announced from hundreds of locations, and routing takes you to the nearest.', 'Referrals include "glue" A records for the TLD servers, so the resolver doesn\'t have to look up the name server\'s own name first (which would be a chicken-and-egg problem).'],
      2: ['Registries (like Verisign for .com) run TLD servers. When you register a domain, your registrar publishes NS records for it in the TLD zone.'],
      3: ['The authoritative server answers from a zone file you control, e.g. "shop  300  IN  A  93.184.215.14". A CNAME would instead say "this name is an alias for another name" and the resolver would chase it.', 'DNSSEC adds signatures (RRSIG records) so resolvers can verify answers weren\'t forged. Without it, cache-poisoning attacks can inject fake answers.'],
      4: ['Negative answers (NXDOMAIN, "no such name") are cached too, for the SOA record\'s minimum TTL.', 'DNS over HTTPS/TLS (DoH/DoT) encrypts the laptop-to-resolver leg so your network can\'t see or tamper with your lookups.', 'Try it: `nslookup -type=MX gmail.com` or `dig +trace shop.example.com` to watch every referral.'],
    },
  },
  presentation: {
    keyIdeas: ['Character sets vs encodings: Unicode code points, UTF-8 bytes', 'Content negotiation: Accept-Encoding / Content-Encoding', 'Lossless compression (gzip/Brotli) and why order matters', 'Authenticated encryption (AES-GCM) for confidentiality + integrity', 'Serialization formats: JSON, XML, Protocol Buffers'],
    steps: {
      0: ['Unicode assigns every character a code point (U+00E9 = é). An encoding turns code points into bytes. UTF-8 is variable length: 0xxxxxxx for ASCII, 110xxxxx 10xxxxxx for 2 bytes, 1110xxxx for 3, 11110xxx for 4 (emoji).', 'A Byte Order Mark (EF BB BF) sometimes starts UTF-8 files; UTF-16 needs one (FE FF / FF FE) to signal endianness: a classic presentation-layer detail.', 'Structured data needs a shared format too: JSON (text, self-describing), XML, or binary formats like Protocol Buffers that are smaller and faster but need a schema on both sides.'],
      1: ['A cipher suite in TLS 1.3 names the AEAD cipher and hash, e.g. TLS_AES_128_GCM_SHA256. Key exchange and signature algorithms are negotiated separately in extensions.'],
      2: ['AES-GCM provides authenticated encryption: confidentiality (no one can read it) and integrity (any change is detected via the 16-byte tag).', 'TLS records carry at most 16 KB of plaintext each. Large responses become many records.'],
      3: ['gzip = DEFLATE (LZ77 back-references + Huffman coding). Brotli adds a built-in dictionary of common web strings and usually beats gzip by 15–25% on HTML/CSS/JS.', 'Images (JPEG, PNG, WebP) and video are already compressed. Gzipping them again wastes CPU for no gain.', 'Security footnote: compressing secrets alongside attacker-controlled text leaks information through sizes (CRIME/BREACH attacks), which is why TLS-level compression was removed.'],
      4: ['If any layer disagrees (wrong charset header, double compression, a missing Content-Encoding) you get garbled text or binary junk. Troubleshooting presentation issues means checking each transformation in turn.'],
    },
  },
  session: {
    keyIdeas: ['Session vs connection: a session can outlive many TCP connections', 'Establishment, maintenance, resumption and termination', 'Authentication tokens: cookies, bearer tokens, expiry and logout', 'TLS session tickets / PSK resumption and 0-RTT', 'Checkpointing and dialogue control (half/full duplex)'],
    steps: {
      0: ['In the formal OSI model the session layer offers dialogue control (who may talk when), synchronisation points (checkpoints to resume large transfers) and orderly release. In the internet\'s TCP/IP model these duties are split between TLS, HTTP and the applications themselves.'],
      1: ['Server-side sessions store state in memory or a database keyed by the session ID; stateless tokens (JWTs) carry signed claims inside the token itself, so any server can verify them without a lookup.', 'Session fixation and hijacking are Layer 5 attacks: stealing or planting a session ID. Defences: regenerate the ID at login, HttpOnly + Secure + SameSite cookie flags, short idle timeouts.'],
      2: ['TLS 1.3 can even send application data in the first flight when resuming ("0-RTT early data"), but that data can be replayed by an attacker, so it must only be used for idempotent requests.'],
      3: ['Applications handle interruptions with checkpoints: large downloads use HTTP Range requests ("bytes=5000000-") to continue where they stopped, and cloud uploads split files into resumable chunks.'],
      4: ['Resumption saves a certificate transfer and signature verification, which matters a lot on mobile networks and for busy servers handling millions of reconnects.'],
      5: ['Without close_notify, a network attacker could cut the connection early and the receiver might accept a truncated download as complete: a "truncation attack".'],
    },
  },
  tcp: {
    keyIdeas: ['The three-way handshake and initial sequence numbers', 'Byte-stream numbering: Seq counts bytes, ACK names the next byte expected', 'Sliding windows and segments in flight', 'Loss detection: duplicate ACKs, SACK, retransmission timeout (RTO)', 'Connection teardown and the TCP state machine (FIN_WAIT, TIME_WAIT, CLOSE_WAIT)'],
    steps: {
      0: ['Real initial sequence numbers are random 32-bit values (Wireshark shows them as 0 for readability). Predictable ISNs once allowed attackers to inject data into other people\'s connections.', 'A SYN flood attack sends many SYNs without completing handshakes, filling the server\'s half-open queue. SYN cookies defend against it by encoding state in the SYN-ACK\'s sequence number.', 'States: client CLOSED → SYN_SENT → ESTABLISHED; server LISTEN → SYN_RECEIVED → ESTABLISHED.'],
      1: ['MSS (maximum segment size) = MTU − IP header − TCP header = 1500 − 20 − 20 = 1460 bytes, minus 12 if timestamps are used (1448).', 'The window size is how much unacknowledged data may be in flight. The full flow & congestion story has its own lesson: "TCP Flow & Congestion".'],
      2: ['Selective ACK (SACK) lets the receiver say exactly which blocks it holds beyond the gap, so the sender resends only what\'s missing instead of everything after it.', 'The receiver buffers out-of-order data but cannot give it to the application until the gap is filled: in-order delivery. That wait is called head-of-line blocking.'],
      3: ['If ACKs stop entirely (for example the whole window was lost) the retransmission timer (RTO) fires instead. RTO is computed from measured round-trip times (smoothed RTT + 4 × variance) and doubles on each repeated timeout.'],
      4: ['TIME_WAIT lasts 2 × MSL (typically 60–120 s) so a delayed duplicate segment from the old connection can\'t be mistaken for part of a new connection with the same 4-tuple.', 'A side that receives FIN but hasn\'t closed its own socket sits in CLOSE_WAIT. Lots of CLOSE_WAIT sockets usually means an application bug that forgets to close connections.', 'RST aborts a connection immediately: no graceful close, buffered data discarded.'],
    },
  },
  udp: {
    keyIdeas: ['Connectionless, message-oriented delivery', 'The 8-byte header and the optional (IPv4) checksum', 'Application-level reliability: sequence numbers, jitter buffers, FEC', 'Who uses UDP: DNS, DHCP, VoIP/RTP, games, streaming, QUIC', 'Message boundaries are preserved (unlike TCP\'s byte stream)'],
    steps: {
      0: ['UDP preserves message boundaries: one send() = one datagram = one recv(). TCP is a byte stream, so the app must frame its own messages.', 'RTP (shown inside) adds what real-time media needs: sequence numbers to detect loss and reordering, and timestamps to play audio at the right pace.'],
      1: ['A jitter buffer holds packets for a few tens of ms so variation in arrival time doesn\'t cause choppy audio. Packet-loss concealment interpolates missing audio; forward error correction (FEC) sends redundant data so some losses can be repaired without retransmission.'],
      2: ['QUIC (HTTP/3) runs over UDP but rebuilds reliability, congestion control and encryption in user space, with independent streams so one lost packet doesn\'t stall the others.', 'UDP is also abused for amplification DDoS attacks (small spoofed query → big response, e.g. DNS, NTP, memcached) because there\'s no handshake to verify the source address.'],
    },
  },
  routing: {
    keyIdeas: ['IP addressing: network part vs host part, CIDR prefixes', 'Default gateways and the local-or-remote decision', 'Hop-by-hop forwarding with routing tables (longest prefix match)', 'TTL, ICMP error messages and traceroute', 'What changes per hop (MAC, TTL, checksum) and what doesn\'t (IPs)'],
    steps: {
      0: ['AND the address with the mask: 192.168.1.10 AND 255.255.255.0 = 192.168.1.0. Do the same for the destination. If the results match it\'s local (ARP for it directly); otherwise ARP for the gateway and send it there.', 'Routing tables are filled by connected networks, static routes and dynamic routing protocols: OSPF/IS-IS inside an organisation, BGP between the ~75,000 networks (autonomous systems) that make up the internet.'],
      1: ['Windows `tracert` uses ICMP echo probes like this lesson; Linux/macOS `traceroute` uses UDP probes to high ports by default (the final hop answers "port unreachable"). Each hop is probed three times to show RTT variation.'],
      2: ['Routers pick the most specific matching route (longest prefix). Try the Routing Lab to see 10.20.30.7 match /8, /16 and /24 routes and the /24 win.', 'A "* * *" in traceroute just means that router doesn\'t send ICMP errors (or rate-limits them). It doesn\'t necessarily mean packets are being lost there.'],
      3: ['Default TTLs hint at the OS: Linux/macOS use 64, Windows 128, many network devices 255. A reply with TTL 52 has probably travelled 12 hops from a Linux server.'],
      4: ['Forwarding happens in hardware at line rate on real routers: parse header, longest-prefix lookup (TCAM), decrement TTL, update checksum incrementally, rewrite MACs, queue on the output port.', 'IPv6 works the same way but calls TTL "Hop Limit", has no header checksum at all (lower layers already check), and routers never fragment.'],
    },
  },
  switching: {
    keyIdeas: ['MAC addresses: 48 bits, OUI (vendor) + device part, unicast/multicast/broadcast', 'ARP: mapping IP → MAC, ARP cache', 'Switch learning, flooding, forwarding and filtering', 'Ethernet frame format and the CRC-32 FCS', 'Broadcast domains; ARP spoofing risks'],
    steps: {
      0: ['The first 3 bytes of a MAC are the OUI (vendor ID): a4:5e:60 belongs to Apple. The lowest bit of the first byte marks multicast; ff:ff:ff:ff:ff:ff is broadcast.', 'View caches: `arp -a` (Windows/macOS), `ip neigh` (Linux). Entries expire after a few minutes.'],
      1: ['ARP has no authentication. An attacker can send fake replies ("192.168.1.1 is at MY MAC") and become a man-in-the-middle: ARP spoofing. Switches defend with Dynamic ARP Inspection using DHCP snooping data.'],
      2: ['Switch MAC table entries age out (default 300 s). If the table fills (MAC flooding attack), some switches fall back to flooding everything like a hub. Port security limits MACs per port.'],
      3: ['Switches forward in one of two modes: store-and-forward (receive the whole frame, check FCS, then send) or cut-through (start sending as soon as the destination MAC is read: lower latency, but corrupt frames get forwarded).', 'Loops are deadly at Layer 2 (frames have no TTL!), so redundant switch links are managed by Spanning Tree Protocol (STP), which blocks ports to form a loop-free tree.'],
      4: ['CRC-32 detects all single and double bit errors, all odd numbers of errors and all burst errors up to 32 bits. It\'s not a security mechanism: anyone can recompute it after tampering.'],
    },
  },
  physical: {
    keyIdeas: ['Bits, symbols and baud rate', 'Line coding & clock recovery: NRZ, Manchester, 4B/5B, 8B/10B, PAM', 'Media: twisted pair, fiber (single/multi-mode), radio', 'Attenuation, noise, crosstalk and bit error rate', 'Physical topologies, connectors and Ethernet naming (1000BASE-T)'],
    steps: {
      0: ['Ethernet names decode the physical layer: 1000BASE-T = 1000 Mb/s, BASEband signalling, Twisted pair. 10GBASE-SR = 10 Gb/s over Short-Reach multimode fiber.', 'Cat 5e supports 1 Gb/s; Cat 6a supports 10 Gb/s up to 100 m. Twisting each pair cancels electromagnetic interference and crosstalk.'],
      1: ['Without transitions, a receiver can\'t tell how many identical bits it saw. Modern PHYs scramble the data and use block codes (8b/10b, 64b/66b) to guarantee enough transitions, with only 3% overhead for 64b/66b.'],
      2: ['Baud = symbols per second; bit rate = baud × bits per symbol. 1000BASE-T sends 125 Mbaud on each of 4 pairs, ~2 bits per symbol per pair → 1000 Mb/s, in both directions at once using echo cancellation.', 'Fiber sends light: multimode (orange/aqua cable, LED/VCSEL, hundreds of metres) or single-mode (yellow cable, laser, tens of km).'],
      3: ['The 12-byte gap plus the 8-byte preamble mean small packets waste a lot of wire: 64-byte frames achieve only 76% efficiency, 1500-byte frames ~98%.'],
      4: ['Signal-to-noise ratio limits capacity (Shannon: C = B·log₂(1 + S/N)). Wi-Fi and DSL adapt their modulation, using fewer bits per symbol when noise rises.', 'Layer-1 troubleshooting: link lights, `ethtool eth0` (speed/duplex/errors), CRC error counters on switch ports, and cable testers that find breaks with time-domain reflectometry.'],
    },
  },
};

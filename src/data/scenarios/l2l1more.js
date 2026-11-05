import { frame, ethernet, arp, ipv4, icmp, udp, wifi, custom, physical, opaqueBytes, asciiB } from '../../lib/packet.js';

const mac = (s) => s.split(':').map((h) => parseInt(h, 16));

/* ============================ Layer 2: VLANs ============================ */
const SA = { ip: '10.10.10.21', mac: 'a4:5e:60:10:00:21' };
const SS = { ip: '10.10.10.50', mac: 'a4:5e:60:10:00:50' };
const EA = { ip: '10.20.20.31', mac: 'a4:5e:60:20:00:31' };
const ES = { ip: '10.20.20.60', mac: 'a4:5e:60:20:00:60' };
const RT = { mac: '00:25:90:c2:0a:01', g10: '10.10.10.1', g20: '10.20.20.1' };
const BC = 'ff:ff:ff:ff:ff:ff';

export const vlans = {
  id: 'vlan',
  layer: 2,
  name: 'VLANs & Trunks',
  full: 'IEEE 802.1Q virtual LANs',
  tag: 'One switch, many isolated networks',
  summary:
    'A VLAN splits one physical switched network into several isolated broadcast domains. Sales and Engineering can share the same switches and cables, yet never see each other\'s broadcasts. Between switches, a trunk link carries every VLAN, with each frame tagged by a 4-byte 802.1Q header that names its VLAN.',
  keyIdeas: [
    'Broadcast domains, and why big flat networks are a problem',
    'Access ports (one VLAN, untagged) vs trunk ports (many VLANs, tagged)',
    'The 802.1Q tag: TPID 0x8100, priority, VLAN ID (12 bits → 4094 VLANs)',
    'Inter-VLAN traffic must be routed (router-on-a-stick / layer-3 switch)',
    'Native VLAN and VLAN-hopping risks',
  ],
  facts: [
    ['OSI layer', 'Data Link (2)'],
    ['Tag size', '4 bytes, inserted after source MAC'],
    ['VLAN IDs', '1–4094 (0 and 4095 reserved)'],
    ['Priority bits', '3-bit PCP (802.1p QoS)'],
    ['Defined in', 'IEEE 802.1Q'],
  ],
  legend: [{ kind: 'bcast', label: 'Broadcast (VLAN 10)' }, { kind: 'res', label: 'VLAN 20' }, { kind: 'req', label: 'Routed between VLANs' }],
  nodes: {
    sa: { label: 'Sales PC', sub: `${SA.ip}\nVLAN 10`, type: 'laptop', x: 100, y: 150 },
    ea: { label: 'Eng PC', sub: `${EA.ip}\nVLAN 20`, type: 'laptop', x: 100, y: 420 },
    sw1: { label: 'Switch 1', sub: 'access 10 / 20', type: 'switch', x: 340, y: 290 },
    sw2: { label: 'Switch 2', sub: 'trunk', type: 'switch', x: 640, y: 290 },
    rt: { label: 'Router', sub: '.10.1 (VLAN 10) · .20.1 (VLAN 20)', type: 'router', x: 640, y: 70 },
    ss: { label: 'Sales Server', sub: `${SS.ip}\nVLAN 10`, type: 'server', x: 900, y: 170 },
    es: { label: 'Eng Server', sub: `${ES.ip}\nVLAN 20`, type: 'server', x: 900, y: 430 },
  },
  links: [['sa', 'sw1', 'access 10'], ['ea', 'sw1', 'access 20'], ['sw1', 'sw2', '802.1Q trunk'], ['sw2', 'rt', 'trunk'], ['sw2', 'ss', 'access 10'], ['sw2', 'es', 'access 20']],
  seq: ['sa', 'ea', 'rt', 'ss', 'es'],
  steps: [
    {
      title: 'One network, two worlds', sub: 'Ports belong to VLANs',
      text: 'Each access port is assigned to a VLAN: Sales ports to VLAN 10, Engineering ports to VLAN 20. Hosts don\'t know VLANs exist: they send ordinary untagged frames. The switches keep a separate MAC table and a separate broadcast domain per VLAN.',
      deep: [
        'Why bother? Every broadcast (ARP, DHCP, discovery protocols) reaches every host in a broadcast domain. With thousands of hosts that\'s a lot of noise, and any host can sniff or spoof traffic meant for others. VLANs give isolation without buying separate switches.',
        'Each VLAN is normally its own IP subnet too: VLAN 10 = 10.10.10.0/24, VLAN 20 = 10.20.20.0/24.',
      ],
      show: ['sa', 'ea', 'sw1', 'sw2', 'rt', 'ss', 'es'],
      facts: [['VLAN 10 (Sales)', '10.10.10.0/24'], ['VLAN 20 (Eng)', '10.20.20.0/24'], ['Trunk', 'Carries 10 + 20, tagged']],
      packets: [],
    },
    {
      title: 'A broadcast stays home', sub: 'ARP in VLAN 10',
      text: 'The Sales PC broadcasts an ARP. Switch 1 floods it only to VLAN 10 ports and the trunk. On the trunk the frame gains a 4-byte tag saying VLAN 10 (see packet 2). Switch 2 reads the tag, strips it, and floods to VLAN 10 ports only. The Eng PC and Eng Server never see it.',
      show: [],
      facts: [['Reaches', 'Sales Server, router (VLAN 10 side)'], ['Never reaches', 'Eng PC, Eng Server'], ['On trunk', 'tag 0x8100, VID 10']],
      packets: [
        { t: 0, from: 'sa', to: ['ss', 'rt'], label: 'ARP (VLAN 10)', kind: 'bcast', proto: 'ARP', info: `Who has ${SS.ip}? Tell ${SA.ip} (untagged on access port)`, note: 'Flooded within VLAN 10 only', src: SA.mac, dst: 'Broadcast',
          hold: { sw1: 'Switch 1: arrived on an access port in VLAN 10, so it floods only to other VLAN 10 ports and the trunk, adding an 802.1Q tag (VID 10) on the trunk.', sw2: 'Switch 2: reads tag VID 10, removes it, and floods to VLAN 10 ports. VLAN 20 ports get nothing.' },
          frame: frame(ethernet({ src: SA.mac, dst: BC, type: 0x0806, fcs: true }), arp({ op: 1, sha: SA.mac, spa: SA.ip, tha: '00:00:00:00:00:00', tpa: SS.ip })) },
        { t: 0.00001, from: 'sw1', to: 'sw2', label: 'Tagged copy', kind: 'bcast', proto: 'ARP', info: '802.1Q Virtual LAN, PRI: 0, VID: 10 · ARP Who has 10.10.10.50? (captured on trunk)', note: 'Same frame + 4-byte VLAN 10 tag', src: SA.mac, dst: 'Broadcast',
          frame: frame(ethernet({ src: SA.mac, dst: BC, type: 0x0806, fcs: true, vlan: { id: 10 } }), arp({ op: 1, sha: SA.mac, spa: SA.ip, tha: '00:00:00:00:00:00', tpa: SS.ip })) },
      ],
    },
    {
      title: 'Engineering traffic', sub: 'Same cable, different tag',
      text: 'The Eng PC pings the Eng Server. Across the very same trunk cable its frames carry VID 20. Switches use the tag to keep the two VLANs\' traffic and MAC tables completely separate, even if two hosts in different VLANs had the same MAC address.',
      show: [],
      facts: [['On trunk', 'VID 20'], ['Priority', 'PCP 5 (voice/video class)']],
      packets: [
        { t: 1, from: 'ea', to: 'es', label: 'Ping (VLAN 20)', kind: 'res', proto: 'ICMP', info: `802.1Q VID: 20 · Echo request ${EA.ip} → ${ES.ip} (trunk capture)`, note: 'Tagged VID 20 on the trunk',
          frame: frame(ethernet({ src: EA.mac, dst: ES.mac, vlan: { id: 20, pcp: 5 }, fcs: true }), ipv4({ src: EA.ip, dst: ES.ip, proto: 1, ttl: 128, df: false }), icmp({ type: 8, id: 3, seq: 1 })) },
      ],
    },
    {
      title: 'Crossing VLANs', sub: 'Must go through a router',
      text: 'The Sales PC wants the Eng Server (a different subnet). Layer 2 can\'t cross VLANs, so the PC sends the packet to its gateway 10.10.10.1: the router\'s VLAN 10 sub-interface on the trunk. The router routes it and sends it back down the same trunk tagged VLAN 20. That\'s "router on a stick". The router is also the place to apply access rules between departments.',
      deep: [
        'In real networks a layer-3 switch usually does this routing in hardware with "SVIs" (switch virtual interfaces), far faster than a separate router.',
        'Notice in the inspector: the tag changes from 10 to 20, MAC addresses change (router\'s MAC), and TTL drops by one. Routing happened.',
      ],
      show: [],
      facts: [['Gateway', '10.10.10.1 (sub-if Gi0/1.10)'], ['Out via', '10.20.20.1 (sub-if Gi0/1.20)'], ['Tag', '10 → 20']],
      packets: [
        { t: 2, from: 'sa', to: 'rt', label: 'To gateway', kind: 'req', proto: 'ICMP', info: `802.1Q VID: 10 · Echo request ${SA.ip} → ${ES.ip} (to router MAC)`, note: 'Tagged 10, addressed to the router\'s MAC',
          frame: frame(ethernet({ src: SA.mac, dst: RT.mac, vlan: { id: 10 }, dstNote: 'The router: the destination is in another subnet/VLAN.' }), ipv4({ src: SA.ip, dst: ES.ip, proto: 1, ttl: 128, df: false }), icmp({ type: 8, id: 4, seq: 1 })) },
        { t: 2.0002, from: 'rt', to: 'es', label: 'Routed', kind: 'req', proto: 'ICMP', info: `802.1Q VID: 20 · Echo request ${SA.ip} → ${ES.ip} (routed, TTL 127)`, note: 'Re-tagged 20, new MACs, TTL −1',
          frame: frame(ethernet({ src: RT.mac, dst: ES.mac, vlan: { id: 20 } }), ipv4({ src: SA.ip, dst: ES.ip, proto: 1, ttl: 127, df: false }), icmp({ type: 8, id: 4, seq: 1 })) },
      ],
    },
    {
      title: 'Trunk hygiene', sub: 'Native VLAN and VLAN hopping',
      text: 'Untagged frames arriving on a trunk belong to the "native VLAN" (VLAN 1 by default). An attacker on that VLAN can craft a frame with two tags: the first switch strips the outer one and forwards the inner-tagged frame into a VLAN the attacker shouldn\'t reach (double-tagging). Best practice: use an unused native VLAN, allow only needed VLANs on trunks, and disable auto-trunking (DTP) on access ports.',
      show: [],
      facts: [['Native VLAN', 'Set to unused (e.g. 999)'], ['Trunk allowed list', 'Only 10, 20'], ['Access ports', 'switchport mode access']],
      packets: [],
    },
  ],
  quiz: [
    { q: 'What does an 802.1Q tag add to a frame?', options: ['A 4-byte header with the VLAN ID', 'A new IP address', 'Encryption'], answer: 0, why: 'TPID 0x8100 + 16-bit TCI (PCP, DEI, 12-bit VID).' },
    { q: 'Can a host in VLAN 10 reach VLAN 20 using only switches?', options: ['Yes, via ARP', 'No, traffic must be routed', 'Only with broadcasts'], answer: 1, why: 'VLANs are separate broadcast domains; a router or L3 switch joins them.' },
    { q: 'Which link carries frames from many VLANs?', options: ['Access link', 'Trunk link', 'Console cable'], answer: 1, why: 'Trunks tag each frame so the receiver knows its VLAN.' },
  ],
};

/* ============================ Layer 2: Wi-Fi ============================ */
const STA = 'f0:9e:4a:33:22:11';
const AP = '00:1d:7e:aa:bb:01';
const GW = '00:1e:58:a1:00:01';
const ie = (id, bytes) => [id, bytes.length, ...bytes];
const mgmt = (name, sub, a1, a2, body, summary) => custom({ name, osi: 2, summary, fields: [
  ['Frame control', [sub, 0x00], name, 'Type = management, plus subtype (beacon, association…).'],
  ['Duration', [0, 0], '0', 'Time the medium will be reserved.'],
  ['Address 1 (receiver)', mac(a1), a1, a1 === 'ff:ff:ff:ff:ff:ff' ? 'Broadcast: every station in range.' : 'The station this frame is for.'],
  ['Address 2 (transmitter)', mac(a2), a2, 'Who sent it.'],
  ['Address 3 (BSSID)', mac(AP), AP, 'Identifies the access point\'s network cell.'],
  ['Sequence control', [0x10, 0x5a], '0x5a10', 'Used to discard retransmitted duplicates.', { eg: true }],
  ...body,
] });
const eapol = (n, desc, extra) => custom({ name: `EAPOL key (message ${n} of 4)`, osi: 2, summary: `4-way handshake ${n}/4`, fields: [
  ['802.1X header', [0x02, 0x03, 0x00, 0x75], 'EAPOL-Key', 'Authentication messages carried directly over Layer 2 (EtherType 0x888E).'],
  ['Key info', [0x01, n === 1 ? 0x8a : n === 2 ? 0x0a : n === 3 ? 0xca : 0x0a], `message ${n}`, desc],
  ...extra,
] });

export const wifiLesson = {
  id: 'wifi',
  layer: 2,
  name: 'Wi-Fi (802.11)',
  full: 'Wireless LAN: join, secure, send',
  tag: 'Beacons, association, WPA 4-way handshake, ACKs',
  summary:
    'Wi-Fi is a data-link layer for radio. Because the air is shared and unreliable, 802.11 does much more than Ethernet: access points advertise networks with beacons, stations must associate before talking, WPA2/WPA3 derive fresh encryption keys in a 4-way handshake, and every unicast frame is acknowledged and retransmitted if lost.',
  keyIdeas: [
    'Beacons, SSIDs and BSSIDs',
    'Authentication + association before any data flows',
    'The WPA2/WPA3 4-way handshake: ANonce, SNonce, PTK, GTK, MIC',
    'CSMA/CA and link-layer ACKs (unlike Ethernet!)',
    'Three addresses in a data frame, and how the AP bridges to Ethernet',
  ],
  facts: [
    ['OSI layer', 'Data Link (2) + Physical (1) radio'],
    ['Bands', '2.4 / 5 / 6 GHz'],
    ['Medium access', 'CSMA/CA (collision avoidance)'],
    ['Security', 'WPA2 (CCMP) / WPA3 (SAE)'],
    ['Defined in', 'IEEE 802.11-2020, 802.11ax (Wi-Fi 6)'],
  ],
  legend: [{ kind: 'bcast', label: 'Management' }, { kind: 'hs', label: 'Key handshake' }, { kind: 'req', label: 'Data' }, { kind: 'res', label: 'ACK / bridged' }],
  nodes: {
    sta: { label: 'Laptop', sub: `192.168.1.23\n${STA}`, type: 'laptop', x: 130, y: 380 },
    ap: { label: 'Access Point', sub: `SSID "CafeNet"\n${AP}`, type: 'ap', x: 480, y: 260 },
    router: { label: 'Router', sub: '192.168.1.1', type: 'router', x: 840, y: 330 },
  },
  links: [['sta', 'ap', '5 GHz radio'], ['ap', 'router', 'Ethernet']],
  seq: ['sta', 'ap', 'router'],
  steps: [
    {
      title: 'Beacons', sub: '"CafeNet is here"',
      text: 'About ten times per second (every 102.4 ms) the access point broadcasts a beacon: its network name (SSID), supported rates, channel and security (WPA2/WPA3). Your laptop builds its list of available networks from beacons it hears, or by actively sending probe requests.',
      deep: ['The BSSID is the AP radio\'s MAC address. A large venue has many APs with the same SSID but different BSSIDs, and your device roams between them based on signal strength.'],
      show: ['sta', 'ap', 'router'],
      facts: [['SSID', 'CafeNet'], ['Interval', '102.4 ms'], ['Security', 'WPA2-PSK (CCMP-AES)']],
      packets: [
        { t: 0, from: 'ap', to: 'sta', label: 'Beacon', kind: 'bcast', proto: '802.11', info: 'Beacon frame, SSID="CafeNet", BI=100', note: 'Network advertisement', src: AP, dst: 'Broadcast',
          frame: frame(mgmt('Beacon', 0x80, BC, AP, [
            ['Timestamp', opaqueBytes(8, 91), '8 bytes', 'AP\'s clock, so stations can synchronise.', { opaque: true }],
            ['Beacon interval', [0x64, 0x00], '100 TU (102.4 ms)', 'How often beacons are sent.'],
            ['Capabilities', [0x11, 0x04], 'ESS, Privacy', 'An infrastructure network that requires encryption.'],
            ['SSID element', ie(0, asciiB('CafeNet')), '"CafeNet"', 'The network name shown in your Wi-Fi list.'],
            ['Rates element', ie(1, [0x8c, 0x12, 0x98, 0x24, 0xb0, 0x48, 0x60, 0x6c]), '6–54 Mb/s', 'Basic data rates supported.'],
            ['RSN element', ie(48, [1, 0, 0, 0x0f, 0xac, 4, 1, 0, 0, 0x0f, 0xac, 4, 1, 0, 0, 0x0f, 0xac, 2, 0, 0]), 'WPA2: CCMP, PSK', 'Robust Security Network: which ciphers and key management are required.'],
          ], 'SSID CafeNet')) },
      ],
    },
    {
      title: 'Join the network', sub: 'Authentication & association',
      text: 'The laptop sends an Association Request: "I\'d like to join CafeNet, here are my capabilities". (A trivial open-system Authentication exchange happens just before; it\'s a legacy step.) The AP replies with an Association ID. The laptop is now a member of the cell, but can\'t send data yet: there are no keys.',
      show: [],
      facts: [['Association ID', '1'], ['Data allowed?', 'Not until keys exist']],
      packets: [
        { t: 0.2, from: 'sta', to: 'ap', label: 'Assoc req', kind: 'bcast', proto: '802.11', info: 'Association Request, SSID="CafeNet"', note: 'May I join?', src: STA, dst: AP,
          frame: frame(mgmt('Association request', 0x00, AP, STA, [['Capabilities', [0x11, 0x04], 'ESS, Privacy', 'What the station supports.'], ['Listen interval', [0x0a, 0x00], '10', 'How often a sleeping station wakes to check for buffered frames.'], ['SSID element', ie(0, asciiB('CafeNet')), '"CafeNet"', 'Network being joined.']], 'Join CafeNet')) },
        { t: 0.202, from: 'ap', to: 'sta', label: 'Assoc resp', kind: 'bcast', proto: '802.11', info: 'Association Response, Status=Successful, AID=1', note: 'Welcome, you are AID 1', src: AP, dst: STA,
          frame: frame(mgmt('Association response', 0x10, STA, AP, [['Capabilities', [0x11, 0x04], 'ESS, Privacy', 'Echoed capabilities.'], ['Status code', [0, 0], '0 (Successful)', 'Association accepted.'], ['Association ID', [0x01, 0xc0], '1', 'This station\'s ID within the cell.']], 'AID 1')) },
      ],
    },
    {
      title: 'Make fresh keys', sub: 'WPA2 4-way handshake',
      text: 'Both sides know the Wi-Fi password (turned into a Pairwise Master Key), but it\'s never sent. Instead the AP sends a random ANonce and the laptop a random SNonce. Each mixes PMK + both nonces + both MACs into a session key (PTK). The MIC in messages 2–4 proves each side derived the same key. Message 3 also delivers the group key for broadcasts.',
      deep: [
        'Because the nonces are new each time, every session gets fresh keys even with the same password.',
        'WPA2-Personal weakness: anyone who captures the handshake can try passwords offline. WPA3-Personal replaces this with SAE (Dragonfly), which resists offline guessing and gives forward secrecy.',
        'KRACK (2017) attacked message 3 retransmissions to force nonce reuse. It was fixed by patches, and it\'s a reminder of how subtle Layer 2 security is.',
      ],
      show: [],
      facts: [['PMK', 'from passphrase + SSID (PBKDF2)'], ['PTK', 'PMK + ANonce + SNonce + MACs'], ['GTK', 'group key for broadcasts']],
      packets: [
        { t: 0.21, from: 'ap', to: 'sta', label: 'M1 ANonce', kind: 'hs', proto: 'EAPOL', info: 'Key (Message 1 of 4)', note: 'AP random number', frame: frame(wifi({ addr1: STA, addr2: AP, addr3: AP, toDS: false, etype: 0x888e }), eapol(1, 'Carries the AP\'s random ANonce.', [['ANonce', opaqueBytes(32, 92), '32 bytes', 'Random number from the AP.', { opaque: true }]])) },
        { t: 0.212, from: 'sta', to: 'ap', label: 'M2 SNonce', kind: 'hs', proto: 'EAPOL', info: 'Key (Message 2 of 4)', note: 'Laptop random number + MIC', frame: frame(wifi({ addr1: AP, addr2: STA, addr3: AP, etype: 0x888e }), eapol(2, 'Carries the SNonce and a MIC computed with the new PTK.', [['SNonce', opaqueBytes(32, 93), '32 bytes', 'Random number from the laptop.', { opaque: true }], ['MIC', opaqueBytes(16, 94), '16 bytes', 'Proves the laptop knows the password-derived key.', { opaque: true }]])) },
        { t: 0.214, from: 'ap', to: 'sta', label: 'M3 GTK', kind: 'hs', proto: 'EAPOL', info: 'Key (Message 3 of 4)', note: 'Install keys + encrypted group key', frame: frame(wifi({ addr1: STA, addr2: AP, addr3: AP, toDS: false, etype: 0x888e }), eapol(3, 'Tells the laptop to install the PTK and delivers the encrypted GTK.', [['MIC', opaqueBytes(16, 95), '16 bytes', 'AP proves it derived the same PTK.', { opaque: true }], ['Encrypted GTK', opaqueBytes(56, 96), '56 bytes', 'Group key for broadcast/multicast, encrypted with the PTK.', { opaque: true }]])) },
        { t: 0.216, from: 'sta', to: 'ap', label: 'M4', kind: 'hs', proto: 'EAPOL', info: 'Key (Message 4 of 4)', note: 'Keys installed: encryption on', frame: frame(wifi({ addr1: AP, addr2: STA, addr3: AP, etype: 0x888e }), eapol(4, 'Confirms the keys are installed.', [['MIC', opaqueBytes(16, 97), '16 bytes', 'Final confirmation.', { opaque: true }]])) },
      ],
    },
    {
      title: 'Send data, get an ACK', sub: 'CSMA/CA + link-layer acknowledgement',
      text: 'To send, the laptop listens first; if the channel is idle it waits a short random backoff, then transmits (collision avoidance, since radios can\'t detect collisions while transmitting). The data frame uses three addresses: AP (receiver), laptop (transmitter), router (final destination). The AP immediately replies with a tiny ACK. If no ACK arrives, the laptop retransmits.',
      deep: [
        'Ethernet has no ACKs; Wi-Fi does, because radio loss is common (interference, distance, microwave ovens). Retries hide most loss from TCP.',
        'Hidden-node problem: two laptops that can\'t hear each other but both reach the AP may collide. RTS/CTS (request/clear to send) reserves the channel for them.',
      ],
      show: [],
      facts: [['Address 1', `AP ${AP}`], ['Address 2', `Laptop ${STA}`], ['Address 3', `Router ${GW}`], ['ACK delay', 'SIFS = 16 µs']],
      packets: [
        { t: 1, from: 'sta', to: 'ap', label: 'Data', kind: 'req', proto: '802.11', info: 'QoS Data, ToDS: 192.168.1.23 → 8.8.8.8 UDP 53 (CCMP encrypted)', note: 'Encrypted frame for the router, via the AP',
          frame: frame(wifi({ addr1: AP, addr2: STA, addr3: GW }), custom({ name: 'CCMP header', osi: 2, summary: 'WPA2 encryption', fields: [['CCMP header', [0x01, 0x00, 0x00, 0x20, 0, 0, 0, 0], 'PN 1', 'Packet number: a counter that prevents replays.']] }), custom({ name: 'Encrypted IP packet', osi: 3, summary: 'ciphertext', fields: [['Encrypted payload', opaqueBytes(72, 98), '72 bytes', 'The IP packet, encrypted with the PTK (AES-CCMP).', { opaque: true }], ['MIC', opaqueBytes(8, 99), '8 bytes', 'Integrity check: tampered frames are rejected.', { opaque: true }]] })) },
        { t: 1.000016, from: 'ap', to: 'sta', label: 'ACK', kind: 'res', proto: '802.11', info: 'Acknowledgement, RA=' + STA, note: 'Got it (after 16 µs)', src: AP, dst: STA,
          frame: frame(custom({ name: '802.11 ACK', osi: 2, summary: 'control frame', fields: [['Frame control', [0xd4, 0x00], 'ACK', 'Control frame: acknowledgement.'], ['Duration', [0, 0], '0', 'Nothing more reserved.'], ['Receiver address', mac(STA), STA, 'Only one address: whoever sent the data.']] })) },
      ],
    },
    {
      title: 'Bridged onto Ethernet', sub: 'The AP converts frames',
      text: 'The AP decrypts the frame, removes the 802.11 header and builds a normal Ethernet II frame: destination = router (from Address 3), source = laptop. The router never knows the packet arrived over radio. Layer 3 and above are identical whether you\'re wired or wireless.',
      show: [],
      facts: [['In', '802.11 data (3 addresses, encrypted)'], ['Out', 'Ethernet II (2 addresses, plain)'], ['Unchanged', 'The IP packet']],
      packets: [
        { t: 1.0001, from: 'ap', to: 'router', label: 'Ethernet', kind: 'res', proto: 'DNS', info: 'Standard query A example.com (bridged from Wi-Fi)', note: 'Same IP packet, now in an Ethernet frame',
          frame: frame(ethernet({ src: STA, dst: GW, srcNote: 'Still the laptop\'s MAC: the AP is a transparent bridge.', dstNote: 'The router, taken from 802.11 Address 3.' }), ipv4({ src: '192.168.1.23', dst: '8.8.8.8', proto: 17, df: false }), udp({ sport: 53111, dport: 53 }), custom({ name: 'DNS query', osi: 7, summary: 'A? example.com', fields: [['DNS message', opaqueBytes(29, 100), '29 bytes', 'An ordinary DNS question.', { opaque: true }]] })) },
      ],
    },
  ],
  quiz: [
    { q: 'Why does Wi-Fi acknowledge every unicast frame when Ethernet doesn\'t?', options: ['Radio links lose frames far more often', 'To encrypt data', 'Because of IP'], answer: 0, why: 'Interference and fading are common; link-layer retries hide them.' },
    { q: 'What is sent over the air in the 4-way handshake?', options: ['The Wi-Fi password', 'Random nonces and MICs, never the password', 'The router\'s IP'], answer: 1, why: 'Both sides derive the PTK from the PMK plus exchanged nonces.' },
    { q: 'What does an AP do with a Wi-Fi data frame destined for the router?', options: ['Routes it with a new IP', 'Bridges it into an Ethernet frame', 'Drops it'], answer: 1, why: 'APs are layer-2 bridges between 802.11 and 802.3.' },
  ],
};

/* ============================ Layer 1: Hub & collisions ============================ */
const HA = 'a4:5e:60:00:01:0a';
const HB = 'a4:5e:60:00:01:0b';
const HC = 'a4:5e:60:00:01:0c';
const f = (src, dst, seed) => frame(physical(), ethernet({ src, dst, fcs: true }), ipv4({ src: src === HA ? '192.168.0.10' : '192.168.0.11', dst: '192.168.0.12', proto: 17, df: false }), udp({ sport: 5000, dport: 5000 }), custom({ name: 'Data', osi: 7, summary: '20 bytes', fields: [['Data', opaqueBytes(20, seed), '20 bytes', 'Application data.', { opaque: true }]] }));
const jam = custom({ name: 'Jam signal', osi: 1, summary: '32 bits', fields: [['Jam', [0xaa, 0xaa, 0xaa, 0xaa], '32-bit pattern', 'Guarantees every station notices the collision, even ones far away.']] });

export const hubLesson = {
  id: 'hub',
  layer: 1,
  name: 'Hubs & Collisions',
  full: 'Shared media and CSMA/CD',
  tag: 'Repeaters, collisions, jam, backoff',
  summary:
    'A hub is a Layer-1 device: it doesn\'t understand frames or addresses, it just regenerates the electrical signal and repeats it out of every port. All hosts share one collision domain, so if two transmit at once, their signals overlap and both are destroyed. Classic Ethernet handled this with CSMA/CD: listen before sending, detect collisions, jam, back off randomly and retry.',
  keyIdeas: [
    'Hubs and repeaters work purely with signals (Layer 1)',
    'Collision domains vs broadcast domains',
    'Carrier sense, collision detection and the jam signal',
    'Binary exponential backoff (slot time 51.2 µs at 10 Mb/s)',
    'Why switches + full duplex made collisions history (and the 64-byte minimum frame)',
  ],
  facts: [
    ['OSI layer', 'Physical (1)'],
    ['Standard', '10BASE-T half duplex'],
    ['Slot time', '512 bit-times = 51.2 µs @10 Mb/s'],
    ['Max retries', '16, then give up'],
    ['Defined in', 'IEEE 802.3 clause 4 (CSMA/CD)'],
  ],
  legend: [{ kind: 'phy', label: 'Signal' }, { kind: 'err', label: 'Collision / jam' }],
  nodes: {
    a: { label: 'Host A', sub: HA, type: 'laptop', x: 120, y: 150 },
    b: { label: 'Host B', sub: HB, type: 'laptop', x: 120, y: 430 },
    hub: { label: 'Hub', sub: '10 Mb/s, half duplex', type: 'hub', x: 470, y: 290 },
    c: { label: 'Host C', sub: HC, type: 'server', x: 860, y: 290 },
  },
  links: [['a', 'hub'], ['b', 'hub'], ['hub', 'c']],
  seq: ['a', 'b', 'hub', 'c'],
  steps: [
    {
      title: 'Everyone hears everything', sub: 'A hub repeats signals',
      text: 'A sends a frame to C. The hub has no MAC table: it simply repeats the bits out of every other port as they arrive. B receives the whole frame too, checks the destination MAC, and discards it. Privacy and bandwidth are shared by all.',
      deep: ['Any host on a hub can run Wireshark in promiscuous mode and capture everyone\'s traffic. Switches fixed that (mostly).'],
      show: ['a', 'b', 'hub', 'c'],
      facts: [['Collision domain', 'All 3 hosts'], ['Bandwidth', '10 Mb/s shared'], ['Duplex', 'Half (send OR receive)']],
      packets: [
        { t: 0, from: 'a', to: ['b', 'c'], label: 'Frame → C', kind: 'phy', proto: 'Ethernet', info: `${HA} → ${HC} (repeated to all ports)`, note: 'C keeps it, B discards it', src: HA, dst: HC, frame: f(HA, HC, 1) },
      ],
    },
    {
      title: 'Collision!', sub: 'Two talkers at once',
      text: 'A and B both have frames for C. Each listened, heard silence and started transmitting within a few microseconds of each other, before either signal had reached the other. At the hub the voltages add together into garbage. Both frames are destroyed.',
      deep: [
        'Signals take time to travel. A collision is possible whenever a second station starts transmitting before the first station\'s signal reaches it.',
        'That\'s why Ethernet frames must be at least 64 bytes: a sender must still be transmitting when news of a collision comes back from the far end of the longest allowed cable (one slot time), otherwise it wouldn\'t know its frame was lost.',
      ],
      show: [],
      facts: [['A sends at', 't = 0 µs'], ['B sends at', 't = 3 µs'], ['Result', 'Both frames corrupted']],
      packets: [
        { t: 1, from: 'a', to: 'c', label: 'A → C', kind: 'err', proto: 'Ethernet', info: `${HA} → ${HC} [collision]`, note: 'Destroyed in a collision', lost: true, lostAt: 0.42, src: HA, dst: HC, lostWhy: 'Collision at the hub: A\'s and B\'s signals overlap, and the sum is meaningless voltage.', frame: f(HA, HC, 2) },
        { t: 1.000003, from: 'b', to: 'c', label: 'B → C', kind: 'err', proto: 'Ethernet', info: `${HB} → ${HC} [collision]`, note: 'Destroyed in a collision', lost: true, lostAt: 0.42, src: HB, dst: HC, lostWhy: 'Collision: B also detects the voltage clash while transmitting and stops.', frame: f(HB, HC, 3) },
      ],
    },
    {
      title: 'Jam!', sub: 'Make sure everyone knows',
      text: 'While transmitting, each station monitors the line. Seeing a signal that isn\'t its own, it stops and sends a 32-bit jam signal so every station on the segment recognises the collision and discards the fragments.',
      show: [],
      facts: [['Jam', '32 bits'], ['Detected by', 'Voltage above expected level'], ['Fragments', '"Runts" < 64 B, discarded']],
      packets: [
        { t: 1.00001, from: 'a', to: ['b', 'c'], label: 'JAM', kind: 'err', proto: 'PHY', info: 'Jam signal (32 bits)', note: 'Collision! Everyone discard', src: HA, dst: 'All ports', frame: frame(jam) },
      ],
    },
    {
      title: 'Random backoff', sub: 'Binary exponential backoff',
      text: 'After the n-th collision each station waits a random number of slot times between 0 and 2ⁿ − 1. On this first collision A picks 0 and B picks 1. A retransmits immediately and succeeds. B waits 51.2 µs, senses the line is busy with A\'s frame (carrier sense), defers, and sends right after. Collisions get rarer as the random range doubles.',
      deep: ['After 10 collisions the range stops growing (0–1023 slots); after 16 failed attempts the frame is dropped and an error reported. Under heavy load a hub network\'s real throughput can collapse well below 10 Mb/s.'],
      show: [],
      facts: [['A', 'k = 0 → send now'], ['B', 'k = 1 → wait 51.2 µs, then defer'], ['Next collision range', '0–3 slots']],
      packets: [
        { t: 1.0001, from: 'a', to: ['b', 'c'], label: 'A retry', kind: 'phy', proto: 'Ethernet', info: `${HA} → ${HC} (retransmission, backoff 0)`, note: 'Success', src: HA, dst: HC, frame: f(HA, HC, 2) },
        { t: 1.00017, from: 'b', to: ['a', 'c'], label: 'B retry', kind: 'phy', proto: 'Ethernet', info: `${HB} → ${HC} (retransmission, backoff 1 slot)`, note: 'Success', src: HB, dst: HC, frame: f(HB, HC, 3) },
      ],
    },
    {
      title: 'Why you\'ve never seen this', sub: 'Switches and full duplex',
      text: 'A switch gives every port its own collision domain, and with full duplex (separate transmit and receive pairs) a link can\'t collide at all. Modern Ethernet (1G, 10G and up) doesn\'t even support half duplex. CSMA/CD lives on as theory, but its ideas (listen first, random backoff) live on in Wi-Fi\'s CSMA/CA.',
      deep: ['A classic misconfiguration, a duplex mismatch (one side full, the other half), still causes "late collisions" and terrible performance on old gear. Check with `ethtool eth0` or `Get-NetAdapter | fl *Duplex*`.'],
      show: [],
      facts: [['Hub', '1 collision domain, shared'], ['Switch', '1 collision domain per port'], ['Full duplex', 'No collisions possible']],
      packets: [],
    },
  ],
  quiz: [
    { q: 'What does a hub do with an incoming signal?', options: ['Looks up the MAC and forwards it', 'Repeats it out of every other port', 'Routes it by IP'], answer: 1, why: 'Hubs are multi-port repeaters: pure Layer 1.' },
    { q: 'After its first collision, a station waits…', options: ['A fixed 1 ms', '0 or 1 slot times, chosen randomly', 'Until the hub tells it'], answer: 1, why: 'Binary exponential backoff: random 0..2ⁿ−1 slots.' },
    { q: 'Why must Ethernet frames be at least 64 bytes?', options: ['For the checksum', 'So a sender is still transmitting when a collision reaches it', 'For encryption'], answer: 1, why: 'Otherwise it couldn\'t detect that its frame collided.' },
  ],
};

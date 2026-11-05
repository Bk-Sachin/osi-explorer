export const LAYERS = {
  7: {
    n: 7, name: 'Application', short: 'APP', pdu: 'Data', color: 'var(--l7)',
    job: 'Gives programs a way to use the network: the "language" two applications speak.',
    examples: 'HTTP, DNS, SMTP, FTP, SSH, DHCP',
    devices: 'Browsers, servers, resolvers',
    analogy: 'The letter you write, in a language the reader understands.',
  },
  6: {
    n: 6, name: 'Presentation', short: 'PRES', pdu: 'Data', color: 'var(--l6)',
    job: 'Makes sure both sides read the data the same way: character encoding, compression, encryption.',
    examples: 'UTF-8, JSON, gzip, JPEG, TLS encryption',
    devices: 'Libraries inside the app / OS',
    analogy: 'Translating the letter, shrinking it, and sealing it in a locked box.',
  },
  5: {
    n: 5, name: 'Session', short: 'SESS', pdu: 'Data', color: 'var(--l5)',
    job: 'Opens, keeps and closes a conversation; remembers who you are; resumes after interruptions.',
    examples: 'TLS handshakes & resumption, RPC, NetBIOS, session cookies',
    devices: 'Libraries inside the app / OS',
    analogy: 'Dialling, saying "it\'s me again", and hanging up at the end of the call.',
  },
  4: {
    n: 4, name: 'Transport', short: 'TRANS', pdu: 'Segment', color: 'var(--l4)',
    job: 'Delivers data between the right programs (ports), reliably and in order (TCP) or fast (UDP).',
    examples: 'TCP, UDP, QUIC',
    devices: 'Host operating systems, firewalls',
    analogy: 'Numbering the pages so the reader can put them back in order and ask for missing ones.',
  },
  3: {
    n: 3, name: 'Network', short: 'NET', pdu: 'Packet', color: 'var(--l3)',
    job: 'Gives every host a global address and finds a path across many networks (routing).',
    examples: 'IPv4, IPv6, ICMP, OSPF, BGP',
    devices: 'Routers, layer-3 switches',
    analogy: 'The postal address and the chain of sorting offices between cities.',
  },
  2: {
    n: 2, name: 'Data Link', short: 'LINK', pdu: 'Frame', color: 'var(--l2)',
    job: 'Moves frames between neighbours on the same link, using MAC addresses, and detects corruption.',
    examples: 'Ethernet, Wi-Fi (802.11), ARP, VLANs (802.1Q)',
    devices: 'Switches, bridges, access points, NICs',
    analogy: 'The local courier who carries the envelope from one sorting office to the next.',
  },
  1: {
    n: 1, name: 'Physical', short: 'PHY', pdu: 'Bits', color: 'var(--l1)',
    job: 'Turns bits into signals (voltage, light, radio) and back: cables, connectors, timing.',
    examples: '1000BASE-T, fiber optics, 802.11 radio, USB, Bluetooth PHY',
    devices: 'Cables, hubs, repeaters, transceivers',
    analogy: 'The road, the truck and its engine.',
  },
};

export const LAYER_ORDER = [7, 6, 5, 4, 3, 2, 1];

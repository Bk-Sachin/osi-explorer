// Device icons, drawn centered on (0,0), roughly 110 × 90.
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' };

export function DeviceIcon({ type }) {
  switch (type) {
    case 'laptop':
      return (
        <g className="icon" {...S}>
          <path className="fill" d="M-38 -42 L30 -42 L30 8 L-38 8 Z" />
          <path d="M-32 -36 L24 -36 L24 2 L-32 2 Z" opacity=".55" />
          <path d="M-30 -30 h30 M-30 -24 h44 M-30 -18 h20" opacity=".5" />
          <path className="fill" d="M-38 8 L30 8 L48 26 L-26 26 Z" />
          <path d="M-28 13 h52 M-24 18 h52" opacity=".5" />
        </g>
      );
    case 'phone':
      return (
        <g className="icon" {...S}>
          <rect className="fill" x="-20" y="-44" width="40" height="72" rx="7" />
          <rect x="-14" y="-36" width="28" height="52" rx="2" opacity=".55" />
          <path d="M-5 22 h10" />
        </g>
      );
    case 'router':
      return (
        <g className="icon" {...S}>
          <path d="M18 -26 L18 -52" /><circle cx="18" cy="-54" r="2.5" />
          <path className="fill" d="M-44 -18 L0 -34 L44 -18 L0 -2 Z" />
          <path className="fill" d="M-44 -18 L-44 4 L0 20 L0 -2 Z" />
          <path className="fill" d="M44 -18 L44 4 L0 20 L0 -2 Z" />
          <path d="M-36 -10 l6 2 M-26 -6 l6 2" opacity=".8" />
          <path d="M8 4 L36 -6" opacity=".6" />
          <path d="M-12 -22 l6 -2 M-2 -26 l6 -2 M8 -22 l6 -2" opacity=".8" />
        </g>
      );
    case 'switch':
      return (
        <g className="icon" {...S}>
          <path className="fill" d="M-52 -12 L-6 -28 L52 -12 L6 4 Z" />
          <path className="fill" d="M-52 -12 L-52 2 L6 18 L6 4 Z" />
          <path className="fill" d="M52 -12 L52 2 L6 18 L6 4 Z" />
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={-46 + i * 8} y={-6 + i * 2.2} width="5" height="5" opacity=".8" />)}
          <path d="M-20 -14 L20 -14 M14 -18 L20 -14 L14 -10 M-14 -18 L-20 -14 L-14 -10" opacity=".7" />
        </g>
      );
    case 'ap':
      return (
        <g className="icon" {...S}>
          <path d="M-14 -40 a20 20 0 0 1 28 0 M-22 -48 a32 32 0 0 1 44 0 M-6 -32 a8 8 0 0 1 12 0" opacity=".85" />
          <path className="fill" d="M-36 -10 L0 -22 L36 -10 L0 2 Z" />
          <path className="fill" d="M-36 -10 L-36 0 L0 12 L0 2 Z" />
          <path className="fill" d="M36 -10 L36 0 L0 12 L0 2 Z" />
          <circle cx="0" cy="-10" r="2.5" fill="currentColor" />
        </g>
      );
    case 'hub':
      return (
        <g className="icon" {...S}>
          <path className="fill" d="M-46 -10 L-4 -24 L46 -10 L4 4 Z" />
          <path className="fill" d="M-46 -10 L-46 2 L4 16 L4 4 Z" />
          <path className="fill" d="M46 -10 L46 2 L4 16 L4 4 Z" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={-40 + i * 10} y={-4 + i * 2.8} width="5" height="5" opacity=".8" />)}
          <text x="2" y="-8" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none" fontFamily="var(--mono)">HUB</text>
        </g>
      );
    case 'server':
    case 'dns':
      return (
        <g className="icon" {...S}>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0 ${-34 + i * 20})`}>
              <path className="fill" d="M-30 -8 L0 -18 L30 -8 L0 2 Z" />
              <path className="fill" d="M-30 -8 L-30 4 L0 14 L0 2 Z" />
              <path className="fill" d="M30 -8 L30 4 L0 14 L0 2 Z" />
              <path d="M6 7 L24 1" opacity=".6" />
              <circle cx="-22" cy="-1" r="1.6" fill="currentColor" />
            </g>
          ))}
          {type === 'dns' && <text x="0" y="-48" textAnchor="middle" fontSize="11" fill="currentColor" stroke="none" fontFamily="var(--mono)">DNS</text>}
        </g>
      );
    case 'cloud':
      return (
        <g className="icon" {...S}>
          <path className="fill" d="M-44 18 C-62 18 -62 -10 -42 -10 C-42 -32 -12 -38 -2 -22 C6 -40 40 -36 38 -10 C60 -10 60 18 40 18 Z" />
          <circle cx="0" cy="-2" r="12" opacity=".8" />
          <path d="M-12 -2 h24 M0 -14 c-6 8 -6 16 0 24 M0 -14 c6 8 6 16 0 24" opacity=".8" />
        </g>
      );
    default:
      return <circle className="icon fill" r="24" {...S} />;
  }
}

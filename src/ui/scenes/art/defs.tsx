/**
 * Shared paint: gradients, patterns, filters. Every scene draws into a
 * 100×60 box with a one-point perspective whose vanishing point is VP.
 */
export const VP = { x: 50, y: 24 } as const;
/** The back wall of every interior room. */
export const BACK = { x0: 18, x1: 82, y0: 8, y1: 40 } as const;

export const PALETTE = {
  ink: '#2b2116',
  gold: '#c9a24a',
  goldDeep: '#8f6a1e',
  oak: '#7a4a22',
  oakLight: '#a8713a',
  oakDark: '#3f2410',
  walnut: '#4a2c17',
  cream: '#efe6d0',
  plaster: '#d9c9a8',
  red: '#7a1f1f',
  candle: '#f5c542',
} as const;

export function Defs({ skyTop, skyBottom }: { skyTop: string; skyBottom: string }) {
  return (
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={skyTop} />
        <stop offset="1" stopColor={skyBottom} />
      </linearGradient>
      <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8a4f24" />
        <stop offset="0.45" stopColor="#6a3818" />
        <stop offset="1" stopColor="#3a1c0a" />
      </linearGradient>
      <linearGradient id="woodTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#b8763c" />
        <stop offset="0.5" stopColor="#9a5c2a" />
        <stop offset="1" stopColor="#6e3b17" />
      </linearGradient>
      <linearGradient id="woodSide" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#2e150a" />
        <stop offset="1" stopColor="#4d2711" />
      </linearGradient>
      <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f0d47a" />
        <stop offset="0.5" stopColor="#c9a24a" />
        <stop offset="1" stopColor="#7a5a14" />
      </linearGradient>
      <linearGradient id="marble" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f4efe3" />
        <stop offset="0.4" stopColor="#dcd3c2" />
        <stop offset="0.6" stopColor="#efe9dc" />
        <stop offset="1" stopColor="#c9beaa" />
      </linearGradient>
      <linearGradient id="leather" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8a2a22" />
        <stop offset="1" stopColor="#4a120e" />
      </linearGradient>
      <linearGradient id="wallShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.32" />
        <stop offset="0.35" stopColor="#000" stopOpacity="0.02" />
        <stop offset="1" stopColor="#000" stopOpacity="0.18" />
      </linearGradient>
      <linearGradient id="sideLeft" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.45" />
        <stop offset="1" stopColor="#000" stopOpacity="0.08" />
      </linearGradient>
      <linearGradient id="sideRight" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.08" />
        <stop offset="1" stopColor="#000" stopOpacity="0.45" />
      </linearGradient>
      <linearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.35" />
        <stop offset="0.5" stopColor="#000" stopOpacity="0.05" />
        <stop offset="1" stopColor="#000" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id="ceilShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.5" />
        <stop offset="1" stopColor="#000" stopOpacity="0.1" />
      </linearGradient>
      <linearGradient id="lightShaft" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff3c4" stopOpacity="0.45" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd97a" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffd97a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="lamp" cx="0.5" cy="0.2" r="0.8">
        <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.72">
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#1a0f08" stopOpacity="0.6" />
      </radialGradient>
      <pattern id="damask" width="8" height="10" patternUnits="userSpaceOnUse">
        <rect width="8" height="10" fill="#cdb27a" />
        <path d="M4 0 C6 2 7 3 7 5 C7 7 6 8 4 10 C2 8 1 7 1 5 C1 3 2 2 4 0 Z" fill="#bfa068" />
        <path d="M4 2 C5 3 5.5 4 5.5 5 C5.5 6 5 7 4 8 C3 7 2.5 6 2.5 5 C2.5 4 3 3 4 2 Z" fill="#cdb27a" />
        <circle cx="0" cy="5" r="0.9" fill="#bfa068" />
        <circle cx="8" cy="5" r="0.9" fill="#bfa068" />
      </pattern>
      <pattern id="stripe" width="3" height="3" patternUnits="userSpaceOnUse">
        <rect width="3" height="3" fill="#c9bb9a" />
        <rect width="1.2" height="3" fill="#bfae8a" />
      </pattern>
      <pattern id="rug" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="#7e1f1f" />
        <path d="M2 0.4 L3.6 2 L2 3.6 L0.4 2 Z" fill="#b8892f" opacity="0.6" />
        <circle cx="2" cy="2" r="0.5" fill="#5a1414" />
      </pattern>
      <pattern id="rugBlue" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="#243a5e" />
        <path d="M2 0.4 L3.6 2 L2 3.6 L0.4 2 Z" fill="#b8892f" opacity="0.5" />
      </pattern>
      <pattern id="brick" width="6" height="3" patternUnits="userSpaceOnUse">
        <rect width="6" height="3" fill="#8b4a3a" />
        <rect width="2.8" height="1.3" x="0.1" y="0.1" fill="#a25a46" />
        <rect width="2.8" height="1.3" x="3.1" y="0.1" fill="#9a5240" />
        <rect width="2.8" height="1.3" x="1.6" y="1.6" fill="#9e5642" />
        <rect width="1.3" height="1.3" x="4.6" y="1.6" fill="#a25a46" />
        <rect width="1.3" height="1.3" x="0.1" y="1.6" fill="#94503e" />
      </pattern>
      <pattern id="stone" width="10" height="5" patternUnits="userSpaceOnUse">
        <rect width="10" height="5" fill="#a89c86" />
        <rect width="4.8" height="2.3" x="0.1" y="0.1" fill="#b3a892" />
        <rect width="4.8" height="2.3" x="5.1" y="0.1" fill="#a49880" />
        <rect width="4.8" height="2.3" x="2.6" y="2.6" fill="#aea38c" />
        <rect width="2.3" height="2.3" x="7.6" y="2.6" fill="#a09479" />
        <rect width="2.3" height="2.3" x="0.1" y="2.6" fill="#b0a58e" />
      </pattern>
      <pattern id="block" width="8" height="4" patternUnits="userSpaceOnUse">
        <rect width="8" height="4" fill="#cfc6ae" />
        <rect width="7.7" height="3.7" x="0.15" y="0.15" fill="#d8cfb7" />
      </pattern>
      <pattern id="tiles" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="#e6dfcd" />
        <rect x="4" width="4" height="4" fill="#3b3a3f" />
        <rect y="4" width="4" height="4" fill="#3b3a3f" />
        <rect x="4" y="4" width="4" height="4" fill="#e6dfcd" />
      </pattern>
      <pattern id="lino" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#b9b19a" />
        <rect width="5.7" height="5.7" x="0.15" y="0.15" fill="#c4bca4" />
      </pattern>
      <pattern id="cloth" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect width="2" height="2" fill="#f5f0e2" />
        <rect width="1" height="1" fill="#ece5d3" />
      </pattern>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.9" />
      </filter>
      <filter id="softer" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
        <feColorMatrix type="saturate" values="0" in="n" result="g" />
        <feComponentTransfer in="g" result="t">
          <feFuncA type="linear" slope="0.12" />
        </feComponentTransfer>
        <feBlend in="SourceGraphic" in2="t" mode="multiply" />
      </filter>
    </defs>
  );
}

/** Paper grain and a vignette over the whole scene, drawn last. */
export function Finish() {
  return (
    <g>
      <rect width="100" height="60" fill="url(#vignette)" />
      <rect width="100" height="60" fill="#fff" opacity="0.06" filter="url(#grain)" />
    </g>
  );
}

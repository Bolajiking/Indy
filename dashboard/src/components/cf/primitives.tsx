"use client";

import type { CSSProperties, ReactNode } from "react";

/* ────────────────────────────────────────────────────────────
   Icons — Lucide-style, 2px round stroke
   ──────────────────────────────────────────────────────────── */
type IconProps = {
  size?: number;
  color?: string;
  sw?: number;
  style?: CSSProperties;
};
const ic = (p: IconProps) => ({
  width: p.size ?? 20,
  height: p.size ?? 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: p.color ?? "currentColor",
  strokeWidth: p.sw ?? 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: p.style,
});

export const Icon = {
  clock: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  newchat: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  plus: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  up: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  back: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  chevR: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  check: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  grid: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  help: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01" />
    </svg>
  ),
  bell: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  search: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  ),
  wallet: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M17 14h.01" />
    </svg>
  ),
  briefcase: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  bolt: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </svg>
  ),
  arrowR: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  spark: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z" />
    </svg>
  ),
  copy: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  shield: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M12 3l7 3v6c0 4.4-3 7.5-7 9-4-1.5-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  gear: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.22.65.22 1z" />
    </svg>
  ),
  paperclip: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M21 12.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5" />
    </svg>
  ),
  link2: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
    </svg>
  ),
  ext: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  ),
  logout: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  user: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  card: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
    </svg>
  ),
  palette: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <circle cx="8" cy="9" r="4" />
      <circle cx="16" cy="9" r="4" />
      <circle cx="12" cy="16" r="4" />
    </svg>
  ),
  gift: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <rect x="3" y="8" width="18" height="5" rx="1" />
      <path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z" />
    </svg>
  ),
  database: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  ),
  sun: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  moon: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  refresh: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  ),
  barchart: (p: IconProps = {}) => (
    <svg {...ic(p)}>
      <path d="M3 21h18M7 21V11M12 21V5M17 21v-7" />
    </svg>
  ),
} as const;

export type IconName = keyof typeof Icon;

/* ────────────────────────────────────────────────────────────
   Logo mark — canonical Chainfren H
   ──────────────────────────────────────────────────────────── */
export function LogoMark({
  size = 22,
  color = "rgb(var(--ink))",
  colorB,
  style,
}: {
  size?: number;
  color?: string;
  colorB?: string;
  style?: CSSProperties;
}) {
  const a = color;
  const b = colorB || color;
  const sw = 8;
  const cap = {
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  return (
    <svg
      height={size}
      width={size * (68 / 140)}
      viewBox="0 0 68 140"
      style={{ overflow: "visible", ...style }}
      role="img"
      aria-label="indyfren"
    >
      <g stroke={a}>
        <line
          x1="12"
          y1="26"
          x2="12"
          y2="86"
          style={{ ...cap, strokeWidth: sw }}
        />
        <line
          x1="12"
          y1="52"
          x2="56"
          y2="52"
          style={{ ...cap, strokeWidth: sw }}
        />
        <line
          x1="12"
          y1="86"
          x2="4"
          y2="132"
          style={{ ...cap, strokeWidth: sw }}
        />
        <line
          x1="12"
          y1="86"
          x2="20"
          y2="132"
          style={{ ...cap, strokeWidth: sw }}
        />
      </g>
      <circle cx="12" cy="18" r="6" fill={a} />
      <g stroke={b}>
        <line
          x1="56"
          y1="26"
          x2="56"
          y2="86"
          style={{ ...cap, strokeWidth: sw }}
        />
        <line
          x1="56"
          y1="86"
          x2="48"
          y2="132"
          style={{ ...cap, strokeWidth: sw }}
        />
        <line
          x1="56"
          y1="86"
          x2="64"
          y2="132"
          style={{ ...cap, strokeWidth: sw }}
        />
      </g>
      <circle cx="56" cy="18" r="6" fill={b} />
    </svg>
  );
}

export function LogoBadge({
  size = 34,
  radius,
  bg = "var(--cf-dark-blue)",
  color = "#fff",
  colorB,
}: {
  size?: number;
  radius?: number;
  bg?: string;
  color?: string;
  colorB?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: radius != null ? radius : size * 0.3,
        display: "grid",
        placeItems: "center",
        flex: "none",
      }}
    >
      <LogoMark size={size * 0.56} color={color} colorB={colorB} />
    </div>
  );
}

export function Logo({
  size = 16,
  color = "rgb(var(--ink))",
  duo = true,
}: {
  size?: number;
  color?: string;
  duo?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <LogoMark
        size={size * 1.55}
        color={color}
        colorB={duo ? "var(--cf-accent-blue)" : color}
      />
      <span
        style={{
          fontFamily: "var(--font-primary)",
          fontWeight: 600,
          fontSize: size,
          letterSpacing: "-0.02em",
          color,
        }}
      >
        indyfren
      </span>
    </span>
  );
}

/* ────────────────────────────────────────────────────────────
   Fren — stickman illustrative poses
   ──────────────────────────────────────────────────────────── */
type Pt = [number, number];
type StickProps = {
  head: Pt;
  r?: number;
  bodyTop: Pt;
  shoulder?: Pt;
  hip: Pt;
  spineSway?: number;
  lHand?: Pt | null;
  rHand?: Pt | null;
  lFoot?: Pt | null;
  rFoot?: Pt | null;
  lElbow?: Pt | null;
  rElbow?: Pt | null;
  lKnee?: Pt | null;
  rKnee?: Pt | null;
  color?: string;
  sw?: number;
};
function Stickman(props: StickProps) {
  const {
    head,
    r = 24,
    bodyTop,
    shoulder,
    hip,
    spineSway = 0,
    lHand,
    rHand,
    lFoot,
    rFoot,
    lElbow,
    rElbow,
    lKnee,
    rKnee,
    color = "#08153C",
    sw = 18,
  } = props;
  const s = {
    stroke: color,
    strokeWidth: sw,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  let torsoD: string;
  if (spineSway) {
    const mx = (bodyTop[0] + hip[0]) / 2 + spineSway;
    const my = (bodyTop[1] + hip[1]) / 2;
    torsoD = `M${bodyTop[0]} ${bodyTop[1]} Q${mx} ${my} ${hip[0]} ${hip[1]}`;
  } else {
    torsoD = `M${bodyTop[0]} ${bodyTop[1]} L${hip[0]} ${hip[1]}`;
  }
  const limbD = (a: Pt, j: Pt | null | undefined, b: Pt) =>
    j
      ? `M${a[0]} ${a[1]} Q${j[0]} ${j[1]} ${b[0]} ${b[1]}`
      : `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
  const sh = shoulder ?? bodyTop;
  return (
    <g>
      <path d={torsoD} {...s} />
      {lHand && <path d={limbD(sh, lElbow, lHand)} {...s} />}
      {rHand && <path d={limbD(sh, rElbow, rHand)} {...s} />}
      {lFoot && <path d={limbD(hip, lKnee, lFoot)} {...s} />}
      {rFoot && <path d={limbD(hip, rKnee, rFoot)} {...s} />}
      <circle cx={head[0]} cy={head[1]} r={r} fill={color} />
    </g>
  );
}
function upright(
  cx: number,
  color: string,
  opts: Partial<StickProps> = {},
): StickProps {
  return {
    head: [cx, 50],
    r: 24,
    bodyTop: [cx, 78],
    shoulder: [cx, 140],
    hip: [cx, 268],
    lFoot: [cx - 20, 380],
    rFoot: [cx + 20, 380],
    color,
    sw: 18,
    ...opts,
  };
}
const BAR_Y = 140;
const POSES: Record<string, (a: string, b: string, sw: number) => ReactNode> = {
  mark: (a, b, sw) => {
    const lx = 138,
      rx = 262;
    return (
      <g>
        <Stickman {...upright(lx, a, { sw, rHand: [200, BAR_Y] })} />
        <Stickman {...upright(rx, b, { sw, lHand: [200, BAR_Y] })} />
      </g>
    );
  },
  handshake: (a, b, sw) => {
    const lx = 120,
      rx = 280;
    const meet: Pt = [200, 214];
    return (
      <g>
        <Stickman
          {...upright(lx, a, {
            sw,
            rHand: meet,
            rElbow: [165, 172],
            lHand: [lx - 22, 244],
            lElbow: [lx - 14, 200],
          })}
        />
        <Stickman
          {...upright(rx, b, {
            sw,
            lHand: meet,
            lElbow: [235, 172],
            rHand: [rx + 22, 244],
            rElbow: [rx + 14, 200],
          })}
        />
        <circle cx={meet[0]} cy={meet[1]} r={sw * 0.5} fill={a} />
      </g>
    );
  },
  reach: (a, b, sw) => {
    const lx = 138,
      rx = 262;
    return (
      <g>
        <Stickman
          {...upright(lx, a, {
            sw,
            rHand: [lx + 46, 22],
            rElbow: [lx + 36, 80],
            lHand: [lx - 46, 22],
            lElbow: [lx - 36, 80],
          })}
        />
        <Stickman
          {...upright(rx, b, {
            sw,
            lHand: [rx - 46, 22],
            lElbow: [rx - 36, 80],
            rHand: [rx + 46, 22],
            rElbow: [rx + 36, 80],
          })}
        />
      </g>
    );
  },
  squad: (a, b, sw) => {
    const lx = 138,
      rx = 262;
    return (
      <g>
        <Stickman
          {...upright(lx, a, {
            sw,
            rHand: [rx, 96],
            rElbow: [200, 88],
            lHand: [lx - 30, 246],
            lElbow: [lx - 20, 200],
          })}
        />
        <Stickman
          {...upright(rx, b, {
            sw,
            lHand: [lx, 96],
            lElbow: [200, 88],
            rHand: [rx + 30, 246],
            rElbow: [rx + 20, 200],
          })}
        />
      </g>
    );
  },
  scout: (a, b, sw) => {
    const cx = 176;
    const grip: Pt = [cx + 92, 150];
    const lensC: Pt = [cx + 134, 96];
    const lensR = 34;
    const h2: Pt = [cx + 116, 120];
    const ls = {
      stroke: b,
      strokeWidth: sw * 0.85,
      fill: "none",
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };
    return (
      <g>
        <Stickman
          head={[cx, 96]}
          r={24}
          bodyTop={[cx, 124]}
          shoulder={[cx, 188]}
          hip={[cx, 286]}
          rHand={grip}
          rElbow={[cx + 44, 150]}
          lHand={[cx - 40, 262]}
          lElbow={[cx - 26, 224]}
          lFoot={[cx - 22, 388]}
          rFoot={[cx + 22, 388]}
          color={a}
          sw={sw}
        />
        <line x1={grip[0]} y1={grip[1]} x2={h2[0]} y2={h2[1]} {...ls} />
        <circle cx={lensC[0]} cy={lensC[1]} r={lensR} {...ls} />
        <path
          d={`M${lensC[0] - 12} ${lensC[1] - 6} Q${lensC[0] - 2} ${lensC[1] - 16} ${lensC[0] + 8} ${lensC[1] - 12}`}
          stroke={b}
          strokeWidth={sw * 0.5}
          fill="none"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
    );
  },
};

export function Fren({
  pose = "mark",
  size = 28,
  color = "#fff",
  colorB,
  sw = 20,
  style,
}: {
  pose?: string;
  size?: number;
  color?: string;
  colorB?: string;
  sw?: number;
  style?: CSSProperties;
}) {
  const fn = POSES[pose] || POSES.mark;
  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {fn(color, colorB || color, sw)}
    </svg>
  );
}

export function FrenBadge({
  pose = "mark",
  size = 40,
  radius,
  bg = "var(--cf-dark-blue)",
  color = "#fff",
  colorB,
  inset = 0.6,
}: {
  pose?: string;
  size?: number;
  radius?: number;
  bg?: string;
  color?: string;
  colorB?: string;
  inset?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        borderRadius: radius != null ? radius : size * 0.3,
        display: "grid",
        placeItems: "center",
        flex: "none",
      }}
    >
      <Fren
        pose={pose}
        size={size * inset}
        color={color}
        colorB={colorB}
        sw={22}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Brand glyphs (platform logos)
   ──────────────────────────────────────────────────────────── */
export function BrandGlyph({
  name,
  size = 38,
}: {
  name: string;
  size?: number;
}) {
  const s: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 11,
    display: "grid",
    placeItems: "center",
    flex: "none",
  };
  switch (name) {
    case "YouTube":
      return (
        <div style={{ ...s, background: "#FF0033" }}>
          <svg
            width={size * 0.55}
            height={size * 0.55}
            viewBox="0 0 24 24"
            fill="#fff"
          >
            <path d="M10 9l5 3-5 3z" />
            <rect
              x="2"
              y="5"
              width="20"
              height="14"
              rx="4"
              fill="none"
              stroke="#fff"
              strokeWidth="2.4"
            />
          </svg>
        </div>
      );
    case "Instagram":
      return (
        <div
          style={{
            ...s,
            background:
              "linear-gradient(135deg,#FEDA75,#FA7E1E,#D62976,#962FBF)",
          }}
        >
          <svg
            width={size * 0.56}
            height={size * 0.56}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17" cy="7" r="1.2" fill="#fff" stroke="none" />
          </svg>
        </div>
      );
    case "TikTok":
      return (
        <div style={{ ...s, background: "#000" }}>
          <svg
            width={size * 0.5}
            height={size * 0.5}
            viewBox="0 0 24 24"
            fill="#fff"
          >
            <path d="M16 4c.5 2.3 2 3.8 4 4v3c-1.6 0-3-.5-4-1.2V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3V4z" />
          </svg>
        </div>
      );
    case "X":
    case "Twitter":
    case "Twitter / X":
      return (
        <div style={{ ...s, background: "#000" }}>
          <svg
            width={size * 0.46}
            height={size * 0.46}
            viewBox="0 0 24 24"
            fill="#fff"
          >
            <path d="M3 3l7.5 9.5L3.5 21H6l5.3-6.2L16 21h5l-7.8-10L20.5 3H18l-5 5.9L8.5 3z" />
          </svg>
        </div>
      );
    case "Gmail":
      return (
        <div
          style={{
            ...s,
            background: "#fff",
            border: "1px solid rgb(var(--ink) / 0.14)",
          }}
        >
          <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
            <path
              d="M4 6h16v12H4z"
              fill="none"
              stroke="#EA4335"
              strokeWidth="2"
            />
            <path
              d="M4 7l8 6 8-6"
              fill="none"
              stroke="#EA4335"
              strokeWidth="2"
            />
          </svg>
        </div>
      );
    case "Stripe":
      return (
        <div
          style={{
            ...s,
            background: "#635BFF",
            color: "#fff",
            fontWeight: 800,
            fontSize: size * 0.5,
          }}
        >
          S
        </div>
      );
    case "Notion":
      return (
        <div
          style={{
            ...s,
            background: "#fff",
            color: "#111",
            fontWeight: 800,
            fontSize: size * 0.5,
          }}
        >
          N
        </div>
      );
    case "Calendar":
      return (
        <div style={{ ...s, background: "#fff" }}>
          <svg
            width={size * 0.55}
            height={size * 0.55}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4285F4"
            strokeWidth="2"
          >
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M4 9h16M8 3v4M16 3v4" />
          </svg>
        </div>
      );
    case "LinkedIn":
      return (
        <div
          style={{
            ...s,
            background: "#0A66C2",
            color: "#fff",
            fontWeight: 800,
            fontSize: size * 0.42,
          }}
        >
          in
        </div>
      );
    case "Twitch":
      return (
        <div
          style={{
            ...s,
            background: "#9146FF",
            color: "#fff",
            fontWeight: 800,
            fontSize: size * 0.5,
          }}
        >
          T
        </div>
      );
    case "Pinterest":
      return (
        <div
          style={{
            ...s,
            background: "#E60023",
            color: "#fff",
            fontWeight: 800,
            fontSize: size * 0.5,
          }}
        >
          P
        </div>
      );
    case "Podcast":
      return (
        <div
          style={{
            ...s,
            background: "#7c3aed",
            color: "#fff",
            fontWeight: 800,
            fontSize: size * 0.5,
          }}
        >
          🎙
        </div>
      );
    default:
      return (
        <div
          style={{
            ...s,
            background: "rgb(var(--ink) / 0.1)",
            color: "rgb(var(--ink) / 0.6)",
            fontWeight: 700,
            fontSize: size * 0.4,
          }}
        >
          {name?.[0] ?? "?"}
        </div>
      );
  }
}

/* ────────────────────────────────────────────────────────────
   Ambient background
   ──────────────────────────────────────────────────────────── */
export function Ambient({ calm }: { calm?: boolean }) {
  return (
    <div className={"ambient" + (calm ? " ambient--calm" : "")} aria-hidden>
      <div className="ambient-grain" />
    </div>
  );
}

/* small helper: render markdown-lite bold (**x**) */
export function mdBold(t: string): ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <b key={i} style={{ color: "rgb(var(--ink))", fontWeight: 700 }}>
        {p.slice(2, -2)}
      </b>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: "rgb(var(--ink) / 0.6)",
            animation: `pulseDot 1.2s ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

"use client";

import { sceneOf, type SceneStyle } from "@mystery/shared";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Illustrated, animated backdrop for each theme: a rainy manor study, a
 * festival stage at night, a startup office after hours. Every setting,
 * built-in or AI-generated, uses one of these three; the tint varies per
 * setting. Children render on top (portraits, name plates).
 */

type Variant = "hero" | "stage" | "backdrop" | "thumb";

function Rain({ count = 70 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="rain-drop"
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${((i * 53) % 100) / 100}s`,
            animationDuration: `${0.55 + ((i * 17) % 40) / 100}s`,
            opacity: 0.15 + ((i * 29) % 40) / 100,
          }}
        />
      ))}
    </div>
  );
}

function Dust() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="dust-mote"
          style={{
            left: `${10 + ((i * 61) % 80)}%`,
            top: `${20 + ((i * 37) % 60)}%`,
            animationDelay: `${(i * 0.9) % 7}s`,
            animationDuration: `${7 + (i % 5)}s`,
          }}
        />
      ))}
    </div>
  );
}

const BOOK_COLORS = ["#5b2a2a", "#2d3b5c", "#3d4a2a", "#5c4a2a", "#4a2a4a", "#2a4a48", "#6b4a1f"];

function ManorSvg() {
  return (
    <svg viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="mn-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1d2c" />
          <stop offset="1" stopColor="#170f18" />
        </linearGradient>
        <linearGradient id="mn-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1a33" />
          <stop offset="1" stopColor="#1d2a4a" />
        </linearGradient>
        <radialGradient id="mn-fire" cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor="#ff9a3c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
        </radialGradient>
        <pattern id="mn-damask" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M20 4 L28 20 L20 36 L12 20 Z" fill="#ffffff" opacity="0.03" />
        </pattern>
      </defs>
      <rect width="1200" height="500" fill="url(#mn-wall)" />
      <rect width="1200" height="300" fill="url(#mn-damask)" />
      <rect y="300" width="1200" height="200" fill="#1f130d" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x={i * 96 + 8} y="318" width="80" height="150" rx="3" fill="none" stroke="#3a2618" strokeWidth="3" />
      ))}
      <rect y="296" width="1200" height="8" fill="#3d2a1a" />

      <g transform="translate(110 50)">
        <rect x="-12" y="-12" width="244" height="254" fill="#2b1c12" />
        <rect width="220" height="230" fill="url(#mn-glass)" />
        <circle cx="160" cy="50" r="22" fill="#cfd8ee" opacity="0.25" />
        <path d="M0 200 L40 170 L70 185 L110 150 L150 175 L190 150 L220 165 L220 230 L0 230 Z" fill="#0a0f1e" />
        <rect className="lightning-window" width="220" height="230" fill="#e6edff" />
        <line x1="110" y1="0" x2="110" y2="230" stroke="#2b1c12" strokeWidth="8" />
        <line x1="0" y1="115" x2="220" y2="115" stroke="#2b1c12" strokeWidth="8" />
        <path d="M-30 -20 C10 60 0 180 -20 260 L-40 260 L-40 -20 Z" fill="#4a1622" />
        <path d="M250 -20 C210 60 220 180 240 260 L260 260 L260 -20 Z" fill="#4a1622" />
      </g>

      <g transform="translate(520 40)">
        <rect width="160" height="120" fill="#3b2a12" />
        <rect x="10" y="10" width="140" height="100" fill="#211814" />
        <ellipse cx="80" cy="56" rx="22" ry="28" fill="#2d211b" />
        <rect x="56" y="80" width="48" height="30" fill="#2d211b" />
      </g>

      <g transform="translate(900 30)">
        <rect width="260" height="270" fill="#26180f" />
        {[0, 1, 2, 3].map((row) => (
          <g key={row} transform={`translate(12 ${14 + row * 64})`}>
            <rect y="52" width="236" height="6" fill="#3d2a1a" />
            {Array.from({ length: 14 }, (_, i) => {
              const h = 34 + ((i * 7 + row * 13) % 16);
              return <rect key={i} x={i * 16.5} y={52 - h} width="14" height={h} fill={BOOK_COLORS[(i + row * 3) % BOOK_COLORS.length]} />;
            })}
          </g>
        ))}
      </g>

      <g className="chandelier-sway" style={{ transformOrigin: "600px 0px" }}>
        <line x1="600" y1="0" x2="600" y2="26" stroke="#8a6a32" strokeWidth="2" />
        <ellipse cx="600" cy="32" rx="40" ry="8" fill="#8a6a32" />
        {[-30, -10, 10, 30].map((dx) => (
          <circle key={dx} cx={600 + dx} cy="26" r="4" fill="#ffd27a" className="flicker" />
        ))}
      </g>
      <ellipse cx="600" cy="40" rx="260" ry="90" fill="#ffcf7a" opacity="0.05" />
      <rect x="980" y="330" width="220" height="170" fill="url(#mn-fire)" className="flicker-slow" />
      <ellipse cx="600" cy="500" rx="520" ry="60" fill="#3a1418" opacity="0.6" />
    </svg>
  );
}

function FestSvg() {
  const bulbs = Array.from({ length: 22 }, (_, i) => i);
  return (
    <svg viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120a2a" />
          <stop offset="1" stopColor="#2a1240" />
        </linearGradient>
        <linearGradient id="fs-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1200" height="500" fill="url(#fs-sky)" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(i * 131) % 1200} cy={(i * 47) % 200} r={(i % 3) * 0.6 + 0.6} fill="#fff" className="twinkle" style={{ animationDelay: `${(i % 9) * 0.4}s` }} />
      ))}
      {[
        [200, "#f472b6"],
        [600, "#a78bfa"],
        [1000, "#60a5fa"],
      ].map(([x, c], i) => (
        <g key={i} className="beam-sweep" style={{ transformOrigin: `${x}px 30px`, animationDelay: `${i * 1.3}s` }}>
          <polygon points={`${Number(x) - 12},30 ${Number(x) + 12},30 ${Number(x) + 160},500 ${Number(x) - 160},500`} fill={c as string} opacity="0.13" />
        </g>
      ))}
      <rect x="0" y="22" width="1200" height="16" fill="#1a1a22" />
      {Array.from({ length: 30 }, (_, i) => (
        <path key={i} d={`M${i * 40} 22 L${i * 40 + 20} 38 L${i * 40 + 40} 22`} stroke="#2e2e3a" strokeWidth="2" fill="none" />
      ))}
      <path d="M0 80 Q300 150 600 90 T1200 80" stroke="#3a2a4a" strokeWidth="2" fill="none" />
      {bulbs.map((i) => {
        const x = (i / (bulbs.length - 1)) * 1200;
        const t = x / 600;
        const y = t <= 1 ? 80 + 4 * 35 * t * (1 - t) * 1.4 : 90 + 4 * 25 * (t - 1) * (2 - t) * -0.4;
        const colors = ["#fde68a", "#f472b6", "#a78bfa", "#4ade80", "#60a5fa"];
        return <circle key={i} cx={x} cy={y + 6} r="5" fill={colors[i % colors.length]} className="twinkle" style={{ animationDelay: `${(i % 5) * 0.3}s` }} />;
      })}
      {Array.from({ length: 16 }, (_, i) => (
        <polygon key={i} points={`${i * 78},110 ${i * 78 + 34},110 ${i * 78 + 17},140`} fill={["#f472b6", "#f5b83d", "#60a5fa", "#4ade80"][i % 4]} opacity="0.5" />
      ))}
      <rect x="0" y="330" width="1200" height="170" fill="#0b0716" />
      {Array.from({ length: 26 }, (_, i) => (
        <g key={i} transform={`translate(${i * 48 - 10} ${400 + (i % 3) * 8})`}>
          <circle cx="24" cy="0" r="16" fill="#05030b" />
          <rect x="4" y="12" width="40" height="90" rx="16" fill="#05030b" />
        </g>
      ))}
    </svg>
  );
}

function OfficeSvg() {
  return (
    <svg viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="of-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a1324" />
          <stop offset="1" stopColor="#1b2540" />
        </linearGradient>
        <radialGradient id="of-screen" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#7dd3fc" stopOpacity="0.45" />
          <stop offset="1" stopColor="#7dd3fc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="500" fill="#121722" />
      <rect x="40" y="30" width="1120" height="280" fill="url(#of-sky)" />
      {Array.from({ length: 22 }, (_, i) => {
        const w = 40 + ((i * 23) % 40);
        const h = 90 + ((i * 47) % 150);
        const x = 40 + i * 52;
        return (
          <g key={i}>
            <rect x={x} y={310 - h} width={w} height={h} fill="#0b1120" />
            {Array.from({ length: Math.floor(h / 18) }, (_, r) =>
              Array.from({ length: Math.floor(w / 14) }, (_, c) =>
                (r * 7 + c * 3 + i) % 4 === 0 ? (
                  <rect key={`${r}-${c}`} x={x + 5 + c * 14} y={310 - h + 8 + r * 18} width="6" height="8" fill="#fcd34d" opacity="0.55" />
                ) : null,
              ),
            )}
          </g>
        );
      })}
      {[300, 600, 900].map((x) => (
        <rect key={x} x={x} y="30" width="10" height="280" fill="#1a2030" />
      ))}
      <rect x="40" y="30" width="1120" height="280" fill="none" stroke="#2a3245" strokeWidth="10" />
      <g className="neon">
        <text x="600" y="76" textAnchor="middle" fontFamily="var(--font-display)" fontSize="34" fontWeight="800" fill="#f472b6">
          SHIP IT
        </text>
      </g>
      <rect y="320" width="1200" height="180" fill="#0c0f17" />
      {[140, 420, 780, 1060].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy="360" rx="120" ry="60" fill="url(#of-screen)" className={i % 2 ? "flicker" : "flicker-slow"} />
          <rect x={x - 50} y="330" width="100" height="62" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="3" />
          <rect x={x - 44} y="336" width="88" height="50" fill="#1e3a5f" className={i % 2 ? "flicker" : "flicker-slow"} />
          {[0, 1, 2].map((l) => (
            <rect key={l} x={x - 38} y={342 + l * 12} width={30 + ((l * 23 + i * 11) % 40)} height="4" fill="#7dd3fc" opacity="0.6" />
          ))}
          <rect x={x - 8} y="392" width="16" height="18" fill="#334155" />
          <rect x={x - 140} y="410" width="280" height="12" fill="#1f2937" />
        </g>
      ))}
      <g transform="translate(1110 300)">
        <rect x="-18" y="70" width="36" height="40" fill="#3b2a1a" />
        {[-40, -20, 0, 20, 40].map((a) => (
          <ellipse key={a} cx="0" cy="40" rx="10" ry="38" fill="#14532d" transform={`rotate(${a} 0 70)`} />
        ))}
      </g>
    </svg>
  );
}

const THEME_TINT: Record<string, string> = {
  "manor-1920s": "from-[#1a0f1a]",
  "college-fest": "from-[#140a2a]",
  "startup-office": "from-[#0a1220]",
  "hill-hotel": "from-[#0c1a16]",
  "film-premiere": "from-[#2a0a12]",
  newsroom: "from-[#1a1408]",
};

/** Tints for generated settings, picked from the id so a setting always looks the same. */
const SCENE_TINTS: Record<SceneStyle, string[]> = {
  manor: ["from-[#1a0f1a]", "from-[#0c1a16]", "from-[#10131f]", "from-[#1c120a]"],
  fest: ["from-[#140a2a]", "from-[#2a0a12]", "from-[#0a1a24]", "from-[#22102a]"],
  office: ["from-[#0a1220]", "from-[#1a1408]", "from-[#0d1a14]", "from-[#16101f]"],
};

function tintFor(theme: string, scene: SceneStyle) {
  if (THEME_TINT[theme]) return THEME_TINT[theme];
  let h = 0;
  for (const ch of theme) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const tints = SCENE_TINTS[scene];
  return tints[Math.abs(h) % tints.length];
}

function SceneImpl({
  theme,
  variant = "backdrop",
  mood = 0,
  flashKey = 0,
  className,
  children,
}: {
  theme: string;
  variant?: Variant;
  /** 0-100: tints the room red as a suspect's nerves rise. */
  mood?: number;
  /** Change this number to trigger a lightning flash. */
  flashKey?: number;
  className?: string;
  children?: ReactNode;
}) {
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (flashKey) setFlash((f) => f + 1);
  }, [flashKey]);

  const thumb = variant === "thumb";
  const scene = sceneOf(theme);
  return (
    <div className={cx("relative isolate overflow-hidden bg-gradient-to-b to-ink-950", tintFor(theme, scene), className)}>
      <div className={cx("absolute inset-0", variant === "stage" && "scene-zoom")}>
        {scene === "fest" ? <FestSvg /> : scene === "office" ? <OfficeSvg /> : <ManorSvg />}
      </div>
      {scene === "manor" && !thumb && <Rain count={variant === "hero" ? 90 : 50} />}
      {scene === "manor" && <div className="lightning-room pointer-events-none absolute inset-0 bg-[#dfe7ff]" />}
      {!thumb && <Dust />}

      {variant === "stage" && (
        <div className="lamp-swing pointer-events-none absolute left-1/2 top-0 h-full w-[640px] -translate-x-1/2" style={{ transformOrigin: "50% 0%" }}>
          <div className="absolute left-1/2 top-0 h-6 w-[2px] -translate-x-1/2 bg-ink-600" />
          <div className="absolute left-1/2 top-5 h-5 w-16 -translate-x-1/2 rounded-t-full bg-ink-700 shadow-[0_6px_18px_#ffd99a88]" />
          <div
            className="absolute left-1/2 top-9 h-[calc(100%-36px)] w-full -translate-x-1/2"
            style={{
              background: "linear-gradient(180deg, rgb(255 225 160 / 0.32), rgb(255 225 160 / 0.06) 70%, transparent)",
              clipPath: "polygon(46% 0, 54% 0, 92% 100%, 8% 100%)",
            }}
          />
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 transition-colors duration-1000"
        style={{ background: `radial-gradient(ellipse at 50% 60%, transparent 35%, rgb(${Math.round(60 + mood * 1.2)} 8 12 / ${0.25 + mood / 260}) 100%)` }}
      />
      {!thumb && <div className="grain pointer-events-none absolute inset-0" />}

      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="pointer-events-none absolute inset-0 z-20 bg-white"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: [0.85, 0.1, 0.6, 0] }}
            transition={{ duration: 0.9, times: [0, 0.2, 0.35, 1] }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

export const Scene = memo(SceneImpl);

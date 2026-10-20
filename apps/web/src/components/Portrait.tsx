"use client";

import { motion } from "framer-motion";
import { memo, useEffect, useId, useMemo, useState } from "react";
import { traitsFor, type Traits } from "@/lib/avatar";
import type { Expression } from "@/lib/expression";

/**
 * Illustrated suspect portrait (SVG). Looks are derived from the suspect's
 * id/name/role, the face from the current expression. Blinks, breathes and
 * moves its mouth while talking.
 */

export interface PortraitSeed {
  id: string;
  name: string;
  role?: string;
  theme?: string;
  /** Public bio; its pronouns help pick the character's look. */
  bio?: string;
}

/** The one way to build a suspect's seed, so every screen draws the same face. */
export function suspectSeed(s: { id: string; name: string; role?: string; bio?: string }, theme?: string): PortraitSeed {
  return { id: s.id, name: s.name, role: s.role, bio: s.bio, theme };
}

interface FaceShape {
  brows: [number, number, number, number];
  eyeOpen: number;
  look: [number, number];
  pupil: number;
}

const FACE: Record<Expression, FaceShape> = {
  neutral: { brows: [0, 0, 0, 0], eyeOpen: 1, look: [0, 0], pupil: 1 },
  calm: { brows: [-1, -1, -1, -1], eyeOpen: 0.82, look: [0, 0.4], pupil: 1 },
  thinking: { brows: [0, 0, -6, -3], eyeOpen: 0.9, look: [-2.2, -2.2], pupil: 1 },
  nervous: { brows: [-4, 1, -4, 1], eyeOpen: 1, look: [2, 0.5], pupil: 0.85 },
  scared: { brows: [-7, -2, -7, -2], eyeOpen: 1.3, look: [0, 0], pupil: 0.6 },
  angry: { brows: [6, -3, 6, -3], eyeOpen: 0.68, look: [0, 0], pupil: 1 },
  smug: { brows: [1, 0, -5, -7], eyeOpen: 0.58, look: [1.5, 0], pupil: 1 },
  sad: { brows: [-5, 3, -5, 3], eyeOpen: 0.62, look: [0, 1.8], pupil: 1 },
  surprised: { brows: [-9, -8, -9, -8], eyeOpen: 1.4, look: [0, 0], pupil: 0.75 },
  broken: { brows: [-6, 4, -6, 4], eyeOpen: 0.45, look: [0, 2.2], pupil: 1 },
  relieved: { brows: [-3, -2, -3, -2], eyeOpen: 0.5, look: [0, 0], pupil: 1 },
};

const MOUTH_LINE: Partial<Record<Expression, string>> = {
  neutral: "M90,137 Q100,138.5 110,137",
  calm: "M89,135 Q100,142 111,135",
  relieved: "M87,134 Q100,145 113,134",
  smug: "M90,138 Q103,139 113,131",
  thinking: "M93,138 Q100,136.5 107,139",
  nervous: "M88,138 Q92,134.5 96,138 Q100,141.5 104,138 Q108,134.5 112,138",
  sad: "M89,141 Q100,132 111,141",
};

const HEAD_MOTION: Partial<Record<Expression, object>> = {
  broken: { rotate: 6, y: 7 },
  angry: { scale: 1.03, y: 2 },
  smug: { rotate: -3 },
  surprised: { y: -4, scale: 1.02 },
  sad: { rotate: 3, y: 3 },
  thinking: { rotate: -2 },
};

function Mouth({ expression, open, lip }: { expression: Expression; open: boolean; lip: string }) {
  if (open) {
    return (
      <g>
        <ellipse cx={100} cy={138} rx={6.5} ry={4.2} fill="#3a1717" />
        <ellipse cx={100} cy={140.2} rx={3.6} ry={1.6} fill="#c25a5a" />
      </g>
    );
  }
  switch (expression) {
    case "angry":
      return (
        <g>
          <path d="M88,134 L112,134 L110,142 L90,142 Z" fill="#3a1717" />
          <rect x={90} y={135.2} width={20} height={5.6} rx={1} fill="#f3eee6" />
          <line x1={90} y1={138} x2={110} y2={138} stroke="#3a1717" strokeWidth={0.8} />
        </g>
      );
    case "scared":
      return <ellipse cx={100} cy={139} rx={5} ry={6.2} fill="#3a1717" />;
    case "surprised":
      return <ellipse cx={100} cy={139} rx={6.2} ry={7.4} fill="#3a1717" />;
    case "broken":
      return <path d="M87,142 Q100,129 113,142 Q100,137 87,142 Z" fill="#3a1717" />;
    default:
      return <path d={MOUTH_LINE[expression] ?? MOUTH_LINE.neutral} fill="none" stroke={lip} strokeWidth={lip === "#5a2a24" ? 2.6 : 3.6} strokeLinecap="round" />;
  }
}

function BackHair({ t }: { t: Traits }) {
  switch (t.hairStyle) {
    case "long":
      return <path d="M50,100 C44,38 156,38 150,100 L162,198 C140,210 60,210 38,198 Z" fill={t.hair} />;
    case "bob":
      return <path d="M47,102 C42,40 158,40 153,102 L156,152 C140,160 60,160 44,152 Z" fill={t.hair} />;
    case "waves":
      return <path d="M49,100 C45,42 155,42 151,100 L156,166 C140,176 60,176 44,166 Z" fill={t.hair} />;
    case "ponytail":
      return <path d="M138,62 C176,74 178,146 158,178 C152,146 148,112 140,88 Z" fill={t.hair} />;
    case "bun":
      return <circle cx={100} cy={38} r={17} fill={t.hair} />;
    default:
      return null;
  }
}

function FrontHair({ t }: { t: Traits }) {
  const cap = "M52,104 C46,52 74,38 100,38 C126,38 154,52 148,104 C144,86 138,72 124,66 C110,72 84,70 70,70 C60,78 55,90 52,104 Z";
  const fringe = "M50,108 C44,50 76,36 102,36 C130,36 156,54 150,108 C146,88 138,74 128,66 C116,78 90,80 64,74 C58,84 52,96 50,108 Z";
  switch (t.hairStyle) {
    case "bald":
      return (
        <g fill={t.hair}>
          <path d="M53,98 C52,86 56,80 60,78 L60,100 Z" />
          <path d="M147,98 C148,86 144,80 140,78 L140,100 Z" />
        </g>
      );
    case "short":
      return <path d={cap} fill={t.hair} />;
    case "slick":
      return (
        <g>
          <path d="M52,102 C46,50 74,36 100,36 C126,36 154,50 148,102 C144,82 136,68 118,62 C96,62 76,66 64,74 C58,82 54,92 52,102 Z" fill={t.hair} />
          <path d="M76,52 C92,44 116,44 132,54" stroke="#ffffff22" strokeWidth={2} fill="none" />
        </g>
      );
    case "curly":
      return (
        <g fill={t.hair}>
          <path d={cap} />
          {[[58, 72], [66, 56], [80, 46], [96, 41], [112, 42], [128, 48], [140, 60], [146, 76], [72, 66], [88, 60], [106, 58], [124, 62]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={9} />
          ))}
        </g>
      );
    case "spiky":
      return (
        <path
          d="M52,100 L49,70 L62,62 L62,44 L78,52 L84,32 L98,47 L110,30 L118,49 L134,38 L134,57 L149,64 L148,100 C140,80 128,68 100,66 C76,68 60,80 52,100 Z"
          fill={t.hair}
        />
      );
    case "waves":
      return (
        <g>
          <path d={fringe} fill={t.hair} />
          <path d="M62,60 Q72,52 82,60 T102,60 T122,58 T140,62" stroke="#ffffff1f" strokeWidth={2.2} fill="none" />
          <path d="M56,78 Q64,70 72,76" stroke="#ffffff1f" strokeWidth={2} fill="none" />
        </g>
      );
    default:
      return <path d={fringe} fill={t.hair} />;
  }
}

function Outfit({ t }: { t: Traits }) {
  const shoulders = "M12,240 C16,204 52,186 84,181 L116,181 C148,186 184,204 188,240 Z";
  const lapels = (
    <g stroke="#00000055" strokeWidth={2} fill="none">
      <path d="M84,182 L100,222 L78,240" />
      <path d="M116,182 L100,222 L122,240" />
    </g>
  );
  switch (t.outfit) {
    case "gown":
      return (
        <g>
          <path d={shoulders} fill={t.skin} />
          <path d="M26,240 C34,214 66,204 100,214 C134,204 166,214 174,240 Z" fill={t.outfitColor} />
          <path d="M60,206 L66,190 M140,206 L134,190" stroke={t.outfitColor} strokeWidth={4} />
        </g>
      );
    case "suit":
      return (
        <g>
          <path d={shoulders} fill={t.outfitColor} />
          <path d="M84,181 L100,216 L116,181 Z" fill="#f1ede6" />
          {lapels}
        </g>
      );
    case "uniform":
      return (
        <g>
          <path d={shoulders} fill={t.outfitColor} />
          <path d="M84,181 L100,206 L116,181 Z" fill="#f4f1ec" />
          <path d="M84,181 L94,196 L84,200 Z M116,181 L106,196 L116,200 Z" fill="#ffffff" />
          {lapels}
        </g>
      );
    case "labcoat":
    case "chef":
      return (
        <g>
          <path d={shoulders} fill="#eceef1" />
          {t.outfit === "labcoat" ? (
            <>
              <path d="M84,181 L100,218 L116,181 Z" fill={t.outfitColor} />
              {lapels}
            </>
          ) : (
            <g fill="#9aa1ab">
              {[196, 212, 228].map((y) => (
                <g key={y}>
                  <circle cx={90} cy={y} r={2.4} />
                  <circle cx={110} cy={y} r={2.4} />
                </g>
              ))}
            </g>
          )}
        </g>
      );
    case "hoodie":
      return (
        <g>
          <path d={shoulders} fill={t.outfitColor} />
          <path d="M66,188 C72,166 128,166 134,188 C120,200 80,200 66,188 Z" fill="#00000040" />
          <path d="M92,196 L90,226 M108,196 L110,226" stroke="#e7e2ef" strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    case "turtleneck":
      return (
        <g>
          <path d={shoulders} fill={t.outfitColor} />
          <rect x={82} y={150} width={36} height={36} rx={8} fill={t.outfitColor} />
          {[158, 166, 174].map((y) => (
            <line key={y} x1={84} y1={y} x2={116} y2={y} stroke="#00000033" strokeWidth={1.2} />
          ))}
        </g>
      );
    case "blazer":
      return (
        <g>
          <path d={shoulders} fill={t.outfitColor} />
          <path d="M86,181 L100,240 L114,181 Z" fill="#e6e2ec" />
          {lapels}
        </g>
      );
    default:
      return (
        <g>
          <path d={shoulders} fill={t.outfitColor} />
          <path d="M82,182 C88,194 112,194 118,182" stroke="#00000044" strokeWidth={3} fill="none" />
        </g>
      );
  }
}

function Accessory({ t }: { t: Traits }) {
  switch (t.accessory) {
    case "tie":
      return <path d="M97,190 L103,190 L106,226 L100,234 L94,226 Z" fill={t.accent} />;
    case "bowtie":
      return <path d="M100,190 L88,184 L88,196 Z M100,190 L112,184 L112,196 Z" fill={t.outfit === "uniform" ? "#111" : t.accent} />;
    case "pearls":
      return (
        <g fill="#f6f1e7" stroke="#cfc6b3" strokeWidth={0.6}>
          {Array.from({ length: 11 }, (_, i) => {
            const a = Math.PI * (0.15 + (0.7 * i) / 10);
            return <circle key={i} cx={100 - Math.cos(a) * 22} cy={180 + Math.sin(a) * 14} r={2.6} />;
          })}
        </g>
      );
    case "scarf":
      return <path d="M78,176 C90,190 110,190 122,176 L126,186 C110,200 90,200 74,186 Z M112,190 L118,222 L108,222 Z" fill={t.accent} />;
    case "lanyard":
      return (
        <g>
          <path d="M86,182 L98,218 M114,182 L102,218" stroke={t.accent} strokeWidth={2.4} />
          <rect x={92} y={216} width={16} height={20} rx={2} fill="#f4f4f6" stroke={t.accent} strokeWidth={1.4} />
        </g>
      );
    default:
      return null;
  }
}

function HeadAccessory({ t }: { t: Traits }) {
  if (t.accessory === "earrings" || t.accessory === "pearls") {
    return (
      <g fill="#f5c84b">
        <circle cx={53} cy={120} r={2.8} />
        <circle cx={147} cy={120} r={2.8} />
      </g>
    );
  }
  if (t.accessory === "headphones") {
    return (
      <g>
        <path d="M50,104 C46,30 154,30 150,104" stroke="#222" strokeWidth={6} fill="none" />
        <rect x={42} y={94} width={14} height={26} rx={6} fill={t.accent} />
        <rect x={144} y={94} width={14} height={26} rx={6} fill={t.accent} />
      </g>
    );
  }
  if (t.accessory === "flower") {
    return (
      <g transform="translate(132 56)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx={0} cy={-6} rx={4} ry={6} fill={t.accent} transform={`rotate(${a})`} />
        ))}
        <circle r={3} fill="#fde68a" />
      </g>
    );
  }
  return null;
}

function Eye({ cx, cy, face, iris, clip, closed, lashes, side }: { cx: number; cy: number; face: FaceShape; iris: string; clip: string; closed?: boolean; lashes?: boolean; side: -1 | 1 }) {
  if (closed) return <path d={`M${cx - 8},${cy} Q${cx},${cy + 4} ${cx + 8},${cy}`} stroke="#3b2a24" strokeWidth={2.2} fill="none" strokeLinecap="round" />;
  const ry = 5.6 * face.eyeOpen;
  const [dx, dy] = face.look;
  return (
    <g>
      <clipPath id={clip}>
        <ellipse cx={cx} cy={cy} rx={8.2} ry={ry} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={8.2} ry={ry} fill="#fbf8f3" />
      <g clipPath={`url(#${clip})`}>
        <circle cx={cx + dx} cy={cy + dy} r={4.1} fill={iris} />
        <circle cx={cx + dx} cy={cy + dy} r={2.1 * face.pupil} fill="#0d0a08" />
        <circle cx={cx + dx + 1.3} cy={cy + dy - 1.4} r={1.1} fill="#fff" />
      </g>
      <path d={`M${cx - 8.6},${cy - ry * 0.55} Q${cx},${cy - ry - 2.2} ${cx + 8.6},${cy - ry * 0.55}`} stroke="#2a1d18" strokeWidth={lashes ? 2.6 : 1.8} fill="none" strokeLinecap="round" />
      {lashes && (
        <path
          d={`M${cx + side * 8.2},${cy - ry * 0.5} l${side * 3.6},-2.6 M${cx + side * 5.6},${cy - ry * 0.95} l${side * 2.4},-3`}
          stroke="#2a1d18"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function PortraitImpl({
  seed,
  expression = "neutral",
  talking = false,
  size = 200,
  crop = "bust",
  deceased = false,
  className,
}: {
  seed: PortraitSeed;
  expression?: Expression;
  talking?: boolean;
  size?: number;
  crop?: "bust" | "head";
  deceased?: boolean;
  className?: string;
}) {
  const t = useMemo(() => traitsFor(seed), [seed.id, seed.name, seed.role, seed.theme, seed.bio]); // eslint-disable-line react-hooks/exhaustive-deps
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const face = FACE[deceased ? "neutral" : expression];
  const [mouthOpen, setMouthOpen] = useState(false);
  const blinkEvery = useMemo(() => 2.6 + ((seed.id.charCodeAt(seed.id.length - 1) || 0) % 7) * 0.45, [seed.id]);

  useEffect(() => {
    if (!talking) {
      setMouthOpen(false);
      return;
    }
    const iv = setInterval(() => setMouthOpen((o) => !o), 130);
    return () => clearInterval(iv);
  }, [talking]);

  const jawW = 24 + t.jaw * 12;
  const facePath = `M100,48 C128,48 147,68 147,102 C147,132 ${100 + jawW},156 100,161 C${100 - jawW},156 53,132 53,102 C53,68 72,48 100,48 Z`;
  const [li, lo, ri, ro] = face.brows;
  const nervousShake = !deceased && (expression === "nervous" || expression === "scared");
  const width = size;
  const height = crop === "head" ? size : size * 1.2;

  return (
    <svg
      viewBox={crop === "head" ? "38 26 124 124" : "0 0 200 240"}
      width={width}
      height={height}
      className={className}
      style={deceased ? { filter: "grayscale(1) contrast(0.9) brightness(0.85)" } : undefined}
      role="img"
      aria-label={`${seed.name}${deceased ? "" : `, looking ${expression}`}`}
    >
      <defs>
        <radialGradient id={`light${uid}`} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
          <stop offset="60%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.28} />
        </radialGradient>
      </defs>

      <motion.g
        animate={{ scaleY: [1, 1.012, 1] }}
        transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
      >
        <rect x={84} y={136} width={32} height={52} fill={t.skinShade} />
        <Outfit t={t} />
        <Accessory t={t} />
      </motion.g>

      <motion.g
        animate={{ rotate: 0, y: 0, scale: 1, ...(deceased ? { rotate: 4 } : HEAD_MOTION[expression]) }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
        style={{ transformBox: "fill-box", transformOrigin: "50% 90%" }}
      >
        <motion.g
          animate={nervousShake ? { x: [0, -0.9, 0.9, -0.5, 0] } : { y: [0, -1.4, 0] }}
          transition={nervousShake ? { repeat: Infinity, duration: 0.32, repeatDelay: expression === "scared" ? 0.15 : 0.9 } : { repeat: Infinity, duration: 4.2, ease: "easeInOut" }}
        >
          <BackHair t={t} />
          <ellipse cx={53} cy={106} rx={6.5} ry={10.5} fill={t.skin} />
          <ellipse cx={147} cy={106} rx={6.5} ry={10.5} fill={t.skin} />
          <path d={facePath} fill={t.skin} />
          <path d={facePath} fill={`url(#light${uid})`} />
          {expression === "scared" && !deceased && <path d={facePath} fill="#ffffff" opacity={0.12} />}

          {t.age === "old" && (
            <g stroke={t.skinShade} strokeWidth={1.4} fill="none" strokeLinecap="round">
              <path d="M80,74 Q100,70 120,74" />
              <path d="M84,80 Q100,77 116,80" />
              <path d="M76,124 Q80,134 86,140" />
              <path d="M124,124 Q120,134 114,140" />
            </g>
          )}
          {(expression === "broken" || expression === "scared") && !deceased && (
            <g fill={t.skinShade} opacity={0.7}>
              <ellipse cx={82} cy={113} rx={8} ry={2.6} />
              <ellipse cx={118} cy={113} rx={8} ry={2.6} />
            </g>
          )}
          {(expression === "nervous" || expression === "relieved" || expression === "broken") && !deceased && (
            <g fill="#e46a6a" opacity={0.22}>
              <ellipse cx={76} cy={124} rx={8} ry={4.5} />
              <ellipse cx={124} cy={124} rx={8} ry={4.5} />
            </g>
          )}

          <motion.g
            animate={deceased ? undefined : { scaleY: [1, 1, 0.08, 1] }}
            transition={{ repeat: Infinity, duration: blinkEvery, times: [0, 0.93, 0.96, 1] }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <Eye cx={82} cy={104} face={face} iris={t.iris} clip={`el${uid}`} closed={deceased} lashes={t.feminine} side={-1} />
            <Eye cx={118} cy={104} face={face} iris={t.iris} clip={`er${uid}`} closed={deceased} lashes={t.feminine} side={1} />
          </motion.g>

          <g stroke={t.age === "old" ? "#8f8a86" : t.hair === "#d8b56a" ? "#8a6a32" : t.hair} strokeWidth={3.4} strokeLinecap="round">
            <line x1={91} y1={90 + li} x2={73} y2={90 + lo} />
            <line x1={109} y1={90 + ri} x2={127} y2={90 + ro} />
          </g>

          <path d="M100,108 Q96.5,121 101,124" stroke={t.skinShade} strokeWidth={2.2} fill="none" strokeLinecap="round" />

          {t.facialHair === "beard" && (
            <path d="M55,112 C57,142 80,165 100,167 C120,165 143,142 145,112 C138,132 126,148 100,150 C74,148 62,132 55,112 Z" fill={t.hair} />
          )}
          {t.facialHair === "stubble" && (
            <path d="M58,118 C60,142 80,160 100,162 C120,160 140,142 142,118 C136,134 124,148 100,150 C76,148 64,134 58,118 Z" fill={t.hair} opacity={0.22} />
          )}
          <Mouth expression={deceased ? "neutral" : expression} open={mouthOpen} lip={t.feminine && !deceased ? "#b4445a" : "#5a2a24"} />
          {(t.facialHair === "mustache" || t.facialHair === "beard") && (
            <path d="M87,131 Q100,123 113,131 Q107,134 100,131 Q93,134 87,131 Z" fill={t.hair} />
          )}

          <FrontHair t={t} />
          <HeadAccessory t={t} />

          {t.glasses === "round" && (
            <g stroke="#1b1716" strokeWidth={2.2} fill="#ffffff10">
              <circle cx={82} cy={104} r={11.5} />
              <circle cx={118} cy={104} r={11.5} />
              <path d="M93.5,103 Q100,99 106.5,103" fill="none" />
            </g>
          )}
          {t.glasses === "square" && (
            <g stroke="#1b1716" strokeWidth={2.2} fill="#ffffff10">
              <rect x={69} y={95} width={26} height={18} rx={4} />
              <rect x={105} y={95} width={26} height={18} rx={4} />
              <path d="M95,102 L105,102" fill="none" />
            </g>
          )}

          {!deceased && (expression === "nervous" || expression === "scared") && (
            <motion.path
              d="M146,76 C150,84 152,88 148,92 C144,94 141,90 142,86 Z"
              fill="#9fd3ff"
              opacity={0.85}
              animate={{ y: [0, 10, 10], opacity: [0, 0.9, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeIn" }}
            />
          )}
          {!deceased && (expression === "sad" || expression === "broken") && (
            <motion.ellipse
              cx={86}
              cy={114}
              rx={2}
              ry={3}
              fill="#9fd3ff"
              animate={{ y: [0, 22], opacity: [0.9, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeIn" }}
            />
          )}
          {!deceased && expression === "angry" && (
            <g stroke="#e23b3b" strokeWidth={3} strokeLinecap="round">
              <path d="M136,64 L142,70 M146,62 L142,70 M136,78 L142,70 M148,74 L142,70" />
            </g>
          )}
        </motion.g>
      </motion.g>

      {!deceased && expression === "thinking" && (
        <g fill="#f4ead2">
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={150 + i * 11}
              cy={46 - i * 7}
              r={3 + i}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

export const Portrait = memo(PortraitImpl);

import { cn } from "@/lib/utils";

/*
 * Illustrations originales de Tamurt Market (DA « miel ») : objets d'occasion qui changent de
 * mains entre la France et l'Algérie. Purement décoratives (aria-hidden). Les fonds suivent le
 * thème (variables CSS) ; les objets gardent leurs couleurs. Animations mk-* arrêtées si
 * l'utilisateur limite les mouvements.
 */

const HONEY = "#f6a609";
const HONEY_DEEP = "#ef8e00";
const HONEY_LIGHT = "#ffc53d";
const OCHRE = "#8a5300";
const TERRA = "#ad502c";
const TERRA_LIGHT = "#e08a62";
const CREAM = "#fff3d6";
const INK = "#1d1b19";
const SKY = "#4f7cac";
const SAGE = "#5e8c61";

function Sparkle({ x, y, size, color = HONEY, delay = 0 }: { x: number; y: number; size: number; color?: string; delay?: number }) {
  const k = size * 0.22;
  return (
    <path
      className="mk-twinkle"
      style={{ animationDelay: `${delay}s` }}
      d={`M${x} ${y - size}C${x + k} ${y - k} ${x + k} ${y - k} ${x + size} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + size}C${x - k} ${y + k} ${x - k} ${y + k} ${x - size} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - size}Z`}
      fill={color}
    />
  );
}

function Sneaker({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path d="M0 30C0 18 6 8 18 6l14 10c6 4 14 6 26 6 12 0 20 6 20 14v4H0Z" fill="#ffffff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M0 34h78v6a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4Z" fill={TERRA} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 14 30 20M28 10 36 16" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 24c8 0 14 2 18 6" stroke={HONEY} strokeWidth="4" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Phone({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect width="46" height="82" rx="9" fill={INK} />
      <rect x="5" y="9" width="36" height="62" rx="4" fill={HONEY_LIGHT} />
      <circle cx="23" cy="34" r="10" fill="#ffffff" opacity="0.9" />
      <path d="M17 34l4 4 8-8" stroke={OCHRE} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="11" y="52" width="24" height="5" rx="2.5" fill="#ffffff" opacity="0.8" />
    </g>
  );
}

function Book({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect width="56" height="72" rx="4" fill={SKY} stroke={INK} strokeWidth="2.5" />
      <rect x="6" width="8" height="72" fill="#3d6591" />
      <rect x="22" y="16" width="26" height="6" rx="2" fill="#ffffff" />
      <rect x="22" y="28" width="18" height="5" rx="2" fill="#ffffff" opacity="0.7" />
      <path d="M22 50 30 42 38 50 46 42" stroke={HONEY_LIGHT} strokeWidth="3" fill="none" strokeLinejoin="round" />
    </g>
  );
}

/** Jarre en terre cuite ornée d'un zigzag et de losanges (poterie kabyle stylisée). */
function Jar({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M14 0h28v8c10 6 16 18 16 32 0 20-12 34-30 34S-2 60-2 40C-2 26 4 14 14 8Z" fill={TERRA_LIGHT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="10" y="-4" width="36" height="8" rx="3" fill={TERRA} stroke={INK} strokeWidth="2.5" />
      <path d="M4 30 12 24 20 30 28 24 36 30 44 24 52 30" stroke={INK} strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      <path d="M18 46 24 40 30 46 24 52Z M34 46 40 40 46 46 40 52Z" fill={INK} />
    </g>
  );
}

function Tag({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path d="M0 10 10 0h52a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H10L0 30Z" fill={CREAM} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="12" cy="20" r="4" fill="none" stroke={INK} strokeWidth="2.5" />
      <rect x="24" y="12" width="32" height="7" rx="3" fill={HONEY_DEEP} />
      <rect x="24" y="24" width="22" height="5" rx="2.5" fill={OCHRE} opacity="0.6" />
    </g>
  );
}

function Bubble({ x, y, color, children, tail = "left" }: { x: number; y: number; color: string; children?: React.ReactNode; tail?: "left" | "right" }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="70" height="44" rx="14" fill={color} stroke={INK} strokeWidth="2.5" />
      <path d={tail === "left" ? "M14 42 8 56 26 43" : "M56 42 62 56 44 43"} fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {children}
    </g>
  );
}

function Box({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* Rabats ouverts */}
      <path d="M0 0-26-26 54-30 80 0Z" fill="#d79a52" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M200 0 226-26 146-30 120 0Z" fill="#d79a52" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M0 0h200v110a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8Z" fill="#e8b067" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M0 0 100 26 200 0" fill="#c98a41" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="84" y="26" width="32" height="92" fill={HONEY_LIGHT} opacity="0.65" />
      <rect x="22" y="60" width="48" height="30" rx="4" fill={CREAM} stroke={INK} strokeWidth="2" />
      <path d="M30 70h30M30 79h20" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/** Bandeau d'accueil : un colis ouvert d'où sortent des objets, une conversation et la route France–Algérie. */
export function MarketHeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 440" aria-hidden className={cn("h-auto w-full", className)}>
      <circle cx="270" cy="230" r="190" fill="var(--primary-soft)" />
      <circle cx="420" cy="110" r="70" fill="var(--accent-soft)" />

      {/* Route France – Algérie */}
      <path d="M86 92C150 30 300 24 384 70" fill="none" stroke={OCHRE} strokeOpacity="0.7" strokeWidth="2.5" strokeDasharray="3 9" strokeLinecap="round" className="mk-dash" />
      {[
        [86, 92, HONEY],
        [384, 70, TERRA],
      ].map(([x, y, c], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 0C-7-8-10-12-10-17a10 10 0 1 1 20 0c0 5-3 9-10 17Z" fill={c as string} stroke={INK} strokeWidth="2" />
          <circle cy="-17" r="4" fill="#ffffff" />
        </g>
      ))}

      {/* Les objets qui sortent du colis */}
      <g className="mk-float" style={{ animationDelay: "0.2s" }}>
        <Book x={150} y={130} rotate={-14} />
      </g>
      <g className="mk-float" style={{ animationDelay: "1s" }}>
        <Phone x={318} y={118} rotate={12} />
      </g>
      <g className="mk-float" style={{ animationDelay: "1.6s" }}>
        <Jar x={236} y={150} />
      </g>
      <g className="mk-float" style={{ animationDelay: "0.6s" }}>
        <Sneaker x={360} y={226} rotate={-8} />
      </g>
      <Box x={150} y={262} />

      {/* Conversation entre acheteur et vendeur */}
      <g className="mk-bob">
        <Bubble x={28} y={176} color="#ffffff">
          <circle cx="22" cy="22" r="4" fill={INK} />
          <circle cx="35" cy="22" r="4" fill={INK} />
          <circle cx="48" cy="22" r="4" fill={INK} />
        </Bubble>
      </g>
      <g className="mk-bob" style={{ animationDelay: "1.2s" }}>
        <Bubble x={34} y={248} color={HONEY} tail="right">
          <path d="M35 33c-9-6-14-10-14-15a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 5-5 9-14 15Z" fill={TERRA} />
        </Bubble>
      </g>
      <g className="mk-float" style={{ animationDelay: "2.2s" }}>
        <Tag x={404} y={318} rotate={-12} />
      </g>

      <Sparkle x={210} y={92} size={10} />
      <Sparkle x={470} y={210} size={8} color={TERRA} delay={0.8} />
      <Sparkle x={120} y={360} size={7} delay={1.5} />
      <Sparkle x={300} y={64} size={6} color={SAGE} delay={2.1} />
    </svg>
  );
}

/** Étape 1 : photographier l'objet avec son téléphone. */
export function PhotoStepSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" aria-hidden className={cn("h-auto", className)}>
      <circle cx="100" cy="78" r="64" fill="var(--primary-soft)" />
      <g className="mk-float">
        <Jar x={34} y={58} scale={0.85} />
      </g>
      <g transform="translate(96 22) rotate(8)">
        <rect width="64" height="112" rx="12" fill={INK} />
        <rect x="6" y="12" width="52" height="84" rx="6" fill="#ffffff" />
        <path d="M14 24h8M14 24v8M50 24h-8M50 24v8M14 86h8M14 86v-8M50 86h-8M50 86v-8" stroke={HONEY_DEEP} strokeWidth="3" strokeLinecap="round" />
        <Jar x={19} y={44} scale={0.48} />
        <circle cx="32" cy="104" r="5" fill="#ffffff" opacity="0.8" />
      </g>
      <Sparkle x={178} y={30} size={9} />
      <Sparkle x={86} y={18} size={6} color={TERRA} delay={0.9} />
    </svg>
  );
}

/** Étape 2 : échanger dans la messagerie protégée. */
export function ChatStepSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" aria-hidden className={cn("h-auto", className)}>
      <circle cx="100" cy="78" r="64" fill="var(--accent-soft)" />
      <g className="mk-bob">
        <Bubble x={26} y={30} color="#ffffff">
          <rect x="14" y="13" width="42" height="6" rx="3" fill={INK} opacity="0.75" />
          <rect x="14" y="25" width="28" height="6" rx="3" fill={INK} opacity="0.4" />
        </Bubble>
      </g>
      <g className="mk-bob" style={{ animationDelay: "1s" }}>
        <Bubble x={98} y={72} color={HONEY} tail="right">
          <path d="M24 22l8 8 16-16" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Bubble>
      </g>
      <g transform="translate(150 22)">
        <rect width="34" height="40" rx="8" fill={SAGE} stroke={INK} strokeWidth="2.5" />
        <path d="M10 14a7 7 0 0 1 14 0v4" stroke="#ffffff" strokeWidth="3" fill="none" />
        <rect x="8" y="18" width="18" height="14" rx="3" fill="#ffffff" />
      </g>
      <Sparkle x={30} y={124} size={8} delay={0.5} />
    </svg>
  );
}

/** Étape 3 : expédier ou remettre en main propre. */
export function ShipStepSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" aria-hidden className={cn("h-auto", className)}>
      <circle cx="100" cy="78" r="64" fill="var(--primary-soft)" />
      <path d="M20 120C60 96 120 132 182 104" fill="none" stroke={OCHRE} strokeOpacity="0.6" strokeWidth="2.5" strokeDasharray="3 8" strokeLinecap="round" className="mk-dash" />
      <g className="mk-float">
        <g transform="translate(56 40)">
          <path d="M0 14 44 0 88 14 44 28Z" fill="#d79a52" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M0 14v46l44 14V28Z" fill="#e8b067" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M88 14v46L44 74V28Z" fill="#c98a41" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M22 7 66 21v18" stroke={HONEY_LIGHT} strokeWidth="6" fill="none" />
          <rect x="54" y="42" width="24" height="14" rx="2" fill={CREAM} stroke={INK} strokeWidth="2" transform="skewY(-18)" />
        </g>
      </g>
      <g transform="translate(150 26)">
        <circle r="16" fill={SAGE} stroke={INK} strokeWidth="2.5" />
        <path d="M-7 0l5 5 9-10" stroke="#ffffff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Sparkle x={34} y={40} size={7} color={TERRA} delay={1.2} />
    </svg>
  );
}

/** Bandeau Tamurt Transport : une camionnette chargée de colis, la mer et la route entre les deux rives. */
export function TransportSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" aria-hidden className={cn("h-auto", className)}>
      {/* La mer entre les deux rives : deux vagues légères, sans aplat. */}
      <path d="M20 128c18-7 36-7 54 0s36 7 54 0 36-7 54 0 36 7 54 0" fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 142c16-6 32-6 48 0s32 6 48 0 32-6 48 0" fill="none" stroke={INK} strokeOpacity="0.2" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 70C80 20 160 20 216 64" fill="none" stroke={INK} strokeOpacity="0.55" strokeWidth="2.5" strokeDasharray="3 9" strokeLinecap="round" className="mk-dash" />
      <g className="mk-bob">
        <g transform="translate(58 58)">
          <path d="M0 10a8 8 0 0 1 8-8h70v52H0Z" fill={CREAM} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M78 18h24l18 20v16H78Z" fill="#ffffff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M84 24h16l11 13H84Z" fill={SKY} opacity="0.6" />
          <rect x="12" y="14" width="22" height="18" rx="2" fill="#e8b067" stroke={INK} strokeWidth="2" />
          <rect x="40" y="18" width="26" height="22" rx="2" fill="#d79a52" stroke={INK} strokeWidth="2" />
          <circle cx="24" cy="56" r="10" fill={INK} />
          <circle cx="24" cy="56" r="4" fill={CREAM} />
          <circle cx="98" cy="56" r="10" fill={INK} />
          <circle cx="98" cy="56" r="4" fill={CREAM} />
        </g>
      </g>
      <g transform="translate(24 70)">
        <path d="M0 0C-7-8-10-12-10-17a10 10 0 1 1 20 0c0 5-3 9-10 17Z" fill={CREAM} stroke={INK} strokeWidth="2" />
      </g>
      <g transform="translate(216 64)">
        <path d="M0 0C-7-8-10-12-10-17a10 10 0 1 1 20 0c0 5-3 9-10 17Z" fill={TERRA} stroke={INK} strokeWidth="2" />
      </g>
    </svg>
  );
}

/** Couleurs des tuiles de catégories, dans l'ordre d'affichage (fond teinté selon le thème). */
export const CATEGORY_TILE_COLORS = [HONEY, TERRA_LIGHT, SAGE, SKY, "#9b7bd4", "#d9748f", "#c9a26b", "#4fa3a5"];

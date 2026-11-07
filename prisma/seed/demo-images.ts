import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import sharp from "sharp";

/**
 * Visuels de démonstration générés localement (dégradé + pictogramme Lucide, licence ISC),
 * explicitement marqués « visuel de démonstration ». Aucune photo réelle ni image tierce.
 */
const require = createRequire(import.meta.url);

type IconNode = [string, Record<string, string>][];
const iconCache = new Map<string, IconNode>();

/** Extrait le littéral `__iconData` (objets, tableaux et chaînes uniquement) en respectant chaînes et imbrication. */
function extractIconLiteral(source: string): string {
  const begin = source.indexOf("{", source.indexOf("const __iconData"));
  let depth = 0;
  let quote: string | null = null;
  for (let i = begin; i < source.length; i++) {
    const ch = source[i]!;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return source.slice(begin, i + 1);
    }
  }
  throw new Error("Icône illisible");
}

async function loadIcon(name: string): Promise<IconNode> {
  const cached = iconCache.get(name);
  if (cached) return cached;
  const dir = path.dirname(require.resolve("lucide-react/package.json"));
  const source = await readFile(path.join(dir, "dist/esm/icons", `${name}.mjs`), "utf8");
  // Littéral de données d'une dépendance installée (lucide-react) : objets et chaînes, sans code.
  const data = new Function(`return (${extractIconLiteral(source)});`)() as { node: IconNode };
  iconCache.set(name, data.node);
  return data.node;
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

function nodeToSvg(node: IconNode) {
  return node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${v}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
}

export async function demoImage(icon: string, hue: number, variant: number): Promise<Buffer> {
  const node = await loadIcon(icon);
  const light = hslToHex(hue, 38, 93);
  const mid = hslToHex(hue + 12, 42, 80);
  const ink = hslToHex(hue, 45, 26);
  const W = 1200;
  const H = 900;
  const transforms = [
    `translate(600 410) scale(15) translate(-12 -12)`,
    `translate(640 430) rotate(-12) scale(17) translate(-12 -12)`,
    `translate(560 400) rotate(9) scale(12) translate(-12 -12)`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="${variant === 1 ? 680 : 600}" cy="${variant === 2 ? 380 : 420}" r="${260 - variant * 30}" fill="#ffffff" fill-opacity="0.38"/>
  <circle cx="1040" cy="140" r="90" fill="#ffffff" fill-opacity="0.18"/>
  <g transform="${transforms[variant % 3]}" fill="none" stroke="${ink}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${nodeToSvg(node)}</g>
  <rect x="330" y="785" width="540" height="56" rx="28" fill="#ffffff" fill-opacity="0.7"/>
  <text x="600" y="822" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-size="26" font-weight="500" fill="${ink}">Visuel de démonstration · article fictif</text>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

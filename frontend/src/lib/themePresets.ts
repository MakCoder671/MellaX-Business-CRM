// ----------------------------------------------------------------------------
// Every color/design the app's theme system can use — pre-made presets
// only, no free-form color picker. Most business owners aren't designers,
// and a "blend your own colors" tool just leads to bad-looking (sometimes
// unreadable) combinations, so personalization here means "pick from a
// curated set," organized into Solid / Gradient / Design tabs so it's
// obvious what kind of look each option gives before picking it.
//
// This is the ONE place these presets are defined. The account only ever
// stores which preset id was picked per surface (see accounts/models.py)
// — applyTheme() below reads the matching presets from here and turns
// them into real CSS custom properties that the rest of the app reads
// from (Button, the sidebar, the Calendar widget, etc). Change a color
// here and it updates everywhere that preset is used, with no migration
// needed.
//
// Two independent surfaces:
//   - Buttons: primary buttons, focus rings, the sidebar's wordmark and
//     active-link indicator, and other "selected"/active-tab indicators
//     around Settings/Reports/Marketing.
//   - Background: the page background, painted ONCE across the whole
//     dashboard shell (sidebar, header, and content all share the exact
//     same background — see dashboard/layout.tsx) rather than the
//     sidebar getting its own separate-but-coordinated color. Per Mako:
//     the sidebar and the page background should just be the same
//     thing, so there's nothing that can clash.
//
// Calendar Color (Settings > Calendar) reuses the same 14-family accent
// list as Buttons, applied to a different surface again (appointment
// blocks, today's highlight, the Day/Week/Month toggle, and the
// calendar's own grid lines/borders).
// ----------------------------------------------------------------------------

export type PresetKind = "solid" | "gradient" | "design";

export type AccentPresetId =
  | "emerald"
  | "teal"
  | "ocean"
  | "lagoon"
  | "indigo"
  | "grape"
  | "twilight"
  | "berry"
  | "rose"
  | "crimson"
  | "sunset"
  | "amber"
  | "slate"
  | "midnight";

export type BackgroundPresetId =
  | "default"
  | `${AccentPresetId}-tint`
  | "ocean"
  | "jungle"
  | "sunset"
  | "berry"
  | "amber"
  | "tropical"
  | "horizon"
  | "waves"
  | "summit";

export type AccentPreset = {
  id: AccentPresetId;
  label: string;
  kind: "solid" | "gradient";
  // What the button/badge background actually renders as - a flat hex for
  // "solid" presets, a real CSS gradient for "gradient" ones. Applied via
  // the --accent-bg / --cal-bg custom properties (see applyTheme below),
  // never through a Tailwind bg-[...] class, since Tailwind can't safely
  // infer "this arbitrary value is a gradient, not a color" on its own.
  bg: string;
  // Flat shade ramp, used everywhere a real color (not a gradient) is
  // needed - text, borders, focus rings, the today badge, etc. Gradient
  // presets still get one so those surfaces stay coherent with the
  // gradient's own color family instead of looking mismatched.
  shades: { 50: string; 100: string; 300: string; 500: string; 600: string; 700: string; 800: string };
  // Which text color actually reads clearly on top of this preset's
  // solid backgrounds (buttons, appointment blocks, the today badge).
  // White works for almost every family here, but a light, warm color
  // like Amber is bright enough that white text on it fails contrast —
  // picked per family instead of hardcoded, so nothing ever renders
  // low-contrast text no matter which preset gets chosen.
  onColor: string;
};

// A halo behind onColor text (a dark shadow behind white text, a light
// one behind dark text) - the same trick used for subtitles over video
// or headlines over a photo. A flat onColor alone is only tuned for ONE
// exact shade; a gradient preset's block isn't one flat shade across its
// whole width, and a business can still pick colors that land
// in-between what was tuned for. The halo is what makes text actually
// hold up regardless of precisely what's behind it, instead of only in
// the one spot it was checked against. Two layers - a tight, strong one
// for crisp edges right at the glyph, a wider softer one behind that -
// reads as noticeably brighter/crisper than a single soft shadow, which
// tends to just look like a blur instead of actually making the text pop.
function shadowFor(onColor: string) {
  return onColor === "#ffffff"
    ? "0 1px 1px rgba(0,0,0,0.8), 0 1px 6px rgba(0,0,0,0.5)"
    : "0 1px 1px rgba(255,255,255,0.85), 0 1px 6px rgba(255,255,255,0.6)";
}


export type BackgroundPreset = {
  id: BackgroundPresetId;
  label: string;
  kind: PresetKind;
  css: string; // solid color, gradient, or (for "design") an SVG image layer + gradient fallback
  swatch: string; // a flatter, cheaper-to-render preview for the picker's little swatch circle
  // "design" presets only - just the bare SVG image (no gradient behind
  // it), rendered a second time pinned to the bottom of the sidebar (see
  // dashboard/layout.tsx). The main content area's copy (in `css` above)
  // only shows on pages short enough to leave open space below their
  // last card - on a content-heavy page like Overview it can end up
  // scrolled out of view entirely, but the sidebar always has empty
  // space below its nav links, on every page, so that's where this
  // guarantees the art is actually seen.
  artUrl?: string;
};

// 14 curated color families - covers the color wheel (two greens, two
// blues, three purples/pinks-leaning-purple, two reds/pinks, two
// oranges/yellows, two neutrals) with real variety without turning into
// an overwhelming wall of near-duplicate swatches.
export const ACCENT_PRESETS: Record<AccentPresetId, AccentPreset> = {
  emerald: {
    id: "emerald",
    label: "Emerald",
    kind: "solid",
    bg: "#059669",
    shades: { 50: "#ecfdf5", 100: "#d1fae5", 300: "#6ee7b7", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46" },
    onColor: "#ffffff",
  },
  teal: {
    id: "teal",
    label: "Teal",
    kind: "solid",
    bg: "#0d9488",
    shades: { 50: "#f0fdfa", 100: "#ccfbf1", 300: "#5eead4", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59" },
    onColor: "#ffffff",
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    kind: "gradient",
    bg: "linear-gradient(135deg, #38bdf8, #2563eb)",
    shades: { 50: "#eff6ff", 100: "#dbeafe", 300: "#93c5fd", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af" },
    onColor: "#ffffff",
  },
  lagoon: {
    id: "lagoon",
    label: "Lagoon",
    kind: "gradient",
    bg: "linear-gradient(135deg, #2dd4bf, #0891b2)",
    shades: { 50: "#ecfeff", 100: "#cffafe", 300: "#67e8f9", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75" },
    onColor: "#ffffff",
  },
  indigo: {
    id: "indigo",
    label: "Indigo",
    kind: "solid",
    bg: "#4f46e5",
    shades: { 50: "#eef2ff", 100: "#e0e7ff", 300: "#a5b4fc", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3" },
    onColor: "#ffffff",
  },
  grape: {
    id: "grape",
    label: "Grape",
    kind: "solid",
    bg: "#9333ea",
    shades: { 50: "#faf5ff", 100: "#f3e8ff", 300: "#d8b4fe", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce", 800: "#6b21a8" },
    onColor: "#ffffff",
  },
  twilight: {
    id: "twilight",
    label: "Twilight",
    kind: "gradient",
    bg: "linear-gradient(135deg, #818cf8, #7c3aed)",
    shades: { 50: "#f5f3ff", 100: "#ede9fe", 300: "#c4b5fd", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6" },
    onColor: "#ffffff",
  },
  berry: {
    id: "berry",
    label: "Berry",
    kind: "gradient",
    bg: "linear-gradient(135deg, #c084fc, #db2777)",
    shades: { 50: "#fdf4ff", 100: "#fae8ff", 300: "#f0abfc", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f" },
    onColor: "#ffffff",
  },
  rose: {
    id: "rose",
    label: "Rose",
    kind: "solid",
    bg: "#e11d48",
    shades: { 50: "#fff1f2", 100: "#ffe4e6", 300: "#fda4af", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239" },
    onColor: "#ffffff",
  },
  crimson: {
    id: "crimson",
    label: "Crimson",
    kind: "solid",
    bg: "#dc2626",
    shades: { 50: "#fef2f2", 100: "#fee2e2", 300: "#fca5a5", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b" },
    onColor: "#ffffff",
  },
  sunset: {
    id: "sunset",
    label: "Sunset",
    kind: "gradient",
    bg: "linear-gradient(135deg, #fb923c, #e11d48)",
    shades: { 50: "#fff7ed", 100: "#ffedd5", 300: "#fdba74", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412" },
    // Orange is a warm, bright hue the same way Amber is - white text on
    // it reads flat/washed-out rather than popping. A dark shade of the
    // SAME warm hue (a brown) doesn't actually fix that either - it
    // technically passes a contrast-ratio check, but the eye still reads
    // "same color family, barely different," not "clearly a different,
    // readable label." A genuinely neutral near-black (no hue of its own)
    // is what actually pops against a warm background - see amber below.
    onColor: "#1c1917",
  },
  amber: {
    id: "amber",
    label: "Amber",
    kind: "solid",
    bg: "#d97706",
    shades: { 50: "#fffbeb", 100: "#fef3c7", 300: "#fcd34d", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e" },
    // Same reasoning as Sunset above - a neutral near-black, not a dark
    // amber/brown, is what actually reads as legible against a warm
    // background instead of just "a slightly darker version of it."
    onColor: "#1c1917",
  },
  slate: {
    id: "slate",
    label: "Slate",
    kind: "solid",
    bg: "#475569",
    shades: { 50: "#f8fafc", 100: "#f1f5f9", 300: "#cbd5e1", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b" },
    onColor: "#ffffff",
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    kind: "solid",
    bg: "#1e293b",
    shades: { 50: "#f8fafc", 100: "#e2e8f0", 300: "#94a3b8", 500: "#334155", 600: "#1e293b", 700: "#0f172a", 800: "#020617" },
    onColor: "#ffffff",
  },
};

// ----------------------------------------------------------------------------
// Design backgrounds — small, flat-style illustrated SCENES (actual palm
// trees, a sun, birds, a boat, mountains with pine trees — not just an
// abstract color wash) rendered as inline SVG, anchored to the bottom of
// the viewport (background-attachment: fixed, set in dashboard/layout.tsx)
// like a horizon strip, so they read as real personality without ever
// competing with the actual data on screen above them. Built as plain
// shapes (no external image files/fonts, no licensing to think about),
// in a flat corporate-illustration style rather than photorealistic -
// this is the backdrop of a business tool, not the main event.
// ----------------------------------------------------------------------------

function svgUrl(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// A single pointed palm frond, drawn pointing straight up from the
// origin — wrapped in a translate+rotate transform by palmTree() below,
// so the fan of fronds doesn't need any trigonometry done by hand here.
function frond(length: number, color: string) {
  const w = length * 0.22;
  return `<path d="M0,0 Q${-w},${-length * 0.55} 0,${-length} Q${w},${-length * 0.55} 0,0 Z" fill="${color}"/>`;
}

// An actual little coconut tree: a tapered, slightly-leaning trunk with
// a few bark-texture strokes, a fan of six pointed fronds at varied
// angles (not just a symmetric starburst - real palms droop unevenly),
// and a small cluster of coconuts where the fronds meet the trunk.
function palmTree(x: number, groundY: number, s: number, trunkColor: string, frondColor: string) {
  const h = 72 * s;
  const leanX = x - 10 * s;
  const trunk = `<path d="M${x - 4 * s},${groundY} Q${x - 15 * s},${groundY - h * 0.5} ${leanX},${groundY - h} L${leanX + 7 * s},${groundY - h} Q${x + 3 * s},${groundY - h * 0.5} ${x + 4 * s},${groundY} Z" fill="${trunkColor}"/>`;
  const bark = [0.3, 0.5, 0.7, 0.85]
    .map((t) => {
      const bx = x - 4 * s + (leanX - (x - 4 * s)) * t;
      const by = groundY - h * t;
      return `<line x1="${bx - 5 * s}" y1="${by + 3 * s}" x2="${bx + 5 * s}" y2="${by - 3 * s}" stroke="${trunkColor}" stroke-width="${1.4 * s}" opacity="0.45"/>`;
    })
    .join("");
  const crownX = leanX + 3 * s;
  const crownY = groundY - h;
  const fronds = [-65, -32, -4, 24, 52, 80]
    .map((angle) => `<g transform="translate(${crownX},${crownY}) rotate(${angle})">${frond(46 * s, frondColor)}</g>`)
    .join("");
  const coconuts = [
    [-3, 5],
    [3, 7],
    [0, 11],
  ]
    .map(([dx, dy]) => `<circle cx="${crownX + dx * s}" cy="${crownY + dy * s}" r="${3.6 * s}" fill="#78350f"/>`)
    .join("");
  return `${trunk}${bark}${fronds}${coconuts}`;
}

// A simple double-curve bird silhouette (like a flattened "M"), the flat
// -illustration standby for "there's sky here."
function bird(x: number, y: number, s: number, color: string) {
  return `<path d="M${x - 8 * s},${y} Q${x - 3 * s},${y - 6 * s} ${x},${y} Q${x + 3 * s},${y - 6 * s} ${x + 8 * s},${y}" stroke="${color}" stroke-width="${1.6 * s}" fill="none" stroke-linecap="round"/>`;
}

function sailboat(x: number, y: number, s: number) {
  return `<path d="M${x},${y} L${x},${y - 38 * s} L${x + 22 * s},${y - 6 * s} Z" fill="#f8fafc" opacity="0.95"/>
    <path d="M${x},${y} L${x},${y - 30 * s} L${x - 16 * s},${y - 6 * s} Z" fill="#e2e8f0" opacity="0.95"/>
    <path d="M${x - 14 * s},${y} Q${x},${y + 10 * s} ${x + 16 * s},${y} L${x + 12 * s},${y + 4 * s} L${x - 10 * s},${y + 4 * s} Z" fill="#0c4a6e"/>`;
}

function pine(x: number, groundY: number, s: number, color: string) {
  return `<path d="M${x},${groundY - 40 * s} L${x + 14 * s},${groundY - 14 * s} L${x + 7 * s},${groundY - 14 * s} L${x + 18 * s},${groundY} L${x - 18 * s},${groundY} L${x - 7 * s},${groundY - 14 * s} L${x - 14 * s},${groundY - 14 * s} Z" fill="${color}"/>`;
}

const TROPICAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="220" viewBox="0 0 500 220">
  <circle cx="250" cy="55" r="26" fill="#fde68a" opacity="0.9"/>
  <path d="M0,205 Q250,185 500,208 V220 H0 Z" fill="#fde68a" opacity="0.55"/>
  ${palmTree(70, 200, 1.15, "#78350f", "#065f46")}
  ${palmTree(135, 212, 0.75, "#92400e", "#047857")}
  ${palmTree(420, 195, 1.25, "#78350f", "#065f46")}
  ${palmTree(465, 210, 0.7, "#92400e", "#047857")}
</svg>`;

const HORIZON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="220" viewBox="0 0 500 220">
  <ellipse cx="400" cy="50" rx="34" ry="12" fill="#fecdd3" opacity="0.7"/>
  <ellipse cx="425" cy="42" rx="24" ry="9" fill="#fecdd3" opacity="0.6"/>
  ${bird(90, 60, 1.4, "#be123c")}
  ${bird(115, 45, 1.1, "#be123c")}
  ${bird(360, 70, 1.3, "#be123c")}
  <circle cx="250" cy="145" r="52" fill="#fb923c"/>
  <path d="M0,175 Q125,150 250,168 T500,160 V220 H0 Z" fill="#fda4af" opacity="0.85"/>
  <path d="M0,200 Q150,182 300,198 T500,190 V220 H0 Z" fill="#e11d48" opacity="0.6"/>
</svg>`;

const WAVES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="220" viewBox="0 0 500 220">
  ${bird(120, 40, 1.2, "#0369a1")}
  ${bird(150, 55, 1, "#0369a1")}
  ${bird(340, 35, 1.1, "#0369a1")}
  ${sailboat(370, 130, 1.3)}
  <path d="M0,150 C125,130 125,170 250,150 C375,130 375,170 500,150 V220 H0 Z" fill="#7dd3fc" opacity="0.55"/>
  <path d="M0,175 C125,155 125,195 250,175 C375,155 375,195 500,175 V220 H0 Z" fill="#38bdf8" opacity="0.65"/>
  <path d="M0,198 C125,182 125,214 250,198 C375,182 375,214 500,198 V220 H0 Z" fill="#0284c7" opacity="0.75"/>
</svg>`;

const SUMMIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="220" viewBox="0 0 500 220">
  <circle cx="250" cy="60" r="30" fill="#fef3c7" opacity="0.9"/>
  <polygon points="0,220 90,110 180,190 260,90 340,180 420,120 500,220" fill="#a5b4fc" opacity="0.55"/>
  <polygon points="0,220 140,150 250,210 380,140 500,220" fill="#818cf8" opacity="0.7"/>
  ${pine(60, 218, 1, "#3730a3")}
  ${pine(95, 220, 0.8, "#4338ca")}
  ${pine(430, 218, 1.1, "#3730a3")}
  <polygon points="0,220 200,180 320,220" fill="#6366f1" opacity="0.85"/>
</svg>`;

// Solid background tints — every accent family's palest shade, used flat
// as a page background — built from ACCENT_PRESETS instead of listed by
// hand so the two stay in sync automatically.
const TINT_PRESETS: Record<string, BackgroundPreset> = Object.fromEntries(
  Object.values(ACCENT_PRESETS).map((accent) => [
    `${accent.id}-tint`,
    {
      id: `${accent.id}-tint` as BackgroundPresetId,
      label: `${accent.label} Tint`,
      kind: "solid" as const,
      css: accent.shades[50],
      swatch: accent.shades[50],
    },
  ])
);

export const BACKGROUND_PRESETS: Record<BackgroundPresetId, BackgroundPreset> = {
  default: { id: "default", label: "Default", kind: "solid", css: "#f9fafb", swatch: "#f9fafb" },
  ...(TINT_PRESETS as Record<`${AccentPresetId}-tint`, BackgroundPreset>),

  // Gradients - soft two-tone washes, no imagery.
  ocean: {
    id: "ocean",
    label: "Ocean Theme",
    kind: "gradient",
    css: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)",
    swatch: "linear-gradient(135deg, #eff6ff, #bfdbfe)",
  },
  jungle: {
    id: "jungle",
    label: "Jungle Theme",
    kind: "gradient",
    css: "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 100%)",
    swatch: "linear-gradient(135deg, #f0fdf4, #bbf7d0)",
  },
  sunset: {
    id: "sunset",
    label: "Sunset Theme",
    kind: "gradient",
    css: "linear-gradient(180deg, #fff7ed 0%, #fdf2f8 100%)",
    swatch: "linear-gradient(135deg, #fff7ed, #fbcfe8)",
  },
  berry: {
    id: "berry",
    label: "Berry Theme",
    kind: "gradient",
    css: "linear-gradient(180deg, #fdf4ff 0%, #f8fafc 100%)",
    swatch: "linear-gradient(135deg, #fdf4ff, #f5d0fe)",
  },
  amber: {
    id: "amber",
    label: "Amber Theme",
    kind: "gradient",
    css: "linear-gradient(180deg, #fffbeb 0%, #f8fafc 100%)",
    swatch: "linear-gradient(135deg, #fffbeb, #fde68a)",
  },

  // Designs - an illustrated horizon strip (see the SVGs above) anchored
  // to the bottom of the screen, over a matching sky gradient. Also gets
  // a guaranteed-visible copy pinned to the sidebar's open space (see
  // artUrl above) since the main content area's copy alone can end up
  // hidden behind a tall page's content.
  tropical: {
    id: "tropical",
    label: "Tropical",
    kind: "design",
    css: `${svgUrl(TROPICAL_SVG)} bottom / 100% 220px no-repeat, linear-gradient(180deg, #d1fae5 0%, #f8fafc 65%)`,
    swatch: "linear-gradient(180deg, #6ee7b7, #065f46)",
    artUrl: svgUrl(TROPICAL_SVG),
  },
  horizon: {
    id: "horizon",
    label: "Sunset Horizon",
    kind: "design",
    css: `${svgUrl(HORIZON_SVG)} bottom / 100% 220px no-repeat, linear-gradient(180deg, #fef3c7 0%, #fdf2f8 65%)`,
    swatch: "linear-gradient(180deg, #fdba74, #e11d48)",
    artUrl: svgUrl(HORIZON_SVG),
  },
  waves: {
    id: "waves",
    label: "Ocean Waves",
    kind: "design",
    css: `${svgUrl(WAVES_SVG)} bottom / 100% 220px no-repeat, linear-gradient(180deg, #e0f2fe 0%, #f8fafc 65%)`,
    swatch: "linear-gradient(180deg, #7dd3fc, #0284c7)",
    artUrl: svgUrl(WAVES_SVG),
  },
  summit: {
    id: "summit",
    label: "Mountain Summit",
    kind: "design",
    css: `${svgUrl(SUMMIT_SVG)} bottom / 100% 220px no-repeat, linear-gradient(180deg, #ede9fe 0%, #f8fafc 65%)`,
    swatch: "linear-gradient(180deg, #a5b4fc, #6366f1)",
    artUrl: svgUrl(SUMMIT_SVG),
  },
};

// Sets every CSS custom property a given accent preset drives, under the
// given prefix ("accent" for Buttons, "nav" for the sidebar, "cal" for
// Calendar Color) - e.g. prefix "accent" sets --accent-600, --accent-bg,
// --accent-on, etc. Separate prefixes exist purely so these surfaces can
// differ without overwriting each other's variables. --{prefix}-on is
// the preset's own onColor (see AccentPreset above) - whatever text
// color actually reads clearly on that preset's solid backgrounds,
// picked per family instead of assumed to always be white.
function applyAccent(target: CSSStyleDeclaration, prefix: string, preset: Pick<AccentPreset, "bg" | "shades" | "onColor">) {
  target.setProperty(`--${prefix}-bg`, preset.bg);
  target.setProperty(`--${prefix}-on`, preset.onColor);
  target.setProperty(`--${prefix}-on-shadow`, shadowFor(preset.onColor));
  for (const [shade, hex] of Object.entries(preset.shades)) {
    target.setProperty(`--${prefix}-${shade}`, hex);
  }
}

// Called once from AuthProvider whenever the account loads or changes -
// reads the preset ids off the account and turns them into CSS custom
// properties on <html>, which every themed element in the app reads from
// (Button, dashboard/layout.tsx's sidebar/header/background, and the
// Calendar widget's own components).
export function applyTheme(theme: {
  theme_accent?: AccentPresetId;
  theme_background?: BackgroundPresetId;
  calendar_accent?: AccentPresetId;
}) {
  if (typeof document === "undefined") return; // no-op during server rendering
  const root = document.documentElement.style;
  const backgroundId = theme.theme_background ?? "default";
  const background = BACKGROUND_PRESETS[backgroundId];
  applyAccent(root, "accent", ACCENT_PRESETS[theme.theme_accent ?? "emerald"]);
  applyAccent(root, "cal", ACCENT_PRESETS[theme.calendar_accent ?? "emerald"]);
  root.setProperty("--app-bg", background.css);
  root.setProperty("--app-art", background.artUrl ?? "none");
}

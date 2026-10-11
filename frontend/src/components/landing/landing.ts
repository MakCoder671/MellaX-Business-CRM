import type { CSSProperties } from "react";

import type { AccentPresetId } from "@/lib/themePresets";

// Shapes of what the backend's PublicLandingPageSerializer sends (see
// landingpages/serializers.py). Kept in one place so every section of the
// public page agrees on them.

export type PublicPhoto = { id: number; image: string; display_order: number };

export type PublicService = {
  id: number;
  name: string;
  description: string;
  price: string; // Django DecimalField comes back as a string — keeps the exact amount
  duration_minutes: number;
};

export type PublicHours = {
  day_of_week: number; // 0 = Monday ... 6 = Sunday (matches the backend)
  is_open: boolean;
  open_time: string | null; // "09:00:00"
  close_time: string | null;
};

export type PublicReview = {
  id: number;
  author_name: string;
  rating: number;
  text: string;
  created_at: string;
};

export type LandingFont = "modern" | "editorial" | "clean";
export type LandingCorners = "soft" | "square" | "round";
export type LandingBackground = "white" | "cream" | "mist" | "tint" | "charcoal";
export type LandingCards = "outline" | "shadow" | "flat";
export type HeroMark = "name" | "logo";

// The social networks the owner can add. "website" covers any other link.
export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "x"
  | "tiktok"
  | "youtube"
  | "yelp"
  | "pinterest"
  | "threads"
  | "snapchat"
  | "whatsapp"
  | "google"
  | "website";
export type SocialLink = { platform: SocialPlatform; url: string };

export type PublicLandingPage = {
  slug: string;
  business_name: string;
  blurb_text: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  logo: string | null;
  time_zone: string; // the business's own zone, so "open now" is right for the visitor
  landing_accent: AccentPresetId;
  landing_font: LandingFont;
  landing_corners: LandingCorners;
  landing_background: LandingBackground;
  landing_cards: LandingCards;
  hero_mark: HeroMark;
  social_links: SocialLink[];
  photos: PublicPhoto[];
  services: PublicService[];
  hours: PublicHours[];
  reviews: PublicReview[];
  average_rating: number | null;
  review_count: number;
  booking_available: boolean;
};

// The style knobs turned into Tailwind classes. Written once here so the public
// page and the owner's live preview always draw the same thing.
export function landingStyle(font: LandingFont, corners: LandingCorners, cards: LandingCards = "shadow") {
  const heading = {
    modern: "font-sans font-extrabold tracking-tight",
    editorial: "font-serif font-semibold tracking-tight",
    clean: "font-sans font-medium tracking-normal",
  }[font];
  const radius = {
    soft: { card: "rounded-2xl", button: "rounded-full", image: "rounded-2xl" },
    square: { card: "rounded-none", button: "rounded-none", image: "rounded-none" },
    round: { card: "rounded-3xl", button: "rounded-full", image: "rounded-3xl" },
  }[corners];
  // The look of every card: outlined, soft shadow, or flat. Uses the page's
  // own surface and line colors, so it reads right on a dark background too.
  const panel = {
    outline: "border border-[var(--lp-line)] bg-[var(--lp-surface)]",
    shadow: "border border-[var(--lp-line)] bg-[var(--lp-surface)] shadow-lg shadow-black/5",
    flat: "bg-[var(--lp-surface)]",
  }[cards];
  return { heading, panel, ...radius };
}

// The page's colors for each background choice. These are written as CSS
// variables on the page wrapper, and every section reads them, so one choice
// recolors the whole page at once.
const PALETTES: Record<LandingBackground, Record<"bg" | "surface" | "alt" | "text" | "muted" | "line" | "closing", string>> = {
  white: { bg: "#ffffff", surface: "#ffffff", alt: "#f8fafc", text: "#111827", muted: "#4b5563", line: "#e5e7eb", closing: "#111827" },
  cream: { bg: "#fbf7f0", surface: "#ffffff", alt: "#f4ecdd", text: "#2a2118", muted: "#6b5d4a", line: "#e8dcc6", closing: "#2a2118" },
  mist: { bg: "#eef2f6", surface: "#ffffff", alt: "#e2e8f0", text: "#0f172a", muted: "#475569", line: "#dbe3ec", closing: "#0f172a" },
  tint: {
    bg: "var(--accent-50,#ecfdf5)",
    surface: "#ffffff",
    alt: "var(--accent-100,#d1fae5)",
    text: "#0f172a",
    muted: "#475569",
    line: "rgba(15, 23, 42, 0.1)",
    closing: "var(--accent-800,#065f46)",
  },
  charcoal: { bg: "#0f172a", surface: "#1e293b", alt: "#131c2e", text: "#f8fafc", muted: "#cbd5e1", line: "#334155", closing: "#020617" },
};

// Form fields keep a light box with dark text, even on a dark page. The shared
// form component leaves those colors unset, so the landing forms set them here.
export const FORM_CONTROLS =
  "[&_input]:bg-white [&_input]:text-gray-900 [&_select]:bg-white [&_select]:text-gray-900 [&_textarea]:bg-white [&_textarea]:text-gray-900 [&_label]:text-[var(--lp-text)]";

export function landingPalette(background: LandingBackground): CSSProperties {
  const p = PALETTES[background];
  return {
    "--lp-bg": p.bg,
    "--lp-surface": p.surface,
    "--lp-alt": p.alt,
    "--lp-text": p.text,
    "--lp-muted": p.muted,
    "--lp-line": p.line,
    "--lp-closing": p.closing,
  } as CSSProperties;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dayName(dayOfWeek: number) {
  return DAY_NAMES[dayOfWeek];
}

// "14:30:00" -> "2:30 PM". Hours come straight from the backend as 24-hour
// clock strings, and visitors read them as 12-hour times.
export function formatClock(hhmmss: string) {
  const [h, m] = hhmmss.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// Google Maps accepts a plain search string and needs no API key.
export function mapsSearchUrl(addressParts: string[]) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParts.join(", "))}`;
}

export function formatPrice(price: string) {
  return `$${Number(price).toFixed(2)}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourPart = `${hours} hour${hours > 1 ? "s" : ""}`;
  return rest === 0 ? hourPart : `${hourPart} ${rest} min`;
}

// "Open now" depends on the business's own clock, not the visitor's, so it's
// worked out from the business timezone. Returns the label the info card shows.
export function openStatus(hours: PublicHours[], timeZone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const dayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  const minutes = hour * 60 + minute;

  const today = hours.find((h) => h.day_of_week === dayIndex);
  if (!today || !today.is_open || !today.open_time || !today.close_time) {
    return { open: false, label: "Closed today" };
  }
  const [oh, om] = today.open_time.split(":").map(Number);
  const [ch, cm] = today.close_time.split(":").map(Number);
  const openAt = oh * 60 + om;
  const closeAt = ch * 60 + cm;
  if (minutes >= openAt && minutes < closeAt) {
    return { open: true, label: `Open now · until ${formatClock(today.close_time)}` };
  }
  if (minutes < openAt) {
    return { open: false, label: `Closed now · opens ${formatClock(today.open_time)} today` };
  }
  return { open: false, label: "Closed now" };
}

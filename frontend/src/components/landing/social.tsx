import {
  type SimpleIcon,
  siFacebook,
  siGoogle,
  siInstagram,
  siPinterest,
  siSnapchat,
  siThreads,
  siTiktok,
  siWhatsapp,
  siX,
  siYelp,
  siYoutube,
} from "simple-icons";
import { Globe } from "lucide-react";

import type { SocialLink, SocialPlatform } from "./landing";

// Every network the owner can add, with its label and logo. The logos come from
// simple-icons, a set of modern, flat brand marks. "Website" has no brand, so it
// gets a plain globe instead.
export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string; icon: SimpleIcon | null }[] = [
  { id: "facebook", label: "Facebook", icon: siFacebook },
  { id: "instagram", label: "Instagram", icon: siInstagram },
  { id: "x", label: "X", icon: siX },
  { id: "tiktok", label: "TikTok", icon: siTiktok },
  { id: "youtube", label: "YouTube", icon: siYoutube },
  { id: "yelp", label: "Yelp", icon: siYelp },
  { id: "google", label: "Google Business", icon: siGoogle },
  { id: "pinterest", label: "Pinterest", icon: siPinterest },
  { id: "threads", label: "Threads", icon: siThreads },
  { id: "snapchat", label: "Snapchat", icon: siSnapchat },
  { id: "whatsapp", label: "WhatsApp", icon: siWhatsapp },
  { id: "website", label: "Website", icon: null },
];

export function platformLabel(id: SocialPlatform) {
  return SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? "Link";
}

// The logo for one network. It's drawn in the current text color, so it follows
// the page's own colors (light or dark) without extra styling.
export function SocialGlyph({ platform, className = "" }: { platform: SocialPlatform; className?: string }) {
  const icon = SOCIAL_PLATFORMS.find((p) => p.id === platform)?.icon;
  if (!icon) return <Globe className={className} aria-hidden="true" />;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}

// A row of round icon buttons. Each one opens the owner's link in a new tab.
// "dark" is for the footer, which sits on a dark band whatever the page color is.
export function SocialLinks({ links, tone = "page", className = "" }: { links: SocialLink[]; tone?: "page" | "dark"; className?: string }) {
  if (links.length === 0) return null;

  const idle =
    tone === "dark"
      ? "border-white/15 text-gray-300 hover:bg-white/10 hover:text-white"
      : "border-[var(--lp-line)] bg-[var(--lp-surface)] text-[var(--lp-text)] hover:bg-[var(--accent-600,#059669)] hover:text-white";

  return (
    <ul className={`flex flex-wrap gap-3 ${className}`}>
      {links.map((link) => (
        <li key={link.platform}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={platformLabel(link.platform)}
            title={platformLabel(link.platform)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${idle}`}
          >
            <SocialGlyph platform={link.platform} className="h-5 w-5" />
          </a>
        </li>
      ))}
    </ul>
  );
}

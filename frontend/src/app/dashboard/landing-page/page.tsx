"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  ImagePlus,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { apiFetch, ApiError } from "@/lib/api";
import { ACCENT_PRESETS, type AccentPresetId } from "@/lib/themePresets";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";
import {
  type LandingBackground,
  type HeroMark,
  type LandingCards,
  type LandingCorners,
  type LandingFont,
  type SocialLink,
  type SocialPlatform,
  landingPalette,
  landingStyle,
} from "@/components/landing/landing";
import { SOCIAL_PLATFORMS, SocialGlyph, platformLabel } from "@/components/landing/social";

// ----------------------------------------------------------------------------
// The owner's side of the one-page landing site at /l/<slug>. Everything the
// public page shows that the owner controls lives here, in the order the page
// itself uses: link and address, about, theme, what's listed, gallery, reviews,
// and online booking. Business name, phone, email, address, and logo still come
// from Settings, so nothing is entered twice.
// ----------------------------------------------------------------------------

type LandingPhoto = { id: number; image: string; display_order: number };
type LandingPage = {
  id: number;
  slug: string;
  blurb_text: string;
  landing_accent: AccentPresetId;
  landing_background: LandingBackground;
  landing_font: LandingFont;
  landing_corners: LandingCorners;
  landing_cards: LandingCards;
  hero_mark: HeroMark;
  logo: string | null;
  social_links: SocialLink[];
  booking_enabled: boolean;
  booking_available: boolean;
  photos: LandingPhoto[];
};
type ListedItem = { id: number; name: string; price: string; is_product: boolean; show_on_landing_page: boolean };
type OwnerReview = { id: number; author_name: string; rating: number; text: string; is_approved: boolean; created_at: string };

const MAX_GALLERY_PHOTOS = 12; // matches MAX_GALLERY_PHOTOS in landingpages/models.py

// A save that never got a reply (no connection, or the server is down) has no
// ApiError, so it gets its own plain-language message instead of a generic one.
function saveErrorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return "Can't reach the server right now. Check your connection and try again.";
  return fallback;
}

const SECTIONS = [
  { id: "link", label: "Link" },
  { id: "about", label: "About" },
  { id: "theme", label: "Theme" },
  { id: "social", label: "Social media" },
  { id: "listed", label: "What's listed" },
  { id: "gallery", label: "Gallery" },
  { id: "reviews", label: "Reviews" },
  { id: "booking", label: "Booking" },
] as const;

// Accent choices come straight from the shared presets, so the landing page
// offers every color the dashboard does.
const ACCENT_CHOICES = (Object.keys(ACCENT_PRESETS) as AccentPresetId[]).map((id) => ({
  id,
  label: ACCENT_PRESETS[id].label,
}));
const BACKGROUND_CHOICES: { id: LandingBackground; label: string }[] = [
  { id: "white", label: "White" },
  { id: "cream", label: "Warm cream" },
  { id: "mist", label: "Soft gray" },
  { id: "tint", label: "Accent tint" },
  { id: "charcoal", label: "Charcoal" },
];
const MARK_CHOICES: { id: HeroMark; label: string }[] = [
  { id: "name", label: "Business name" },
  { id: "logo", label: "Logo" },
];
const CARD_CHOICES: { id: LandingCards; label: string }[] = [
  { id: "outline", label: "Outlined" },
  { id: "shadow", label: "Soft shadow" },
  { id: "flat", label: "Flat" },
];
const FONT_CHOICES: { id: LandingFont; label: string }[] = [
  { id: "modern", label: "Modern & bold" },
  { id: "editorial", label: "Editorial" },
  { id: "clean", label: "Clean & minimal" },
];
const CORNER_CHOICES: { id: LandingCorners; label: string }[] = [
  { id: "soft", label: "Soft" },
  { id: "square", label: "Square" },
  { id: "round", label: "Extra rounded" },
];

const textareaClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]";

// Choice is a row of pill buttons. The optional swatch draws a little color dot
// before each label, used for the accent colors.
function Choice<T extends string>({
  label,
  value,
  choices,
  onChange,
  swatch,
}: {
  label: string;
  value: T;
  choices: { id: T; label: string }[];
  onChange: (id: T) => void;
  swatch?: (id: T) => string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            onClick={() => onChange(c.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              value === c.id
                ? "border-[var(--accent-600,#059669)] bg-[var(--accent-50,#ecfdf5)] text-[var(--accent-700,#047857)]"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {swatch && <span aria-hidden="true" className="h-3 w-3 rounded-full border border-black/10" style={{ background: swatch(c.id) }} />}
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LandingPagePage() {
  const { account } = useAuth();
  const onPlus = account?.plan_tier === "plus" || account?.plan_tier === "premium";
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const [page, setPage] = useState<LandingPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [blurbDraft, setBlurbDraft] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [themeDraft, setThemeDraft] = useState<{
    accent: AccentPresetId;
    background: LandingBackground;
    font: LandingFont;
    corners: LandingCorners;
    cards: LandingCards;
    mark: HeroMark;
  }>({
    accent: "emerald",
    background: "white",
    font: "modern",
    corners: "soft",
    cards: "shadow",
    mark: "name",
  });
  const [themeError, setThemeError] = useState<string | null>(null);
  const [themeSaved, setThemeSaved] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>("instagram");
  const [socialUrl, setSocialUrl] = useState("");
  const [socialError, setSocialError] = useState<string | null>(null);
  const [savingSocial, setSavingSocial] = useState(false);

  const [items, setItems] = useState<ListedItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [reviews, setReviews] = useState<OwnerReview[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  function load() {
    apiFetch<LandingPage>("/api/landing-pages/me/")
      .then((loaded) => {
        setPage(loaded);
        setBlurbDraft(loaded.blurb_text);
        setThemeDraft({
          accent: loaded.landing_accent,
          background: loaded.landing_background,
          font: loaded.landing_font,
          corners: loaded.landing_corners,
          cards: loaded.landing_cards,
          mark: loaded.hero_mark,
        });
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load your landing page."));
  }

  function loadItems() {
    apiFetch<ListedItem[]>("/api/services/")
      .then(setItems)
      .catch((err) => setListError(err instanceof ApiError ? err.message : "Couldn't load your services."));
  }

  function loadReviews() {
    apiFetch<OwnerReview[]>("/api/landing-pages/me/reviews/")
      .then(setReviews)
      .catch((err) => setReviewError(err instanceof ApiError ? err.message : "Couldn't load reviews."));
  }

  useEffect(() => {
    load();
    loadItems();
    loadReviews();
  }, []);

  const publicPath = page ? `/l/${page.slug}` : "";
  const publicUrl = origin && publicPath ? `${origin}${publicPath}` : "";

  async function copyLink() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers refuse clipboard access in non-secure contexts. The URL is
      // still on screen to select and copy by hand.
      setCopyFailed(true);
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setDetailsError(null);
    setDetailsSaved(false);
    setSavingDetails(true);
    try {
      const updated = await apiFetch<LandingPage>("/api/landing-pages/me/", {
        method: "PATCH",
        body: { blurb_text: blurbDraft },
      });
      setPage((current) => (current ? { ...current, ...updated } : updated));
      setBlurbDraft(updated.blurb_text);
      setDetailsSaved(true);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveTheme(e: React.FormEvent) {
    e.preventDefault();
    setThemeError(null);
    setThemeSaved(false);
    setSavingTheme(true);
    try {
      const updated = await apiFetch<LandingPage>("/api/landing-pages/me/", {
        method: "PATCH",
        body: {
          landing_accent: themeDraft.accent,
          landing_background: themeDraft.background,
          landing_font: themeDraft.font,
          landing_corners: themeDraft.corners,
          landing_cards: themeDraft.cards,
          hero_mark: themeDraft.mark,
        },
      });
      setPage((current) => (current ? { ...current, ...updated } : updated));
      setThemeSaved(true);
    } catch (err) {
      setThemeError(saveErrorMessage(err, "Couldn't save your theme. Try again."));
    } finally {
      setSavingTheme(false);
    }
  }

  // Saves the whole list of social links. The server checks and tidies every
  // entry, so the list we get back is the one that's actually stored.
  async function saveSocialLinks(next: SocialLink[]) {
    const updated = await apiFetch<LandingPage>("/api/landing-pages/me/", {
      method: "PATCH",
      body: { social_links: next },
    });
    setPage((current) => (current ? { ...current, ...updated } : updated));
  }

  async function addSocialLink(e: React.FormEvent) {
    e.preventDefault();
    if (!page) return;
    setSocialError(null);
    const url = socialUrl.trim();
    if (!url) {
      setSocialError("Paste the web address for this network.");
      return;
    }
    if (page.social_links.some((link) => link.platform === socialPlatform)) {
      setSocialError(`${platformLabel(socialPlatform)} is already on your page. Remove it first to change the address.`);
      return;
    }
    setSavingSocial(true);
    try {
      await saveSocialLinks([...page.social_links, { platform: socialPlatform, url }]);
      setSocialUrl("");
    } catch (err) {
      setSocialError(saveErrorMessage(err, "Couldn't add that link. Try again."));
    } finally {
      setSavingSocial(false);
    }
  }

  async function removeSocialLink(platform: SocialPlatform) {
    if (!page) return;
    setSocialError(null);
    try {
      await saveSocialLinks(page.social_links.filter((link) => link.platform !== platform));
    } catch (err) {
      setSocialError(saveErrorMessage(err, "Couldn't remove that link. Try again."));
    }
  }

  async function toggleListed(item: ListedItem, show: boolean) {
    setListError(null);
    try {
      await apiFetch(`/api/services/${item.id}/`, { method: "PATCH", body: { show_on_landing_page: show } });
      setItems((current) => current.map((i) => (i.id === item.id ? { ...i, show_on_landing_page: show } : i)));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Couldn't change that. Try again.");
    }
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    setUploading(true);
    try {
      // One request per file, one after another, so each lands at the end of the gallery in the order picked.
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("image", file);
        await apiFetch("/api/landing-pages/me/photos/", { method: "POST", body: formData });
      }
      load();
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : "Something went wrong uploading that photo.");
      load();
    } finally {
      setUploading(false);
    }
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    if (!page) return;
    const target = index + direction;
    if (target < 0 || target >= page.photos.length) return;
    const ids = page.photos.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setPhotoError(null);
    try {
      const reordered = await apiFetch<LandingPhoto[]>("/api/landing-pages/me/photos/reorder/", {
        method: "POST",
        body: { order: ids },
      });
      setPage((current) => (current ? { ...current, photos: reordered } : current));
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : "Couldn't change the photo order.");
      load();
    }
  }

  async function deletePhoto(photo: LandingPhoto) {
    if (!confirm("Remove this photo from your page?")) return;
    setPhotoError(null);
    try {
      await apiFetch(`/api/landing-pages/me/photos/${photo.id}/`, { method: "DELETE" });
      load();
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : "Couldn't remove that photo.");
    }
  }

  async function approveReview(review: OwnerReview) {
    setReviewError(null);
    try {
      await apiFetch(`/api/landing-pages/me/reviews/${review.id}/approve/`, { method: "POST" });
      loadReviews();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Couldn't approve that review.");
    }
  }

  async function deleteReview(review: OwnerReview) {
    if (!confirm(`Delete the review from ${review.author_name}?`)) return;
    setReviewError(null);
    try {
      await apiFetch(`/api/landing-pages/me/reviews/${review.id}/`, { method: "DELETE" });
      loadReviews();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Couldn't delete that review.");
    }
  }

  if (loadError) {
    return (
      <div className="max-w-5xl space-y-6">
        <PageHeader icon={Globe} title="Landing Page" description="Your one-page site for clients to find you." />
        <ErrorText>{loadError}</ErrorText>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="max-w-5xl space-y-6">
        <PageHeader icon={Globe} title="Landing Page" description="Your one-page site for clients to find you." />
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  const pendingReviews = reviews.filter((r) => !r.is_approved);
  const approvedReviews = reviews.filter((r) => r.is_approved);
  const previewStyle = landingStyle(themeDraft.font, themeDraft.corners, themeDraft.cards);
  const previewAccent = ACCENT_PRESETS[themeDraft.accent].bg;
  const previewPalette = landingPalette(themeDraft.background);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon={Globe}
        title="Landing Page"
        description="Your one-page site for clients to find you. Share the link anywhere people will look for you."
      />

      {/* Section menu. Stays on this page, the same way the public page does. */}
      <nav aria-label="Landing page sections" className="sticky top-2 z-10 flex gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white/90 p-2 text-sm backdrop-blur">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-lg px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            {s.label}
          </a>
        ))}
      </nav>

      <section id="link" className="scroll-mt-24">
        <Card className="rounded-2xl p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-700">Your page link</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800">
              {publicUrl || publicPath}
            </div>
            <Button type="button" variant="secondary" onClick={copyLink} disabled={!publicUrl}>
              <span className="flex items-center gap-1.5">
                {copied ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Copy className="h-4 w-4" strokeWidth={2} />}
                {copied ? "Copied" : "Copy link"}
              </span>
            </Button>
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={2} />
              Open page
            </a>
          </div>
          {copyFailed && (
            <p className="mt-2 text-sm text-amber-700">Copy didn&apos;t work here. Select the link above and copy it by hand.</p>
          )}
          <p className="mt-4 text-xs text-gray-500">
            This address is set when your account is created and can&apos;t be changed, so links you share keep working.
          </p>
        </Card>
      </section>

      <section id="about" className="scroll-mt-24">
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">About your business</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            The text people read on your page. A few honest sentences about what you do and who for works best.
          </p>
          <form onSubmit={saveDetails} className="mt-5 space-y-4">
            <textarea
              value={blurbDraft}
              onChange={(e) => setBlurbDraft(e.target.value)}
              rows={5}
              placeholder="A sentence or two about what you do and who you do it for."
              className={textareaClass}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingDetails}>
                {savingDetails ? "Saving…" : "Save about"}
              </Button>
              {detailsSaved && <span className="text-sm text-emerald-700">Saved.</span>}
              <ErrorText>{detailsError}</ErrorText>
            </div>
          </form>
        </Card>
      </section>

      <section id="theme" className="scroll-mt-24">
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Theme</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            How your landing page looks. This is separate from your dashboard theme, so you can style them differently.
          </p>
          <form onSubmit={saveTheme} className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-5">
              <Choice
                label="Accent color"
                value={themeDraft.accent}
                choices={ACCENT_CHOICES}
                swatch={(id) => ACCENT_PRESETS[id].bg}
                onChange={(accent) => setThemeDraft((d) => ({ ...d, accent }))}
              />
              <Choice
                label="Background"
                value={themeDraft.background}
                choices={BACKGROUND_CHOICES}
                onChange={(background) => setThemeDraft((d) => ({ ...d, background }))}
              />
              <Choice label="Type style" value={themeDraft.font} choices={FONT_CHOICES} onChange={(font) => setThemeDraft((d) => ({ ...d, font }))} />
              <Choice label="Corners" value={themeDraft.corners} choices={CORNER_CHOICES} onChange={(corners) => setThemeDraft((d) => ({ ...d, corners }))} />
              <Choice label="Card style" value={themeDraft.cards} choices={CARD_CHOICES} onChange={(cards) => setThemeDraft((d) => ({ ...d, cards }))} />
              <div>
                <Choice label="Top of page" value={themeDraft.mark} choices={MARK_CHOICES} onChange={(mark) => setThemeDraft((d) => ({ ...d, mark }))} />
                {themeDraft.mark === "logo" && !page.logo && (
                  <p className="mt-2 text-sm text-amber-700">
                    You don&apos;t have a logo yet. Upload one in Settings and it will show here. Until then, your business name shows.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={savingTheme}>
                  {savingTheme ? "Saving…" : "Save theme"}
                </Button>
                {themeSaved && <span className="text-sm text-emerald-700">Saved.</span>}
                <ErrorText>{themeError}</ErrorText>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700">Preview</p>
              {/* The preview uses the same palette and card style as the public page, so what you pick is what people see. */}
              <div className="mt-2 rounded-2xl border border-gray-200 p-6 text-center text-[var(--lp-text)]" style={previewPalette}>
                {themeDraft.mark === "logo" && page.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.logo} alt="" className="mx-auto max-h-16 w-auto max-w-[14rem] object-contain" />
                ) : (
                  <p className={`text-3xl ${previewStyle.heading}`} style={{ color: "var(--lp-text)" }}>
                    {page.slug.replace(/-/g, " ")}
                  </p>
                )}
                <p className="mt-2 text-sm" style={{ color: "var(--lp-muted)" }}>
                  Your name in your chosen type style
                </p>
                <span
                  className={`mt-5 inline-block px-6 py-2.5 text-sm font-semibold text-white shadow-sm ${previewStyle.button}`}
                  style={{ background: previewAccent }}
                >
                  Book an appointment
                </span>
                <div className={`mx-auto mt-5 h-16 max-w-xs ${previewStyle.panel} ${previewStyle.card}`} />
              </div>
            </div>
          </form>
        </Card>
      </section>

      <section id="social" className="scroll-mt-24">
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Social media</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Add the networks you use. Each icon opens your page on that network when a client taps it.
          </p>

          <form onSubmit={addSocialLink} className="mt-5 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
            <label className="block text-sm font-medium text-gray-700">
              Network
              <select
                value={socialPlatform}
                onChange={(e) => setSocialPlatform(e.target.value as SocialPlatform)}
                className={`${textareaClass} bg-white`}
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Web address
              <input
                type="text"
                inputMode="url"
                value={socialUrl}
                onChange={(e) => setSocialUrl(e.target.value)}
                placeholder="instagram.com/yourbusiness"
                className={`${textareaClass} bg-white`}
              />
            </label>
            <Button type="submit" disabled={savingSocial}>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                {savingSocial ? "Adding…" : "Add"}
              </span>
            </Button>
          </form>
          <ErrorText>{socialError}</ErrorText>

          {page.social_links.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">No social links yet. Add one above and its icon will show on your page.</p>
          ) : (
            <ul className="mt-6 divide-y divide-gray-100">
              {page.social_links.map((link) => (
                <li key={link.platform} className="flex items-center gap-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                    <SocialGlyph platform={link.platform} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{platformLabel(link.platform)}</p>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-gray-500 hover:underline">
                      {link.url}
                    </a>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => removeSocialLink(link.platform)} className="shrink-0">
                    <span className="flex items-center gap-1.5">
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                      Remove
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section id="listed" className="scroll-mt-24">
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">What&apos;s listed</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Turn on the services you want clients to see. Anything left off stays off the page.
          </p>
          {listError && <ErrorText>{listError}</ErrorText>}
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              You don&apos;t have any services yet. <Link href="/dashboard/services" className="underline">Add a service</Link>.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500">${Number(item.price).toFixed(2)}</p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={item.show_on_landing_page}
                      onChange={(e) => toggleListed(item, e.target.checked)}
                      className="h-4 w-4"
                    />
                    Show on page
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section id="gallery" className="scroll-mt-24">
        <Card className="rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Gallery</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Your work, shown in the order below. Up to {MAX_GALLERY_PHOTOS} photos. Use the arrows to move one, or remove it.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {page.photos.length} of {MAX_GALLERY_PHOTOS}
              </span>
              <label
                className={`inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
                  uploading || page.photos.length >= MAX_GALLERY_PHOTOS ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-50"
                }`}
              >
                <ImagePlus className="h-4 w-4" strokeWidth={2} />
                {uploading ? "Uploading…" : "Add photos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading || page.photos.length >= MAX_GALLERY_PHOTOS}
                  onChange={(e) => {
                    uploadPhotos(e.target.files);
                    e.target.value = ""; // so picking the same file again still fires onChange
                  }}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {page.photos.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
              No photos yet. Add a few of your work, your space, or your team.
            </div>
          ) : (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {page.photos.map((photo, index) => (
                <li key={photo.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.image} alt="" className="aspect-square w-full object-cover" />
                  <div className="flex items-center justify-between gap-1 p-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => movePhoto(index, -1)}
                        disabled={index === 0}
                        aria-label="Move photo earlier"
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePhoto(index, 1)}
                        disabled={index === page.photos.length - 1}
                        aria-label="Move photo later"
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePhoto(photo)}
                      aria-label="Remove photo"
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <ErrorText>{photoError}</ErrorText>
          </div>
        </Card>
      </section>

      <section id="reviews" className="scroll-mt-24">
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Reviews</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Clients can leave a review from your page. Nothing shows publicly until you approve it.
          </p>
          <ErrorText>{reviewError}</ErrorText>

          <h3 className="mt-5 text-sm font-semibold text-gray-900">Waiting for approval ({pendingReviews.length})</h3>
          {pendingReviews.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No reviews waiting.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {pendingReviews.map((review) => (
                <li key={review.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <ReviewBody review={review} />
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" onClick={() => approveReview(review)}>
                      Approve
                    </Button>
                    <button type="button" onClick={() => deleteReview(review)} className="rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-6 text-sm font-semibold text-gray-900">Showing on your page ({approvedReviews.length})</h3>
          {approvedReviews.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No approved reviews yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {approvedReviews.map((review) => (
                <li key={review.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <ReviewBody review={review} />
                  <button type="button" onClick={() => deleteReview(review)} className="shrink-0 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section id="booking" className="scroll-mt-24">
        <Card className="rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Online booking</h2>
          {onPlus ? (
            <>
              <p className="mt-0.5 text-sm text-gray-500">
                When on, your page shows a Book button. Clients pick a service, a day, and a time that&apos;s actually open on your calendar.
              </p>
              <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={page.booking_enabled}
                  disabled={bookingSaving}
                  onChange={async (e) => {
                    setBookingError(null);
                    setBookingSaving(true);
                    try {
                      const updated = await apiFetch<LandingPage>("/api/landing-pages/me/", {
                        method: "PATCH",
                        body: { booking_enabled: e.target.checked },
                      });
                      setPage((current) => (current ? { ...current, ...updated } : updated));
                    } catch (err) {
                      setBookingError(err instanceof ApiError ? err.message : "Couldn't change that. Try again.");
                    } finally {
                      setBookingSaving(false);
                    }
                  }}
                />
                Let clients book appointments from my page
              </label>
              <ErrorText>{bookingError}</ErrorText>
            </>
          ) : (
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Online booking is a Plus feature. Upgrade your plan and clients can book appointments right from your page.
            </p>
          )}
        </Card>
      </section>

      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Already on your page</h2>
        <p className="mt-0.5 text-sm text-gray-500">These come from the rest of your dashboard, so there&apos;s nothing to enter twice.</p>
        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          <li>
            Business name, phone, email, and address: <Link href="/dashboard/settings" className="font-medium underline">Settings</Link>
          </li>
          <li>
            Logo: <Link href="/dashboard/settings" className="font-medium underline">Settings &gt; Business</Link>
          </li>
          <li>
            Services you sell: <Link href="/dashboard/services" className="font-medium underline">Services</Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function ReviewBody({ review }: { review: OwnerReview }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-900">{review.author_name}</p>
        <span className="flex text-amber-500" aria-label={`${review.rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className="h-3.5 w-3.5" fill={n <= review.rating ? "currentColor" : "none"} />
          ))}
        </span>
      </div>
      {review.text && <p className="mt-1 text-sm text-gray-600">{review.text}</p>}
    </div>
  );
}

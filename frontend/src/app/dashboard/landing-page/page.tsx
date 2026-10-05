"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Copy, ExternalLink, Globe, ImagePlus, Trash2 } from "lucide-react";
import Link from "next/link";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { PageHeader } from "@/components/PageHeader";

// ----------------------------------------------------------------------------
// The owner's side of the public landing page (the /l/<slug> page anyone can
// visit). Everything here edits the one landing page this account owns:
// the address people visit, the about text, and the photo gallery. Business
// name, phone, email, address, and logo deliberately don't live on this
// page — they come from Settings, so they're never entered twice.
//
// The share link is built from window.location.origin, not a hardcoded
// domain, so it's always the address this dashboard is actually running at.
// useSyncExternalStore (instead of reading window in render or a useEffect)
// keeps the server-rendered and client-rendered markup identical, so there's
// no hydration mismatch when the page loads.
// ----------------------------------------------------------------------------

type LandingPhoto = { id: number; image: string; display_order: number };
type LandingPage = { id: number; slug: string; blurb_text: string; photos: LandingPhoto[] };

// Mirrors the backend's slugify() closely enough for the live preview under
// the address field. The backend still has the final say when saving.
function previewSlug(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const textareaClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[var(--accent-500,#10b981)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-500,#10b981)]";

export default function LandingPagePage() {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const [page, setPage] = useState<LandingPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [slugDraft, setSlugDraft] = useState("");
  const [blurbDraft, setBlurbDraft] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  function load() {
    apiFetch<LandingPage>("/api/landing-pages/me/")
      .then((loaded) => {
        setPage(loaded);
        setSlugDraft(loaded.slug);
        setBlurbDraft(loaded.blurb_text);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load your landing page."));
  }

  useEffect(load, []);

  const publicPath = page ? `/l/${page.slug}` : "";
  const publicUrl = origin && publicPath ? `${origin}${publicPath}` : "";

  async function copyLink() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers and non-secure contexts refuse clipboard access — the
      // URL is still right there on screen to select and copy by hand.
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
        body: { slug: slugDraft, blurb_text: blurbDraft },
      });
      setPage((current) => (current ? { ...current, ...updated } : updated));
      setSlugDraft(updated.slug); // the server tidies the address (lowercase, hyphens), so show what it actually saved
      setBlurbDraft(updated.blurb_text);
      setDetailsSaved(true);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    setUploading(true);
    try {
      // One request per file, sent one after another so each photo lands at
      // the end of the gallery in the order it was picked.
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

  if (loadError) {
    return (
      <div className="max-w-4xl space-y-6">
        <PageHeader icon={Globe} title="Landing Page" description="Your public page for clients to find you." />
        <ErrorText>{loadError}</ErrorText>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="max-w-4xl space-y-6">
        <PageHeader icon={Globe} title="Landing Page" description="Your public page for clients to find you." />
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        icon={Globe}
        title="Landing Page"
        description="Your public page for clients to find you. Share the link anywhere people will look for you."
      />

      {/* The link is the first thing on the page on purpose — it's the one
          thing most people come here for. */}
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
      </Card>

      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Address and about</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          The short address at the end of your link, and the text people read about your business.
        </p>
        <form onSubmit={saveDetails} className="mt-5 space-y-4">
          <div>
            <Field label="Page address" value={slugDraft} onChange={(e) => setSlugDraft(e.target.value)} required />
            <p className="mt-1 text-xs text-gray-500">
              Your link will be {origin}/l/{previewSlug(slugDraft) || "your-address"}. Changing it breaks any links you
              have already shared.
            </p>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            About your business
            <textarea
              value={blurbDraft}
              onChange={(e) => setBlurbDraft(e.target.value)}
              rows={4}
              placeholder="A sentence or two about what you do and who you do it for."
              className={textareaClass}
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={savingDetails}>
              {savingDetails ? "Saving…" : "Save"}
            </Button>
            {detailsSaved && <span className="text-sm text-emerald-700">Saved.</span>}
            <ErrorText>{detailsError}</ErrorText>
          </div>
        </form>
      </Card>

      <Card className="rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Photos</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Shown on your page in the order below. Use the arrows to move a photo, or remove it.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ImagePlus className="h-4 w-4" strokeWidth={2} />
            {uploading ? "Uploading…" : "Add photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={(e) => {
                uploadPhotos(e.target.files);
                e.target.value = ""; // so picking the same file again still fires onChange
              }}
              className="sr-only"
            />
          </label>
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

      <Card className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Already on your page</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          These come from the rest of your dashboard, so there&apos;s nothing to enter twice.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          <li>
            Business name, phone, email, and address: <Link href="/dashboard/settings" className="font-medium underline">Settings</Link>
          </li>
          <li>
            Logo: <Link href="/dashboard/settings" className="font-medium underline">Settings &gt; Business</Link>
          </li>
          <li>
            Services and products you sell: <Link href="/dashboard/services" className="font-medium underline">Services</Link>{" "}
            and <Link href="/dashboard/products" className="font-medium underline">Products</Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, ErrorText } from "@/components/form";

// ----------------------------------------------------------------------------
// Branding — logo upload and one accent color. Per the plan doc: "color
// only, not a full layout/theme redesign, to keep every account looking
// consistent and professional." So this section is deliberately small —
// no font pickers, no custom CSS, just these two things.
// ----------------------------------------------------------------------------

export function BrandingSection() {
  const { account, refreshAccount } = useAuth();
  const [accentColor, setAccentColor] = useState(account?.accent_color ?? "#059669");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      // A file upload can't be sent as plain JSON — FormData is the
      // browser's way of building a "multipart" request body that can
      // carry both regular fields AND a binary file in one request.
      const formData = new FormData();
      formData.append("accent_color", accentColor);
      if (logoFile) formData.append("logo", logoFile);

      await apiFetch("/api/accounts/me/", { method: "PATCH", body: formData });
      await refreshAccount();
      setLogoFile(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-medium">Branding</h2>
      <p className="mt-1 text-sm text-gray-500">Your logo and one accent color — shown on your landing page and documents.</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Logo</p>
          {account?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.logo} alt="Current logo" className="mt-2 h-16 w-16 rounded-md border border-gray-200 object-cover" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="mt-2 block text-sm"
          />
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Accent color
          <div className="mt-1 flex items-center gap-2">
            {/* A native <input type="color"> gives you a real color-picker
                UI for free, no library needed — the browser handles it. */}
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border border-gray-300"
            />
            <span className="text-sm text-gray-500">{accentColor}</span>
          </div>
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </Card>
  );
}

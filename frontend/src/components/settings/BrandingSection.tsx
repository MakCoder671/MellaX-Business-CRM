"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, ErrorText } from "@/components/form";
import { SettingsSection } from "./SettingsSection";

// ----------------------------------------------------------------------------
// Branding — just the logo for now. It shows up in four places once
// uploaded: the printable invoice letterhead, the public landing page,
// marketing e-blasts, and the dashboard's own sidebar while logged in —
// all four read it straight from the account, so uploading it here is
// the only place it's ever set.
//
// Color/theme options used to live here too (a single accent_color
// field) — removed in favor of a proper Theme tab planned for later,
// rather than keeping a half-built color picker around.
// ----------------------------------------------------------------------------

export function BrandingSection() {
  const { account, refreshAccount } = useAuth();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!logoFile) return;
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      // A file upload can't be sent as plain JSON — FormData is the
      // browser's way of building a "multipart" request body that can
      // carry a binary file.
      const formData = new FormData();
      formData.append("logo", logoFile);

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

  async function handleRemove() {
    if (!confirm("Remove your logo? It'll disappear from invoices, your landing page, and marketing emails.")) return;
    setError(null);
    setRemoving(true);
    try {
      // Removing a file needs a plain JSON body (logo: null), not
      // FormData — DRF's ImageField accepts null as "clear this field"
      // when the model allows it (see accounts/models.py, null=True).
      await apiFetch("/api/accounts/me/", { method: "PATCH", body: { logo: null } });
      await refreshAccount();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <SettingsSection
      icon={ImageIcon}
      title="Branding"
      description="Your logo, shown on invoices, your landing page, marketing e-blasts, and here in the dashboard."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Logo</p>
          {account?.logo && (
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={account.logo} alt="Current logo" className="h-16 w-16 rounded-xl border border-gray-200 object-cover shadow-sm" />
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove logo"}
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="mt-2 block text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting || !logoFile}>
            {submitting ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
    </SettingsSection>
  );
}

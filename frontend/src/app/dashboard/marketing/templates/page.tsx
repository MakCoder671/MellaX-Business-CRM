"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, ImagePlus, Trash2, Upload } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, ErrorText, Field } from "@/components/form";
import { MarketingTabs } from "@/components/MarketingTabs";
import { PageHeader } from "@/components/PageHeader";

type MarketingTemplate = {
  id: number;
  name: string;
  image_url: string | null;
  canva_link: string;
  created_at: string;
};

// Your designs. Owners design in Canva, download the image, and upload it here.
// Each design can then be used in an E-Blast or a Campaign. MellaX doesn't connect
// to Canva itself, so nothing here needs a Canva account or a Canva login.
export default function MarketingTemplatesPage() {
  const [templates, setTemplates] = useState<MarketingTemplate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [canvaLink, setCanvaLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    return apiFetch<MarketingTemplate[]>("/api/marketing/templates/")
      .then(setTemplates)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load your designs."));
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);
    setUploadDone(false);
    if (!name.trim()) return setUploadError("Give this design a name, like Spring sale or Email header.");
    if (!file) return setUploadError("Choose the image you downloaded from Canva.");

    const body = new FormData();
    body.append("name", name.trim());
    body.append("image", file);
    if (canvaLink.trim()) body.append("canva_link", canvaLink.trim());

    setUploading(true);
    try {
      await apiFetch("/api/marketing/templates/", { method: "POST", body });
      setName("");
      setCanvaLink("");
      setFile(null);
      setFileKey((k) => k + 1); // clears the file picker
      setUploadDone(true);
      load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Couldn't upload that design. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(template: MarketingTemplate) {
    if (!confirm(`Delete “${template.name}”? E-Blasts and Campaigns that used it keep their text, but lose this image.`)) return;
    try {
      await apiFetch(`/api/marketing/templates/${template.id}/`, { method: "DELETE" });
      load();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't delete that design.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ImagePlus}
        title="Marketing"
        description="Design flyers and email headers in Canva, then use them in your E-Blasts and Campaigns."
      />
      <MarketingTabs />

      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">How it works</h2>
          <p className="mt-1 text-sm text-gray-600">Four steps. Nothing to connect or set up.</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-4">
          {[
            {
              title: "Design it in Canva",
              text: "Open Canva and choose Create a design. For emails, use a custom size 600 pixels wide.",
            },
            {
              title: "Download it",
              text: "In Canva, choose Share, then Download. Pick PNG or JPG. Keep the file under 5 MB.",
            },
            {
              title: "Upload it here",
              text: "Choose the file below, give it a name, and upload. Paste the Canva link too, so you can find the design again.",
            },
            {
              title: "Use it",
              text: "In E-Blasts, pick it at the top of an email. In Campaigns, pick it for the page visitors see.",
            },
          ].map((step, index) => (
            <li key={step.title} className="rounded-xl border border-gray-200 p-4">
              <span className="accent-bg flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold">{index + 1}</span>
              <p className="mt-3 text-sm font-semibold text-gray-900">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          <span>Ready to design? Open Canva in a new tab, then come back here to upload.</span>
          <a
            href="https://www.canva.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 font-medium text-gray-800 hover:bg-gray-100"
          >
            Open Canva
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <p className="text-xs text-gray-500">
          MellaX doesn&apos;t connect to Canva directly. You download the image from Canva and upload it here. If you change
          the design later, download it again and upload a new template.
        </p>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-base font-semibold text-gray-900">Upload a design</h2>
        <form onSubmit={upload} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Canva link (optional)" value={canvaLink} onChange={(e) => setCanvaLink(e.target.value)} placeholder="https://www.canva.com/design/..." />
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            Image from Canva (PNG, JPG, or WebP, under 5 MB)
            <input
              key={fileKey}
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={uploading} className="gap-1.5 whitespace-nowrap">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload design"}
            </Button>
            {uploadDone && <span className="text-sm text-emerald-700">Uploaded. It&apos;s ready to use.</span>}
            <ErrorText>{uploadError}</ErrorText>
          </div>
        </form>
      </Card>

      <ErrorText>{loadError}</ErrorText>
      {templates === null && !loadError && <p className="text-sm text-gray-500">Loading your designs…</p>}
      {templates && templates.length === 0 && (
        <p className="text-sm text-gray-500">No designs yet. Upload your first one above.</p>
      )}

      {templates && templates.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="space-y-3 overflow-hidden p-0">
              {template.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={template.image_url} alt={template.name} className="h-44 w-full bg-gray-100 object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center bg-gray-100 text-sm text-gray-400">No preview</div>
              )}
              <div className="space-y-3 px-4 pb-4">
                <p className="font-semibold text-gray-900">{template.name}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {template.canva_link && (
                    <a href={template.canva_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-gray-800 underline">
                      Open in Canva
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button type="button" onClick={() => remove(template)} className="inline-flex items-center gap-1 text-rose-700 hover:underline">
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

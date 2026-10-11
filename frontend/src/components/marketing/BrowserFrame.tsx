import Image from "next/image";

// A plain rounded card around a screenshot, styled like a browser window
// (three dots, an address bar) so a flat screenshot reads as "software
// you can click into" instead of a random image. Shared by the Hero and
// the "see it in action" section below it, so every screenshot on the
// page gets the same frame instead of each one doing its own thing.
export function BrowserFrame({
  src,
  alt,
  address = "app.mellax.com",
}: {
  src: string;
  alt: string;
  address?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-xl">
      <div className="flex items-center gap-2 border-b border-ink/10 bg-ink/[0.03] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
        <span className="ml-2 rounded-full bg-ink/5 px-3 py-0.5 text-xs text-ink/40">{address}</span>
      </div>
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-cream">
        <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-top" />
      </div>
    </div>
  );
}

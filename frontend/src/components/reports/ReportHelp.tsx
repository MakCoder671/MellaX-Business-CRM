import { Info } from "lucide-react";

// The "what is this?" box at the top of every report tab. Each report answers
// the same three questions in the same order: what it shows, how to read it,
// and what it deliberately leaves out. Owners have no support team to ask, so
// this box is their support.
export function ReportHelp({
  shows,
  howToRead,
  leavesOut,
}: {
  shows: string[];
  howToRead: string[];
  leavesOut: string[];
}) {
  return (
    <details open className="group rounded-2xl border border-sky-200 bg-sky-50/60 text-sm text-sky-950">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold">
        <Info className="h-4 w-4 shrink-0 text-sky-700" />
        What this report does, and how to read it
        <span className="ml-auto text-xs font-medium text-sky-700 group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs font-medium text-sky-700 group-open:inline">Hide</span>
      </summary>
      <div className="grid gap-6 border-t border-sky-200 px-5 py-5 md:grid-cols-3">
        <div>
          <p className="font-semibold">What it shows</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-sky-900">
            {shows.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold">How to read it</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-sky-900">
            {howToRead.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold">What it leaves out</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-sky-900">
            {leavesOut.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

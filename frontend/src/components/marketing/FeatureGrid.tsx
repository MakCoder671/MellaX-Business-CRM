import { CalendarClock, Megaphone, ReceiptText, Users } from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Clients",
    description:
      "One place for every client's contact info, history, and notes — no more digging through texts and spreadsheets.",
  },
  {
    icon: ReceiptText,
    title: "Invoicing",
    description:
      "Create, send, and track invoices that actually get paid, with taxes and terms set up once and reused every time.",
  },
  {
    icon: CalendarClock,
    title: "Scheduling",
    description:
      "A real calendar for appointments and bookings, with a page clients can use to book themselves — no back-and-forth texting.",
  },
  {
    icon: Megaphone,
    title: "Marketing",
    description:
      "Simple campaigns and landing pages to bring in new clients, without needing a separate marketing tool or agency.",
  },
] as const;

// The "here's what you actually get" section — four things a solo
// operator juggles across four different apps today, shown as one
// unified toolset instead.
export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="max-w-xl">
        <h2 className="text-balance font-display text-3xl font-bold text-ink sm:text-4xl">
          Everything you&apos;re currently doing in four different apps.
        </h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-ink/70">
          MellaX replaces the spreadsheet, the text thread, the invoice
          generator, and the sticky notes — with one tool built for how a
          small service business actually runs.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-2xl border border-ink/10 bg-card p-6 transition-shadow hover:shadow-md"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand-dark">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/65">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

import { type PublicLandingPage, landingStyle } from "./landing";

// One last call to action right before the footer, so the page doesn't just end.
// Booking is the main button on Plus. Basic has no booking, so it shows a call button.
export function ClosingSection({ page, canBook }: { page: PublicLandingPage; canBook: boolean }) {
  const style = landingStyle(page.landing_font, page.landing_corners);

  return (
    <section className="bg-[var(--lp-closing)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-center md:py-20">
        <div>
          <h2 className={`text-3xl leading-tight text-white sm:text-4xl ${style.heading}`}>Ready when you are</h2>
          <p className="mt-3 max-w-xl text-lg text-gray-300">
            {canBook ? "Pick a time that works for you, or give us a call with any questions." : "Give us a call with any questions."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canBook && (
            <a href="#book" className={`accent-bg px-7 py-3.5 text-base font-semibold ${style.button}`}>
              Book an appointment
            </a>
          )}
          {page.phone && (
            <a
              href={`tel:${page.phone}`}
              className={`border border-white/30 px-7 py-3.5 text-base font-semibold text-white hover:bg-white/10 ${style.button}`}
            >
              Call {page.phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

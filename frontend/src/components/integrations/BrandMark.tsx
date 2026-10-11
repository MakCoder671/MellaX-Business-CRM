import { type SimpleIcon, siApple, siGoogle, siMailchimp, siSquare, siStripe, siZapier } from "simple-icons";

// The logo tile on each integration card. Brands with a logo in the icon set
// get their real mark. Anything else gets the first letter of its name.
const LOGOS: Record<string, SimpleIcon> = {
  apple_calendar: siApple,
  google_calendar: siGoogle,
  square: siSquare,
  stripe: siStripe,
  zapier: siZapier,
  mailchimp: siMailchimp,
};

export function BrandMark({ integrationKey, name }: { integrationKey: string; name: string }) {
  const logo = LOGOS[integrationKey];
  const box = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl";

  if (logo) {
    return (
      <span aria-hidden="true" className={`${box} bg-gray-50 ring-1 ring-inset ring-gray-200`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill={`#${logo.hex}`}>
          <path d={logo.path} />
        </svg>
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={`${box} bg-gray-900 text-base font-bold text-white`}>
      {name.charAt(0)}
    </span>
  );
}

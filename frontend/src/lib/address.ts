// Mirrors the backend's BusinessAccount.formatted_address_lines()
// (accounts/models.py) — same split-into-parts, join-back-for-display
// logic, kept in sync by hand since one's Python and one's TypeScript.
// Used anywhere an address gets rendered as plain text in the app
// (invoices, the public landing page, client profiles, the appointment
// detail popup) instead of each spot hand-rolling its own "join whatever
// parts exist" string logic.

export type AddressParts = {
  address: string;
  city: string;
  state: string;
  zip_code: string;
};

export function formatAddressLines({ address, city, state, zip_code }: AddressParts): string[] {
  const lines: string[] = [];
  if (address) lines.push(address);

  const cityState = [city, state].filter(Boolean).join(", ");
  const cityStateZip = [cityState, zip_code].filter(Boolean).join(" ").trim();
  if (cityStateZip) lines.push(cityStateZip);

  return lines;
}

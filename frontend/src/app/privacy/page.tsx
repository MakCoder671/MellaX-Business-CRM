import { LegalLayout, LegalSection } from "@/components/marketing/LegalLayout";

// Plain-language Privacy Policy. Describes what MellaX actually collects
// and does today (see accounts/models.py, integrations/crypto.py, and
// lib/api.ts for the real mechanics this is describing) rather than a
// generic template — update this section-by-section if what's collected
// or who it's shared with changes.
export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="[date you publish this]">
      <p className="text-sm leading-relaxed text-ink/70">
        This describes what information MellaX collects, why, and who it&apos;s
        shared with. It covers both you (the business using MellaX) and, in
        a more limited way, your clients, whose information you enter into
        the software.
      </p>

      <LegalSection title="1. Information we collect from you">
        <ul className="ml-4 list-disc space-y-1">
          <li>Account info: business name, email, and password (stored as a one-way hash, never in plain text)</li>
          <li>Business details you add: hours, branding, tax rates, invoice settings</li>
          <li>Billing info, handled directly by our billing processor, not stored on our servers</li>
          <li>
            Credentials for any integration you connect (like a Stripe key or a Slack
            webhook link), stored encrypted
          </li>
          <li>Basic usage data: when you log in, and general error logs, to keep the service working</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Information you enter about your clients">
        <p>
          Client names, contact info, appointment history, invoices, and
          notes you add are stored so MellaX can run your business for you.
          This information is yours. We don&apos;t sell it, and we don&apos;t use it
          to contact your clients ourselves or to market to them on our own
          behalf.
        </p>
        <p>
          If you use a MellaX feature that sends your client&apos;s information
          to a connected third-party tool (for example, adding a client to
          a Mailchimp audience, or sending a Slack message when they book),
          that only happens for a tool you&apos;ve chosen to connect, and only
          with the information that feature needs.
        </p>
      </LegalSection>

      <LegalSection title="3. Cookies & local storage">
        <p>
          MellaX uses your browser&apos;s local storage to keep you logged in
          and to remember a few interface preferences. We don&apos;t use
          advertising trackers or sell browsing data to anyone.
        </p>
      </LegalSection>

      <LegalSection title="4. Who we share information with">
        <ul className="ml-4 list-disc space-y-1">
          <li>Our billing processor, to handle your subscription payment</li>
          <li>
            A payment processor you connect yourself (currently Stripe), if you turn on
            card payments, for the card payments you choose to take
          </li>
          <li>An email delivery service, to send invoices, notifications, and account emails</li>
          <li>
            Any integration you personally connect (Zapier, Slack, Mailchimp, Apple
            Calendar), only with the data that integration needs to do its job
          </li>
          <li>Law enforcement or regulators, only if we&apos;re legally required to</li>
        </ul>
        <p>We don&apos;t sell your data or your clients&apos; data to anyone, for any reason.</p>
      </LegalSection>

      <LegalSection title="5. How we protect information">
        <p>
          Passwords are hashed, not stored in plain text. Sensitive
          integration credentials (API keys, webhook URLs) are encrypted at
          rest. Each business&apos;s data is kept separate from every other
          business on MellaX. No system is perfectly secure, but we take
          reasonable, ongoing steps to protect what&apos;s stored here.
        </p>
      </LegalSection>

      <LegalSection title="6. How long we keep information">
        <p>
          We keep your account and business data for as long as your
          account is active, so your invoice and client history stays
          intact. If you close your account, we&apos;ll delete your data within
          a reasonable period, except where we&apos;re required to keep
          financial records longer by law.
        </p>
      </LegalSection>

      <LegalSection title="7. Your choices">
        <p>
          You can view, correct, export, or delete most of your data
          directly in MellaX. To close your account and request full
          deletion, contact us using the email below.
        </p>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          MellaX is a business tool and isn&apos;t directed at, or knowingly
          used to collect information from, children under 13.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to this policy">
        <p>
          If we make a material change to how we handle information, we&apos;ll
          let you know by email or an in-app notice before it takes effect.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Questions about this policy, or a request to access or delete your
          data? Reach us at{" "}
          <a href="mailto:support@mellax.com" className="font-medium text-brand underline">
            support@mellax.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

import { LegalLayout, LegalSection } from "@/components/marketing/LegalLayout";

// Plain-language Terms of Service. Covers what business_plan.MD's V1
// Must-Ship list asks for (tax/payment/liability disclaimers + an
// Acceptable Use Policy) in one page instead of splitting those out.
//
// The bracketed bits ([Your State], the support email) are placeholders
// for Mako to fill in with the real business details — everything else
// describes how MellaX actually works today.
export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="[date you publish this]">
      <p className="text-sm leading-relaxed text-ink/70">
        These terms are a plain-language agreement between you (&quot;you,&quot; the
        business using MellaX) and MellaX (&quot;we,&quot; &quot;us&quot;) for use of the MellaX
        software. By creating an account, you agree to these terms.
      </p>

      <LegalSection title="1. What MellaX is">
        <p>
          MellaX is software for running a small service business: client
          records, invoicing, scheduling, a client-facing booking page, basic
          marketing tools, and reports. You use it to run your own business;
          MellaX isn&apos;t a party to the services you sell or the agreements
          you make with your own clients.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <p>
          You need an account to use MellaX, verified by email. You&apos;re
          responsible for keeping your login secure and for everything that
          happens under your account. Tell us right away if you think someone
          else has access to it.
        </p>
        <p>
          You confirm that the information you give us at signup, and the
          client information you add, is accurate and that you have the
          right to store and use it.
        </p>
      </LegalSection>

      <LegalSection title="3. Plans, billing & cancellation">
        <p>
          MellaX is offered on paid monthly plans (Basic and Plus, priced as
          shown on our pricing page). Subscription payments are handled by a
          third-party billing processor; we don&apos;t store your card number.
          You can change plans or cancel anytime from Settings. If you
          cancel, your plan stays active through the end of the period you
          already paid for.
        </p>
        <p>
          Some features (currently: connecting Zapier, Slack, or Mailchimp)
          are a one-time purchase rather than part of the monthly
          subscription. Those purchases are for connecting that one
          integration and aren&apos;t refundable once the connection is made,
          except where required by law.
        </p>
      </LegalSection>

      <LegalSection title="4. Payments you take through MellaX">
        <p>
          If you connect a payment processor (currently: Stripe) to take
          card payments on your invoices, that processing happens through
          your own account with that processor, under their terms, not
          ours. MellaX never sees or stores full card numbers. We show you
          the payment status and details the processor reports back to us.
        </p>
        <p>
          You&apos;re responsible for pricing your services correctly, charging
          the right amount, issuing refunds you owe your clients, and
          complying with any payment-related law that applies to your
          business. MellaX isn&apos;t a bank, isn&apos;t a payment processor itself,
          and doesn&apos;t guarantee that any payment will be made, received, or
          settled.
        </p>
      </LegalSection>

      <LegalSection title="5. Taxes">
        <p>
          MellaX includes tools to record sales tax on invoices and to
          summarize your income and expenses for tax time (the Tax Center).
          These tools are for your own record-keeping. They aren&apos;t tax
          advice, aren&apos;t a guarantee of accuracy for your specific
          situation, and don&apos;t replace a licensed accountant or tax
          preparer. You&apos;re responsible for setting the right tax rates,
          filing on time, and paying what you owe.
        </p>
      </LegalSection>

      <LegalSection title="6. Your data and your clients' data">
        <p>
          Client records, invoices, appointments, and everything else you
          enter belong to you. We don&apos;t sell it, and we don&apos;t use it to
          market to your clients ourselves. See our{" "}
          <a href="/privacy" className="font-medium text-brand underline">
            Privacy Policy
          </a>{" "}
          for the full detail on what we collect and how it&apos;s handled.
        </p>
        <p>
          You&apos;re responsible for having the right to collect and store your
          clients&apos; information, and for following any law that applies to
          contacting them (for example, when you send a marketing e-blast or
          text from MellaX). If you connect a third-party tool like
          Mailchimp, that tool&apos;s own terms also apply to data you send it.
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <p>You agree not to use MellaX to:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Break any law, or help someone else break one</li>
          <li>Send spam, or contact people who haven&apos;t agreed to hear from you</li>
          <li>Try to access another business&apos;s account or data</li>
          <li>Interfere with the service, overload it, or try to break its security</li>
          <li>Resell or white-label MellaX itself without our written permission</li>
        </ul>
        <p>
          We can suspend or close an account that violates this section,
          after giving notice where we reasonably can.
        </p>
      </LegalSection>

      <LegalSection title="8. Uptime & changes to the service">
        <p>
          We work to keep MellaX available and reliable, but we don&apos;t
          promise it will always be free of downtime, bugs, or interruptions.
          We may add, change, or remove features over time; we&apos;ll try to
          give you reasonable notice before a change that removes something
          you rely on.
        </p>
      </LegalSection>

      <LegalSection title="9. Liability">
        <p>
          MellaX is provided &quot;as is.&quot; To the extent the law allows, we
          aren&apos;t liable for indirect or consequential losses (like lost
          profits) arising from your use of MellaX, and our total liability
          for any claim is limited to the amount you paid us in the three
          months before the claim arose. Nothing here limits liability where
          the law doesn&apos;t allow it to be limited.
        </p>
      </LegalSection>

      <LegalSection title="10. Ending this agreement">
        <p>
          You can close your account anytime from Settings. We can suspend
          or close an account for a violation of these terms, non-payment,
          or if required by law. On request, we&apos;ll give you a reasonable
          window to export your data before it&apos;s deleted.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to these terms">
        <p>
          We may update these terms as MellaX changes. For a material
          change, we&apos;ll let you know (by email or an in-app notice) before
          it takes effect. Continuing to use MellaX after a change takes
          effect means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>These terms are governed by the laws of [Your State], United States.</p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Questions about these terms? Reach us at{" "}
          <a href="mailto:support@mellax.com" className="font-medium text-brand underline">
            support@mellax.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

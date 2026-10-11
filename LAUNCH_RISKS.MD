# Friday Launch Risk Register

Purpose: This is the must-fix list to reach a fully satisfactory Friday launch.
Scope: Security, reliability, payments, and launch operations.

---

## Launch Rule

No Friday launch unless all P0 items are marked Done and verified.

---

## P0 Critical Risks (Must Fix Before Launch)

### 1) Production security settings are not hardened
- Risk: Django deploy checks reported security warnings.
- Impact: Session/cookie exposure risk, insecure transport behavior, and accidental debug leakage.
- Owner: Claude (backend config) + Copilot (verification)
- Fix:
  - Set DEBUG to false in production.
  - Use a strong production SECRET_KEY.
  - Enable SECURE_SSL_REDIRECT where appropriate.
  - Set SESSION_COOKIE_SECURE and CSRF_COOKIE_SECURE to true.
  - Configure SECURE_HSTS_SECONDS after confirming HTTPS is fully enforced.
- Done when:
  - `python manage.py check --deploy` is clean for launch-critical warnings.
- **Status (2026-10-10): Code-side done.** `mellax/settings.py` now sets all
  of the above automatically whenever `DEBUG=False`, with a real
  `SECRET_KEY` from the hosting env. `check --deploy` is clean except two
  warnings left off on purpose (SECURE_HSTS_INCLUDE_SUBDOMAINS and
  SECURE_HSTS_PRELOAD) — both are one-way, "don't flip this until HTTPS
  has been solid for a while" settings per Django's own docs, not
  something to turn on at first launch. Still open: there's no hosting
  environment yet to actually set `DEBUG=False`/`SECRET_KEY`/`ALLOWED_HOSTS`
  in — this is verified locally, not deployed.

### 2) Environment and secret management is not fully locked down
- Risk: Misconfigured env vars can break security or behavior at runtime.
- Impact: Launch instability or security regression.
- Owner: Claude (env template and settings guards) + Mako (hosting env values)
- Fix:
  - Confirm production env vars are complete and correct.
  - Remove all dev defaults from production runtime.
  - Verify CORS, ALLOWED_HOSTS, FRONTEND_URL, DATABASE_URL, EMAIL settings.
- Done when:
  - Startup and smoke tests pass on production-like env config.

### 3) Subscription billing path is not fully finalized for go-live
- Risk: Customers can choose plans but payment flow ownership and lifecycle events may be incomplete.
- Impact: Revenue leakage or manual fire drills at signup.
- Owner: Claude (integration implementation) + Copilot (test coverage and validation)
- Fix:
  - Finalize provider decision for SaaS subscriptions.
  - Validate plan activation, failed payment behavior, and downgrade/upgrade handling.
  - Ensure webhook verification and idempotency for billing events.
- Done when:
  - End-to-end test account can subscribe and account plan state is correct.
- **Status (2026-10-10): Deliberately deferred, by Mako's own decision.**
  Settings > Account & Subscription now has real self-service plan
  switching and cancellation, but MellaX isn't charging anyone's card for
  its own subscription yet — `plan_tier` just changes for free. Real
  billing (a MellaX-side Stripe Billing/Checkout setup, separate from the
  per-business Stripe keys built for client payments) is still a
  from-scratch build: provider decision, webhook handling, failed-payment
  and proration behavior, all still ahead.

### 4) Email verification and password reset deliverability not production-proven
- Risk: Auth depends on email flows; dev console email backend is not real delivery.
- Impact: Users cannot complete signup/login recovery.
- Owner: Claude (email provider wiring) + Copilot (test script and QA)
- Fix:
  - Configure production email backend and sender domain.
  - Validate verification and reset links in deployed environment.
- Done when:
  - Real inbox tests succeed for signup verification and password reset.

---

## P1 High Risks (Strongly Recommended Before or Immediately After Launch)

### 5) Monitoring and alerting are not fully operational
- Risk: Failures may go unnoticed during first user traffic.
- Impact: Slow incident response and user trust damage.
- Owner: Claude (application logging hooks) + Mako (hosting alerts)
- Fix:
  - Enable error monitoring and alert channels.
  - Ensure server/app logs are retained and searchable.
- Done when:
  - Test error triggers alert and appears in monitoring.

### 6) Backup and restore process is not rehearsal-tested
- Risk: Data loss event without proven recovery steps.
- Impact: Severe operational and trust impact.
- Owner: Mako (platform setup) + Claude/Copilot (runbook)
- Fix:
  - Enable automated database backups.
  - Document and test restore steps once.
- Done when:
  - One successful restore drill completed.

### 7) Public/private route safety needs final regression pass
- Risk: Accidental exposure via public endpoints or cross-tenant edge cases.
- Impact: Data leak risk.
- Owner: Copilot (security regression tests) + Claude (fixes)
- Fix:
  - Re-run tenant isolation and auth boundary tests.
  - Manually verify public landing routes cannot access private data.
- Done when:
  - Security smoke suite passes and manual checks are clean.

---

## P2 Medium Risks (Can Follow Launch, But Track)

### 8) Full payment-provider abstraction is incomplete
- Risk: Future provider expansion (Square, Stripe, others) may require rework.
- Impact: Slower integrations and brittle payment code.
- Owner: Claude (architecture refactor) + Copilot (test scaffolding)
- Fix:
  - Introduce provider adapter pattern for payment processors.
  - Keep internal payment records provider-agnostic.
- Done when:
  - New provider can be added without changing invoice core logic.

### 9) Operational runbook is not formalized
- Risk: Launch-day actions rely on memory.
- Impact: Mistakes and slower recovery under pressure.
- Owner: Copilot (draft) + Mako (final owner)
- Fix:
  - Write launch-day checklist, rollback steps, and first-24-hour watchlist.
- Done when:
  - One shared launch runbook exists and is reviewed.

---

## Current Validation Snapshot (updated 2026-10-10)

Already good:
- 124 backend tests passing (auth, tenant isolation, invoicing/payments,
  reports, marketing, integrations, Stripe card payments).
- `tsc` and `eslint` clean on the frontend.
- Security hardening settings are in place and verified locally (see P0.1).
- Core product surface is built and demo-able today, screen-share or
  local: client/invoice/scheduling loop, Reports and Tax Center, the
  client-facing landing/booking page, Stripe card payments on invoices
  (needs a real connected Stripe account to actually charge a card),
  Zapier/Slack/Mailchimp integrations, the public marketing site, Terms
  of Service and Privacy Policy pages, and Settings > Account &
  Subscription / Feedback & Support.

Still blocking 100 percent confidence:
- **Nothing is deployed anywhere yet.** No hosting, no domain, no
  production database — this is 100% local right now. Picking a host
  (backend + Postgres + frontend) is the actual next step, and it's
  Mako's call (cost, platform, timeline).
- Real email delivery (still the console backend — verification/reset
  links only print to the terminal, they don't send).
- Terms of Service / Privacy Policy have placeholder text
  (`[date you publish this]`, `[Your State]`, a placeholder support email)
  that need real values before relying on them for real signups.
- Subscription billing path, per P0.3 above — deferred on purpose.
- Repo working tree is **not** clean — a large amount of work across this
  project is uncommitted. Needs a review pass and a push before any of
  this is live anywhere.

---

## Friday Readiness Checklist

Mark each item Done before launch:
- [ ] P0.1 Security hardening complete and deploy checks pass
- [ ] P0.2 Production env/secret audit complete
- [ ] P0.3 Subscription billing end-to-end verified
- [ ] P0.4 Email verification/reset tested with real inboxes
- [ ] P1.1 Monitoring and alerts live
- [ ] P1.2 Backup and restore drill completed
- [ ] P1.3 Public/private boundary regression pass complete

---

## Ownership Split

Copilot:
- Security verification commands, regression tests, launch checklist quality gate

Claude:
- Backend integration and config implementation, runtime fixes, deployment wiring

Mako:
- Final provider/business decisions, platform env setup, go-live approval

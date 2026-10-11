"use client";

import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { CheckCircle2, CreditCard, Cpu, X } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { Button, ErrorText } from "@/components/form";

// Take a payment on an invoice. Two ways:
//   Charge card: type the amount, press Process, then enter the card in Stripe's
//                secure form. MellaX never sees the card number.
//   EMV reader:  send the amount to a card reader (chip or tap). Not switched on yet.
// When Stripe approves a card payment, an approved message shows what was charged.

type Config = { publishable_key: string; mode: string };
type Intent = { payment_intent_id: string; client_secret: string; publishable_key: string; amount: string };
type Approved = { amount: string; cardName: string; last4: string };

export function CardPaymentModal({
  invoiceId,
  balance,
  onClose,
  onDone,
}: {
  invoiceId: number;
  balance: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<"card" | "emv">("card");
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [config, setConfig] = useState<Config | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [approved, setApproved] = useState<Approved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<Config>("/api/invoicing/stripe/config/")
      .then(setConfig)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't reach Stripe. Check Integrations."));
  }, []);

  // Stripe.js loads once per publishable key, so the form isn't rebuilt on every keystroke.
  const stripePromise = useMemo<Promise<Stripe | null> | null>(() => {
    const key = intent?.publishable_key ?? config?.publishable_key;
    return key ? loadStripe(key) : null;
  }, [intent?.publishable_key, config?.publishable_key]);

  // Asks the server to start a payment for this amount. The server checks the amount first.
  async function startPayment() {
    setError(null);
    setBusy(true);
    try {
      const started = await apiFetch<Intent>(`/api/invoicing/invoices/${invoiceId}/card-payment/`, {
        method: "POST",
        body: { amount },
      });
      setIntent(started);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start that payment. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Take a payment">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Take a payment</h2>
            <p className="text-sm text-gray-500">Balance due: ${balance.toFixed(2)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {approved ? (
          <div className="mt-6 space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <p className="text-lg font-semibold text-gray-900">Approved</p>
            <p className="text-sm text-gray-700">
              ${approved.amount} was charged to {approved.cardName}
              {approved.last4 ? ` ending in ${approved.last4}` : ""}.
            </p>
            <p className="text-xs text-gray-500">The invoice now shows this payment with the card type and last 4 digits.</p>
            <Button type="button" onClick={onDone}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setMethod("card")}
                aria-pressed={method === "card"}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  method === "card" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                <CreditCard className="h-4 w-4" /> Charge card
              </button>
              <button
                type="button"
                onClick={() => setMethod("emv")}
                aria-pressed={method === "emv"}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  method === "emv" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                <Cpu className="h-4 w-4" /> EMV reader
              </button>
            </div>

            {method === "emv" && (
              <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
                Sending to a card reader isn&apos;t switched on yet. Use Charge card for now.
              </p>
            )}

            {method === "card" && !intent && (
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Amount to charge ($)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={balance.toFixed(2)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <p className="text-xs text-gray-500">You can charge part of the balance. It can&apos;t be more than the balance due.</p>
                <Button type="button" onClick={startPayment} disabled={busy || !config}>
                  {busy ? "Starting…" : "Process"}
                </Button>
              </div>
            )}

            {method === "card" && intent && stripePromise && (
              <Elements stripe={stripePromise} options={{ clientSecret: intent.client_secret }}>
                <CardForm
                  invoiceId={invoiceId}
                  intent={intent}
                  onApproved={setApproved}
                  onBack={() => setIntent(null)}
                />
              </Elements>
            )}

            <div className="mt-4">
              <ErrorText>{error}</ErrorText>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Stripe calls the card type "visa", "mastercard" and so on. We show it the way people write it.
function cardName(brand: string) {
  const names: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };
  return names[brand] ?? "card";
}

function CardForm({
  invoiceId,
  intent,
  onApproved,
  onBack,
}: {
  invoiceId: number;
  intent: Intent;
  onApproved: (approved: Approved) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function charge(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    // Stripe checks the card. If it needs more steps (like a bank approval), Stripe handles them.
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (result.error) {
      setError(result.error.message ?? "The card didn't go through. Try another card.");
      setBusy(false);
      return;
    }
    if (result.paymentIntent?.status !== "succeeded") {
      setError("The payment isn't finished yet. Check the card and try again.");
      setBusy(false);
      return;
    }
    try {
      // The server asks Stripe for the real result, then saves the payment with the card type.
      const recorded = await apiFetch<{ amount: string; card_last4: string; card_brand: string }>(
        `/api/invoicing/invoices/${invoiceId}/card-payment/confirm/`,
        { method: "POST", body: { payment_intent_id: intent.payment_intent_id } },
      );
      onApproved({
        amount: Number(recorded.amount).toFixed(2),
        cardName: cardName(recorded.card_brand),
        last4: recorded.card_last4,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Stripe approved the card, but we couldn't record it. Call support before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={charge} className="mt-5 space-y-4">
      <PaymentElement />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!stripe || busy}>
          {busy ? "Charging…" : `Charge $${Number(intent.amount).toFixed(2)}`}
        </Button>
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:underline">
          Change amount
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

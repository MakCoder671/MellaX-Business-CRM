import { InputHTMLAttributes, LabelHTMLAttributes, ButtonHTMLAttributes } from "react";

// ----------------------------------------------------------------------------
// Small, reusable UI building blocks used across all the forms in the app
// (signup, login, adding a client, creating an invoice, etc). Instead of
// re-typing the same Tailwind classes on every <input> and <button> in
// every page, we write the styling once here and just use <Field> /
// <Button> everywhere. If we ever want to restyle every input in the app,
// we'd only need to change it in ONE place.
// ----------------------------------------------------------------------------

// A labeled text input. `{ label: string } & InputHTMLAttributes<...>`
// means "this takes everything a normal <input> takes (type, value,
// onChange, required, etc), PLUS a label prop" — so you use it just like
// a real input: <Field label="Email" type="email" value={x} onChange={...} />
export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        {...props}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </label>
  );
}

// A styled button with a few color "variants" to choose from, so a
// destructive action (delete) can look visually different from a normal
// one (save) without repeating the color classes everywhere.
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  variant?: "primary" | "secondary" | "danger";
} & ButtonHTMLAttributes<HTMLButtonElement> &
  LabelHTMLAttributes<never>) {
  const styles = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// Shows a form error message, or renders nothing at all if there isn't
// one — saves every page from writing `{error && <p>{error}</p>}` themselves.
export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return <p className="text-sm text-red-600">{children}</p>;
}

// A simple bordered/shadowed box — used as the container for basically
// every form and panel in the app, so everything has a consistent look.
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

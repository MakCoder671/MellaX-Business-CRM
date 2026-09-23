import type { InputHTMLAttributes } from "react";

// Same job as components/form.tsx's <Field> (a labeled input), styled to
// match the auth pages' cream/ink palette instead of the dashboard's
// plain gray inputs. Kept separate rather than reskinning the shared
// <Field> everywhere, since the dashboard's forms are a different visual
// context and shouldn't shift just because the auth pages got a redesign.
export function AuthField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium text-ink/80">
      {label}
      <input
        {...props}
        className="mt-1.5 block w-full rounded-xl border border-ink/15 bg-card px-3.5 py-2.5 text-sm text-ink shadow-sm transition-colors placeholder:text-ink/30 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";

// Same job as components/form.tsx's <Field> (a labeled input), styled to
// match the auth pages' cream/ink palette instead of the dashboard's
// plain gray inputs. Kept separate rather than reskinning the shared
// <Field> everywhere, since the dashboard's forms are a different visual
// context and shouldn't shift just because the auth pages got a redesign.
//
// Any type="password" field gets a show/hide toggle automatically, so
// login, signup, and reset-password all behave the same way.
export function AuthField({
  label,
  type,
  id,
  className = "",
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="group">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-ink/75 transition-colors group-focus-within:text-brand"
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          {...props}
          id={inputId}
          type={isPassword && revealed ? "text" : type}
          className={`block w-full rounded-xl border border-ink/15 bg-cream/40 px-3.5 py-2.5 text-sm text-ink shadow-[inset_0_1px_2px_rgba(22,21,43,0.04)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink/30 hover:border-ink/25 focus:border-brand focus:bg-card focus:outline-none focus:ring-4 focus:ring-brand/15 ${
            isPassword ? "pr-11" : ""
          } ${className}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            aria-controls={inputId}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink/40 transition-colors hover:text-ink/70 focus-visible:text-brand focus-visible:outline-none"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

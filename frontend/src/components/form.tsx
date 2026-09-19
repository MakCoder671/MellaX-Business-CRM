import { InputHTMLAttributes, LabelHTMLAttributes, ButtonHTMLAttributes } from "react";

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

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return <p className="text-sm text-red-600">{children}</p>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Small shared building blocks for office screens. Phone width first.

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold">{title}</h1>
      {action}
    </div>
  );
}

export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800">
      {children}
    </Link>
  );
}

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={`rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function SecondaryButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={`rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100 ${className}`}
      {...props}
    />
  );
}

const inputClass =
  "mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-red-700 focus:outline-none";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input className={inputClass} {...props} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea className={inputClass} rows={3} {...props} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select className={inputClass} {...props} />;
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4" {...props} />
      {label}
    </label>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>;
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">{children}</span>;
}

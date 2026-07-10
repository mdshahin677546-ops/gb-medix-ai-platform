"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink/75 transition hover:border-mint/60 hover:text-mint print:hidden"
    >
      {label}
    </button>
  );
}

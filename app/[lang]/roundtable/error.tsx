"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[640px] px-4 py-20 text-center">
      <h2 className="text-lg font-semibold text-ink">Something went wrong.</h2>
      <p className="mt-2 text-sm text-ink/60">Please try again.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-xl border border-mint/40 px-5 py-2.5 text-sm font-semibold text-ink hover:border-mint hover:text-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-mint">
        Retry
      </button>
    </div>
  );
}

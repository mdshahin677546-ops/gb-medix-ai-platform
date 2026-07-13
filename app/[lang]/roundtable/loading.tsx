export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-ink/10" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-ink/10" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-ink/10" />
        ))}
      </div>
    </div>
  );
}

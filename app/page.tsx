import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-normal text-ink sm:text-6xl">
          What is your body type?
        </h1>
        <Link
          href="/en/tcm-check"
          className="mt-8 inline-flex rounded-md bg-leaf px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-ink"
        >
          Start Body Type Test
        </Link>
      </div>
    </main>
  );
}

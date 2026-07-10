import { DoctorLoginForm } from "./doctor-login-form";

export default function DoctorLoginPage() {
  return (
    <main className="ambient-grid min-h-screen px-5 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl content-center gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
        <section>
          <div className="inline-flex rounded-md border border-leaf/20 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-leaf shadow-sm backdrop-blur">
            Doctor Beta Console
          </div>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold text-ink">
            GB Medix doctor intake backend
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-ink/70">
            Register as a beta doctor, review incoming consultation orders, and
            accept cases. Human doctor consultation remains beta-gated.
          </p>
        </section>
        <section className="glass-panel rounded-md p-6">
          <h2 className="text-2xl font-semibold text-ink">Doctor sign in</h2>
          <p className="mt-2 text-sm text-ink/65">
            Email-based beta registration. Add license verification later before
            public launch.
          </p>
          <DoctorLoginForm />
        </section>
      </div>
    </main>
  );
}

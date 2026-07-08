import { DoctorOrders } from "./doctor-orders";

export default function DoctorDashboardPage() {
  return (
    <main className="ambient-grid min-h-screen px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="glass-panel rounded-md p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-leaf">
            Doctor Backend
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-ink">
            Consultation order desk
          </h1>
          <p className="mt-3 text-ink/70">
            Review pending beta consultation orders and accept cases. Patient
            data here is minimal for MVP handoff.
          </p>
        </header>
        <DoctorOrders />
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  userEmail: string;
  question: string;
  summary?: string | null;
  status: string;
  mine: boolean;
  createdAt: string;
};

export function DoctorOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [doctorName, setDoctorName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/doctor/orders");
    const data = await response.json();
    if (!response.ok) {
      setError("Please sign in as a doctor first.");
      return;
    }
    setDoctorName(data.doctor.name);
    setOrders(data.orders);
  }

  useEffect(() => {
    load();
  }, []);

  async function accept(orderId: string) {
    const response = await fetch("/api/doctor/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId })
    });
    if (!response.ok) {
      setError("Order is no longer available.");
      return;
    }
    await load();
  }

  return (
    <section className="mt-6 grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/65">
          {doctorName ? `Signed in: ${doctorName}` : "Doctor session loading..."}
        </p>
        <a href="/doctor/login" className="text-sm text-leaf">
          Switch doctor
        </a>
      </div>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {orders.length ? (
        orders.map((order) => (
          <article key={order.id} className="glass-panel rounded-md p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-ink/45">
                  {order.userEmail}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-ink">
                  {order.question}
                </h2>
              </div>
              <span className="rounded-md bg-white/70 px-3 py-2 text-xs font-medium text-ink">
                {order.mine ? "My case" : order.status}
              </span>
            </div>
            {order.summary ? (
              <p className="mt-3 text-sm leading-6 text-ink/70">{order.summary}</p>
            ) : null}
            {order.status === "pending" ? (
              <button
                onClick={() => accept(order.id)}
                className="premium-button mt-4 rounded-md px-5 py-3 text-sm font-medium"
              >
                Accept order
              </button>
            ) : null}
          </article>
        ))
      ) : (
        <div className="glass-panel rounded-md p-8 text-center text-ink/60">
          No consultation orders yet.
        </div>
      )}
    </section>
  );
}

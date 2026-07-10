"use client";

import { useState } from "react";

export function RFQForm({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    const response = await fetch("/api/rfq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      setStatus("RFQ submitted. We will review your request.");
      form.reset();
    } else {
      setStatus("Submission failed. Please try again.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-5 grid max-w-2xl gap-4 rounded-md border border-white/10 bg-mist/85 p-5"
    >
      {children}
      {status ? <p className="text-sm text-leaf">{status}</p> : null}
      <button className="rounded-md bg-leaf px-5 py-3 font-medium text-[#03101c] hover:brightness-110">
        Submit RFQ
      </button>
    </form>
  );
}

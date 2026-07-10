"use client";

import { useState } from "react";

export function DoctorLoginForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("General wellness");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/doctor/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, specialty, licenseNumber, country })
    });
    if (!response.ok) {
      setError("Doctor sign-in failed.");
      return;
    }
    window.location.href = "/doctor/dashboard";
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3">
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        required
        placeholder="doctor@example.com"
        className="premium-input rounded-md px-3 py-3"
      />
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        placeholder="Doctor name"
        className="premium-input rounded-md px-3 py-3"
      />
      <input
        value={specialty}
        onChange={(event) => setSpecialty(event.target.value)}
        required
        placeholder="Specialty"
        className="premium-input rounded-md px-3 py-3"
      />
      <input
        value={licenseNumber}
        onChange={(event) => setLicenseNumber(event.target.value)}
        required
        placeholder="License number"
        className="premium-input rounded-md px-3 py-3"
      />
      <input
        value={country}
        onChange={(event) => setCountry(event.target.value)}
        required
        placeholder="License country"
        className="premium-input rounded-md px-3 py-3"
      />
      <button className="premium-button rounded-md px-5 py-3 font-medium">
        Enter doctor backend
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </form>
  );
}

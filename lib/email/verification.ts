export function buildVerificationUrl({
  token,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
}: {
  token: string;
  appUrl?: string;
}) {
  const url = new URL("/api/auth/verify-email", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildVerificationEmail({
  token,
  appUrl
}: {
  token: string;
  appUrl?: string;
}) {
  const verificationUrl = buildVerificationUrl({ token, appUrl });
  const text = [
    "Welcome to GB Medix AI.",
    "",
    "Please verify your email to continue your AI Health Assessment and health management journey.",
    "",
    `Verify your email: ${verificationUrl}`,
    "",
    "GB Medix AI provides wellness education and lifestyle guidance. It is not emergency care or a replacement for a licensed professional."
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h1 style="font-size: 22px;">Verify your GB Medix AI email</h1>
      <p>Please verify your email to continue your AI Health Assessment and health management journey.</p>
      <p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 18px; background: #1f9d7a; color: #ffffff; text-decoration: none; border-radius: 6px;">
          Verify email
        </a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p style="font-size: 13px; color: #6b7280;">
        GB Medix AI provides wellness education and lifestyle guidance. It is not emergency care or a replacement for a licensed professional.
      </p>
    </div>
  `;

  return {
    subject: "Verify your GB Medix AI email",
    text,
    html,
    verificationUrl
  };
}

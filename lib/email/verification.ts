type EmailLang = "en" | "zh";

export function buildVerificationUrl({
  token,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  lang
}: {
  token: string;
  appUrl?: string;
  lang?: EmailLang;
}) {
  const url = new URL("/api/auth/verify-email", appUrl);
  url.searchParams.set("token", token);
  if (lang) {
    url.searchParams.set("lang", lang);
  }
  return url.toString();
}

const emailCopy = {
  en: {
    subject: "Verify your GB Medix AI email",
    heading: "Verify your email",
    body: "One click and your AI Health Assessment continues right where you left it.",
    button: "Verify email and continue",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    disclaimer:
      "GB Medix AI provides wellness education and lifestyle guidance. It is not emergency care or a replacement for a licensed professional."
  },
  zh: {
    subject: "验证你的 GB Medix AI 邮箱",
    heading: "验证你的邮箱",
    body: "点击一次,你的 AI 健康评估将从刚才的位置继续。",
    button: "验证邮箱并继续",
    fallback: "如果按钮无法点击,请复制以下链接到浏览器打开:",
    disclaimer:
      "GB Medix AI 提供健康科普与生活方式建议,不构成医疗诊断、急救服务,也不能替代持证医疗专业人员。"
  }
} as const;

export function buildVerificationEmail({
  token,
  appUrl,
  lang = "en"
}: {
  token: string;
  appUrl?: string;
  lang?: EmailLang;
}) {
  const verificationUrl = buildVerificationUrl({ token, appUrl, lang });
  const copy = emailCopy[lang] ?? emailCopy.en;

  const text = [
    "GB Medix AI",
    "",
    copy.body,
    "",
    `Verify your email: ${verificationUrl}`,
    "",
    copy.disclaimer
  ].join("\n");

  const html = `
    <div style="margin: 0 auto; max-width: 560px; font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif;">
      <div style="background: #06111d; border-radius: 12px 12px 0 0; padding: 20px 28px;">
        <span style="color: #ffffff; font-size: 16px; font-weight: 700; letter-spacing: 0.12em;">
          GB <span style="color: #63f5d7;">MEDIX</span> AI
        </span>
      </div>
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 28px; color: #0f172a; line-height: 1.6;">
        <h1 style="margin: 0 0 12px; font-size: 22px;">${copy.heading}</h1>
        <p style="margin: 0 0 20px; color: #334155;">${copy.body}</p>
        <p style="margin: 0 0 24px;">
          <a href="${verificationUrl}" style="display: inline-block; padding: 13px 22px; background: #19d3c5; color: #03101c; font-weight: 600; text-decoration: none; border-radius: 8px;">
            ${copy.button}
          </a>
        </p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">${copy.fallback}</p>
        <p style="margin: 0 0 20px; font-size: 13px; word-break: break-all;">
          <a href="${verificationUrl}" style="color: #0b7cff;">${verificationUrl}</a>
        </p>
        <p style="margin: 0; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          ${copy.disclaimer}
        </p>
      </div>
    </div>
  `;

  return {
    subject: copy.subject,
    text,
    html,
    verificationUrl
  };
}

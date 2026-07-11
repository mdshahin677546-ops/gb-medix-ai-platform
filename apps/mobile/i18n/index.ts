/** Minimal i18n base (en/zh). Non-diagnostic health-management wording only. */
export type Locale = "en" | "zh";

export const messages = {
  en: {
    brand: "GB MEDIX AI",
    tabHome: "Home",
    tabAiHealth: "AI Health",
    tabRecords: "Records",
    tabProfile: "Me",
    disclaimer:
      "GB MEDIX AI provides health management guidance and lifestyle education. It does not provide diagnosis, treatment, prescriptions, or replace a licensed professional.",
    consentTitle: "Third-party AI processing notice",
    signIn: "Sign in",
    register: "Create account",
    loading: "Loading...",
    emptyReports: "No reports yet.",
    genericError: "Something went wrong. Please try again."
  },
  zh: {
    brand: "GB MEDIX AI",
    tabHome: "首页",
    tabAiHealth: "AI 健康",
    tabRecords: "健康档案",
    tabProfile: "我的",
    disclaimer:
      "GB MEDIX AI 提供健康管理建议与生活方式教育，不构成诊断、治疗、处方，也不替代持证专业人员。",
    consentTitle: "第三方 AI 处理说明",
    signIn: "登录",
    register: "注册",
    loading: "加载中...",
    emptyReports: "暂无报告。",
    genericError: "出错了，请重试。"
  }
} as const;

export function t(locale: Locale, key: keyof (typeof messages)["en"]): string {
  return messages[locale][key];
}

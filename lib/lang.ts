export const languages = ["en", "es", "fr", "de", "ja", "ko"] as const;

export type Lang = (typeof languages)[number];

export function isLang(value: string): value is Lang {
  return languages.includes(value as Lang);
}

export function getLang(value?: string): Lang {
  return value && isLang(value) ? value : "en";
}

export const copy = {
  en: {
    cta: "Start Body Type Test",
    title: "What is your body type?",
    analyze: "Analyze My Body Type",
    checkout: "Unlock the full 7-day plan for $9.99",
    disclaimer: "Wellness insights only. This is not medical advice, diagnosis, or treatment."
  },
  es: {
    cta: "Comenzar prueba",
    title: "What is your body type?",
    analyze: "Analyze My Body Type",
    checkout: "Unlock the full 7-day plan for $9.99",
    disclaimer: "Solo bienestar. No es consejo medico, diagnostico ni tratamiento."
  },
  fr: {
    cta: "Commencer le test",
    title: "What is your body type?",
    analyze: "Analyze My Body Type",
    checkout: "Unlock the full 7-day plan for $9.99",
    disclaimer: "Informations bien-etre uniquement. Aucun diagnostic ni traitement."
  },
  de: {
    cta: "Test starten",
    title: "What is your body type?",
    analyze: "Analyze My Body Type",
    checkout: "Unlock the full 7-day plan for $9.99",
    disclaimer: "Nur Wellness-Informationen. Keine medizinische Beratung, Diagnose oder Behandlung."
  },
  ja: {
    cta: "体質チェックを始める",
    title: "What is your body type?",
    analyze: "Analyze My Body Type",
    checkout: "Unlock the full 7-day plan for $9.99",
    disclaimer: "ウェルネス情報のみです。医療助言、診断、治療ではありません。"
  },
  ko: {
    cta: "체질 테스트 시작",
    title: "What is your body type?",
    analyze: "Analyze My Body Type",
    checkout: "Unlock the full 7-day plan for $9.99",
    disclaimer: "웰니스 참고용입니다. 의학적 조언, 진단 또는 치료가 아닙니다."
  }
} satisfies Record<Lang, Record<string, string>>;

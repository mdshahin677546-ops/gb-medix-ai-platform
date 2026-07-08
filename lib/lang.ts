export const languages = ["en", "es", "fr", "de", "ja", "ko", "zh"] as const;

export type Lang = (typeof languages)[number];

export const languageNames: Record<Lang, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "\u65e5\u672c\u8a9e",
  ko: "\ud55c\uad6d\uc5b4",
  zh: "\u4e2d\u6587"
};

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
    cta: "\u4f53\u8cea\u30c1\u30a7\u30c3\u30af\u3092\u59cb\u3081\u308b",
    title: "What is your body type?",
    analyze: "Analyze My Body Type",
    checkout: "Unlock the full 7-day plan for $9.99",
    disclaimer: "\u30a6\u30a7\u30eb\u30cd\u30b9\u60c5\u5831\u306e\u307f\u3067\u3059\u3002\u533b\u7642\u52a9\u8a00\u3001\u8a3a\u65ad\u3001\u6cbb\u7642\u3067\u306f\u3042\u308a\u307e\u305b\u3093\u3002"
  },
  ko: {
    cta: "\uccb4\uc9c8 \ud14c\uc2a4\ud2b8 \uc2dc\uc791",
    title: "What is your body type?",
    analyze: "Analyze My Body Type",
    checkout: "Unlock the full 7-day plan for $9.99",
    disclaimer: "\uc6f0\ub2c8\uc2a4 \ucc38\uace0\uc6a9\uc785\ub2c8\ub2e4. \uc758\ud559\uc801 \uc870\uc5b8, \uc9c4\ub2e8 \ub610\ub294 \uce58\ub8cc\uac00 \uc544\ub2d9\ub2c8\ub2e4."
  },
  zh: {
    cta: "\u5f00\u59cb\u4f53\u8d28\u6d4b\u8bd5",
    title: "\u4f60\u7684\u4f53\u8d28\u7c7b\u578b\u662f\u4ec0\u4e48\uff1f",
    analyze: "\u5206\u6790\u6211\u7684\u4f53\u8d28",
    checkout: "\u89e3\u9501\u5b8c\u6574 7 \u5929\u8c03\u7406\u8ba1\u5212\uff0c$9.99",
    disclaimer: "\u4ec5\u63d0\u4f9b\u5065\u5eb7\u751f\u6d3b\u65b9\u5f0f\u53c2\u8003\uff0c\u4e0d\u6784\u6210\u533b\u7597\u5efa\u8bae\u3001\u8bca\u65ad\u6216\u6cbb\u7597\u3002"
  }
} satisfies Record<Lang, Record<string, string>>;

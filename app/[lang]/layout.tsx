import { SetDocumentLang } from "@/components/SetDocumentLang";

export default function LangLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  const lang = params.lang === "zh" ? "zh" : "en";

  return (
    <>
      <SetDocumentLang lang={lang} />
      {children}
    </>
  );
}

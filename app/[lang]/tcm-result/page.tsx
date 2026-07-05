import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { ResultView } from "./result-view";

export default function TCMResultPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <ResultView lang={lang} />
    </Shell>
  );
}

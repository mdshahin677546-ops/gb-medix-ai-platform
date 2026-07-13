import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { resolveShowcaseLang } from "./showcase-data";
import { RoundtableShowcase } from "./roundtable-showcase";

// Read-only Medical Roundtable showcase (internal review). Static demonstration
// data only — no data fetching, no Server Action, no provider/network call.
export default function RoundtableShowcasePage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);
  const showcaseLang = resolveShowcaseLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="px-4 py-8 sm:px-8 lg:px-12">
        <RoundtableShowcase lang={showcaseLang} />
      </div>
    </Shell>
  );
}

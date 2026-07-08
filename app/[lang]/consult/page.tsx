import { Shell } from "@/components/Shell";
import { getLang } from "@/lib/lang";
import { ConsultRoom } from "./consult-room";

export default function ConsultPage({ params }: { params: { lang: string } }) {
  const lang = getLang(params.lang);

  return (
    <Shell lang={lang}>
      <div className="grid gap-6">
        <section className="glass-panel rounded-md p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-leaf">
                Online Consultation Beta
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-ink">
                {lang === "zh" ? "\u5728\u7ebf\u95ee\u8bca\u7cfb\u7edf" : "Online Consultation System"}
              </h1>
              <p className="mt-3 max-w-3xl text-ink/70">
                {lang === "zh"
                  ? "\u533b\u751f\u5bf9\u63a5\u80fd\u529b\u5df2\u9884\u7559\uff0c\u76ee\u524d\u5904\u4e8e\u5185\u6d4b\u4e2d\u3002\u4f60\u53ef\u4ee5\u5148\u4f7f\u7528 AI \u9884\u95ee\u8bca\u6574\u7406\u95ee\u9898\uff0c\u514d\u8d39 3 \u6761\uff0c\u4e4b\u540e\u9700\u8981\u89e3\u9501\u7ee7\u7eed\u54a8\u8be2\u3002"
                  : "Doctor handoff is reserved for later. This beta currently offers AI pre-consultation to organize wellness questions: 3 free messages, then paid unlock."}
              </p>
            </div>
            <div className="rounded-md bg-amber/20 px-4 py-3 text-sm font-medium text-clay">
              {lang === "zh" ? "\u5185\u6d4b\u4e2d" : "Beta testing"}
            </div>
          </div>
        </section>
        <ConsultRoom lang={lang} />
      </div>
    </Shell>
  );
}

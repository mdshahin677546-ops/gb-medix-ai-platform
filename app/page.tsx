import Image from "next/image";
import Link from "next/link";

const metrics = [
  ["今日问诊", "Consults Today", "28", "+12%"],
  ["待处理患者", "Pending Patients", "7", "-13%"],
  ["随访患者", "Follow-ups", "16", "+6%"],
  ["AI 建议采纳", "AI Acceptance", "82%", "+8%"]
];

const supplyRows = [
  ["订单", "PO2505201001", "一次性医用雾化器 5ml", "生产中", "65%", "$28,560"],
  ["RFQ", "RFQ250519002", "心电监护仪", "报价中", "40%", "$156,800"],
  ["订单", "PO2505180899", "医用外科口罩", "已发货", "85%", "$12,450"],
  ["RFQ", "RFQ250517007", "全自动生化分析仪", "评估中", "20%", "$328,000"]
];

const vitals = [
  ["体温", "Temp", "37.3 C", "轻度升高"],
  ["心率", "Heart", "88 bpm", "正常"],
  ["血氧", "SpO2", "98%", "正常"],
  ["呼吸频率", "Respiration", "18 rpm", "正常"],
  ["压力指数", "Stress", "42", "中等"],
  ["睡眠质量", "Sleep", "72", "良好"]
];

export default function HomePage() {
  return (
    <main className="ambient-grid min-h-screen px-4 py-4 text-ink sm:px-6">
      <div className="grid min-h-[calc(100vh-2rem)] overflow-hidden rounded-md border border-white/10 bg-[#030914]/90 shadow-2xl shadow-black/30 backdrop-blur-xl min-[1400px]:grid-cols-[250px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#020812]/90 p-5 min-[1400px]:flex min-[1400px]:flex-col">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
            <span className="brand-mark rounded-md text-sm font-bold">GB</span>
            <span>
              <span className="block leading-5">GB Medix</span>
              <span className="block text-xs font-medium text-ink/55">AI Platform</span>
            </span>
          </Link>

          <nav className="mt-9 grid gap-1 text-sm">
            {[
              ["首页", "Dashboard", "/"],
              ["AI 助手", "Assistant", "/en/assistant"],
              ["AI 问诊", "Consult", "/en/consult"],
              ["身体检测", "Body Test", "/en/tcm-check"],
              ["商城", "Products", "/en/shop"],
              ["供应链", "RFQ", "/en/rfq"],
              ["数据看板", "Dashboard", "/en/dashboard"]
            ].map(([label, sublabel, href], index) => (
              <Link
                key={href}
                href={href}
                className={
                  index === 0
                    ? "rounded-md border border-leaf/25 bg-leaf/10 px-4 py-3 font-medium text-mint shadow-[inset_3px_0_0_rgba(99,245,215,0.85)]"
                    : "rounded-md px-4 py-3 text-ink/60 transition hover:bg-white/10 hover:text-ink"
                }
              >
                <span>{label}</span>
                <span className="ml-2 text-xs text-ink/40">{sublabel}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-md border border-white/10 bg-white/5 p-4 text-xs text-ink/55">
            <p className="font-semibold text-ink">GB Medix Hospital</p>
            <p className="mt-1">临床运营控制台 / Clinical Ops</p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#06111d]/80 px-5 py-4">
            <div className="flex items-center gap-3 text-sm text-ink/65">
              <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_16px_rgba(99,245,215,0.95)]" />
              <span>系统状态：正常</span>
              <span className="hidden text-white/20 sm:inline">|</span>
              <span className="hidden sm:inline">AI 问诊 + 供应链指挥台</span>
            </div>
            <div className="min-w-[260px] flex-1 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink/50 lg:max-w-md">
              搜索患者、订单、RFQ、产品...
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-md border border-mint/20 bg-mint/10 px-3 py-2 text-mint">AI Ready</span>
              <Link href="/en/assistant" className="premium-button rounded-md px-4 py-2 font-semibold">
                进入系统
              </Link>
            </div>
          </header>

          <div className="grid gap-4 p-4 lg:grid-cols-[1.15fr_0.68fr]">
            <div className="grid gap-4">
              <section className="glass-panel rounded-md p-4">
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h1 className="text-xl font-semibold">AI 问诊 / AI Consultation</h1>
                    <p className="mt-1 text-xs text-ink/50">智能分诊 / 实时问答 / 医生交接</p>
                  </div>
                  <span className="rounded-md border border-mint/20 px-3 py-1 text-xs text-mint">实时</span>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.95fr_1fr]">
                  <div className="rounded-md border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">李明 Li Ming</p>
                        <p className="mt-1 text-xs text-ink/50">男 / 35岁 / ID: P2505201024 / 在线问诊</p>
                      </div>
                      <span className="rounded-md bg-mint/10 px-3 py-2 text-xs text-mint">已解析</span>
                    </div>

                    <div className="mt-5 grid gap-4 text-sm">
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-ink/50">Chief Complaint</p>
                        <p className="leading-6 text-ink/80">咳嗽伴轻微发热 2 天，夜间加重，偶有胸痛。</p>
                      </div>
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-ink/50">AI Analysis</p>
                        <p className="leading-6 text-ink/70">可能为上呼吸道感染，建议结合体温、血氧和症状进展判断是否升级处理。</p>
                        <div className="mt-3 flex items-center gap-3">
                          <span className="text-mint">置信度 78%</span>
                          <span className="h-2 flex-1 rounded-md bg-white/10">
                            <span className="block h-2 w-[78%] rounded-md bg-mint" />
                          </span>
                        </div>
                      </div>
                      <div className="rounded-md border border-mint/20 bg-mint/10 p-3">
                        <p className="text-xs text-ink/50">推荐分诊 / Triage Recommendation</p>
                        <p className="mt-1 text-mint">呼吸内科 / 优先级：普通</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid content-between gap-4 rounded-md border border-white/10 bg-[#071827]/90 p-4">
                    <div className="grid gap-3 text-sm">
                      <div className="mr-auto max-w-[78%] rounded-md bg-white/10 px-4 py-3 text-ink/80">您好，我是 GB Medix AI 助手。请问有什么可以帮助您？</div>
                      <div className="ml-auto max-w-[82%] rounded-md bg-[#0d2234] px-4 py-3 text-ink/70">咳嗽伴轻微发热两天，夜间加重。</div>
                      <div className="mr-auto max-w-[82%] rounded-md bg-white/10 px-4 py-3 text-ink/80">是否伴随呼吸急促、黄色痰液、乏力或肌肉酸痛？</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["否", "轻微乏力", "黄色痰液"].map((item) => (
                        <button key={item} className="rounded-md border border-sky-400/35 px-4 py-2 text-sm text-sky-200 transition hover:bg-sky-400/10">
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="glass-panel rounded-md p-4">
                <h2 className="mb-4 text-lg font-semibold">医生工作台 / Workflow Overview</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {metrics.map(([label, sublabel, value, trend]) => (
                    <div key={label} className="metric-tile rounded-md p-4">
                      <p className="text-sm text-ink/55">{label}</p>
                      <p className="mt-1 text-xs text-ink/35">{sublabel}</p>
                      <p className="mt-2 text-3xl font-semibold">{value}</p>
                      <p className="mt-1 text-xs text-mint">较昨日 {trend}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass-panel rounded-md p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">供应链 / 订单与 RFQ 状态</h2>
                  <Link href="/en/rfq" className="text-sm text-sky-300">查看全部</Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-white/10 text-xs text-ink/50">
                      <tr>{["类型", "编号 / 名称", "状态", "进度", "金额", "操作"].map((heading) => <th key={heading} className="py-3 font-medium">{heading}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-ink/70">
                      {supplyRows.map(([type, code, name, status, progress, amount]) => (
                        <tr key={code}>
                          <td className="py-3"><span className="rounded-md border border-mint/25 bg-mint/10 px-2 py-1 text-xs text-mint">{type}</span></td>
                          <td className="py-3"><p className="font-medium text-ink">{code}</p><p className="text-xs text-ink/50">{name}</p></td>
                          <td className="py-3"><span className="rounded-md border border-amber/30 bg-amber/10 px-2 py-1 text-xs text-amber">{status}</span></td>
                          <td className="py-3"><div className="flex items-center gap-2"><span className="h-2 w-20 rounded-md bg-white/10"><span className="block h-2 rounded-md bg-mint" style={{ width: progress }} /></span><span className="text-xs">{progress}</span></div></td>
                          <td className="py-3">{amount}</td>
                          <td className="py-3 text-sky-300">查看</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="grid content-start gap-4">
              <section className="glass-panel rounded-md p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">身体模式扫描 / Body Pattern Scan</h2>
                  <Link href="/en/tcm-check" className="text-sm text-sky-300">更多</Link>
                </div>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    {vitals.map(([label, sublabel, value, status]) => (
                      <div key={label} className="rounded-md border border-white/10 bg-white/5 p-3">
                        <p className="text-xs text-ink/50">{label}</p>
                        <p className="mt-1 text-xs text-ink/35">{sublabel}</p>
                        <p className="mt-1 text-2xl font-semibold">{value}</p>
                        <p className="mt-1 text-xs text-mint">{status}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid place-items-center rounded-md border border-white/10 bg-[#061522]/70 p-3">
                    <Image src="/assets/medical-body-scan.png" alt="Medical body scan visualization" width={320} height={300} className="scan-image h-auto w-full max-w-[260px]" priority />
                  </div>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-sm text-ink/50">综合健康评分 / Overall health score</p>
                  <div className="mt-2 flex items-end gap-2"><span className="text-5xl font-semibold text-mint">72</span><span className="pb-2 text-ink/50">/100 / 良好</span></div>
                </div>
              </section>

              <section className="glass-panel rounded-md p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">健康指标趋势 / Health Trend</h2>
                  <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-ink/55">近 7 天</span>
                </div>
                <div className="grid gap-3">
                  {[37.1, 37.2, 37.0, 37.3, 37.2, 37.4, 37.3].map((item, index) => (
                    <div key={`${item}-${index}`} className="flex items-center gap-3">
                      <span className="w-10 text-xs text-ink/50">05-{14 + index}</span>
                      <span className="h-2 flex-1 rounded-md bg-white/10"><span className="block h-2 rounded-md bg-sky-400" style={{ width: `${48 + index * 7}%` }} /></span>
                      <span className="w-10 text-right text-xs text-mint">{item}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass-panel rounded-md p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">AI 风险提示 / Risk Alerts</h2>
                  <span className="text-sm text-sky-300">查看全部 (3)</span>
                </div>
                <div className="grid gap-2 text-sm">
                  {[
                    ["高", "王建国，63 岁，血压持续偏高", "10:10"],
                    ["中", "刘敏，45 岁，睡眠质量下降", "09:42"],
                    ["低", "陈明，28 岁，久坐时间增加", "08:55"]
                  ].map(([level, text, time]) => (
                    <div key={text} className="grid grid-cols-[68px_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-3">
                      <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-amber">{level}</span>
                      <span className="text-ink/70">{text}</span>
                      <span className="text-xs text-ink/40">{time}</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

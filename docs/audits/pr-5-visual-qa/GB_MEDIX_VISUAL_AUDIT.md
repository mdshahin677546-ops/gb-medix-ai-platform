# GB Medix Visual Audit

Audit target: `http://localhost:3002/zh/dashboard`

Screenshot evidence:

- `design-audit/01-zh-dashboard.png`

Design direction requested:

- More technological
- Cooler visual presence
- Still professional and credible for health management

## Step 1: Dashboard, Signed-Out State

General health: solid foundation, but not yet premium enough.

### What Works

- The dark command-center shell is directionally right for an AI health product.
- Mint and blue accents already create a recognizable technical palette.
- Navigation, hero, metrics, and health path are easy to scan.
- The glass panel language is consistent across the app.
- The medical disclaimer is present and visible.

### Visual Issues

1. The page reads more like an admin console than a premium consumer health product.
   The strong left navigation and dense dashboard labels feel operational. For a user health center, the first viewport should feel more personal, guided, and high-trust.

2. The hero area is too flat for the desired "cool tech" direction.
   The current hero relies on text and panels, but it lacks a strong signal such as a biometric scan strip, AI status rail, report readiness indicator, or health data visualization.

3. Metric cards are visually quiet.
   The four tiles show zero values, but there is no empty-state richness. They could use small icon/indicator systems, micro charts, glowing progress strokes, or state badges.

4. The color hierarchy is too even.
   Many panels share similar dark blue/mint treatment. This keeps consistency, but it weakens visual drama. Important states should get brighter mint/blue edges, and passive areas should recede more.

5. The health management path has good structure but low cinematic value.
   The progress bars work, but they look basic compared with the AI/health-tech positioning. They could become segmented scan bars or step cards with active state energy.

6. Signed-out state is clear, but not persuasive.
   The "未登录模式" card tells the user to sign in, yet it does not explain the immediate value: free assessment, free report, Premium report unlock.

7. The top search bar is visually present but functionally unclear.
   It looks like an input but acts like static placeholder text. This can reduce perceived polish.

8. Header and sidebar feel slightly heavy.
   The brand and nav are strong, but the first viewport gets compressed by two navigation layers on desktop-like widths in the screenshot. More breathing room around the hero would feel more premium.

### Accessibility Risks From Screenshot

- Some secondary text uses low contrast against dark panels, especially muted Chinese labels and small captions.
- The current "AI Ready" and active nav states rely heavily on color. Add icon/shape/state labels where possible.
- Small uppercase tracking works visually but may reduce readability in Chinese contexts.
- Progress bars need text labels for meaning, not just color/width.

## Recommended Visual Upgrade Direction

### Direction A: Medical AI Command Center

Best for: professional, credible, premium.

Changes:

- Add a thin "system telemetry" band under the hero:
  - AI provider status
  - consent status
  - report readiness
  - health profile completeness
- Convert metric cards into instrumentation tiles:
  - small line chart
  - status dot
  - last updated label
  - empty-state CTA
- Add subtle animated scan line only inside key panels, not everywhere.
- Use more precise labels: "Health reports", "Premium access", "AI consent", "Next action".

### Direction B: Consumer Health Cockpit

Best for: user conversion and onboarding.

Changes:

- Hero becomes a guided next-step panel:
  - "Start your free AI health assessment"
  - "3 minutes"
  - "No diagnosis, health management guidance only"
- Replace zero-heavy metrics with value-focused cards:
  - "Free assessment"
  - "Free result"
  - "Premium report"
  - "Lifestyle plan"
- Add one primary CTA and one secondary action.
- Make signed-out mode feel like an invitation, not a warning.

### Direction C: Futuristic Wellness Scanner

Best for: cooler, more dramatic landing/dashboard feel.

Changes:

- Add an AI scan visual module in the dashboard hero:
  - radial health score placeholder
  - pulsing biometric ring
  - segmented scan bars
- Use brighter cyan/mint glows in only 2-3 focus areas.
- Add more depth with layered borders, corner brackets, and subtle grid gradients.
- Keep text restrained so the product does not look like a game.

## Highest-Impact Fixes

1. Make the signed-out dashboard action-oriented.
   Add a primary CTA: "开始免费 AI 健康评估". Secondary: "登录 / 创建账户".

2. Add a hero-side status module.
   Show:
   - AI Provider: OpenAI / DeepSeek
   - Consent: required / accepted / not needed
   - Report status: no assessment yet
   - Next action: start body test

3. Upgrade metric tiles from plain counters into state cards.
   Use:
   - tiny status badge
   - mono-style data label
   - empty-state action
   - faint glowing bottom border

4. Improve visual hierarchy.
   Make only the primary CTA and current step bright. Push inactive panels darker.

5. Rework health management path.
   Turn the progress list into a four-step rail with active step, locked steps, and clear next CTA.

6. Make the dashboard feel less like operations.
   Replace generic "数据看板" feeling with personal health wording:
   - "健康中心"
   - "今日下一步"
   - "你的 AI 健康路径"

7. Add a refined AI consent summary module.
   This is especially important before DeepSeek production. It can become a trust-building element instead of buried compliance.

## Suggested Implementation Sequence

1. First pass: dashboard hero, signed-out CTA, metric state cards.
2. Second pass: consent status module and health path rail.
3. Third pass: polish motion, hover states, contrast, mobile spacing.

## Do Not Do

- Do not add stock medical imagery.
- Do not make the page look like a hospital EHR.
- Do not overuse glow on every card.
- Do not use diagnosis/treatment language.
- Do not hide disclaimers or consent status.

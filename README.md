# ProofPay

**Freelance payments that release themselves.**

ProofPay works for any job whose result can be checked against written requirements: copywriting, social media packs, logo and banner design, spreadsheet and data cleaning, small coding tasks and translations.

Clients and freelancers each have their own account. The client funds a job through PayPal. An AI agent turns the brief into an acceptance checklist both sides can see, checks the delivered work item by item with quoted evidence, confirms the funds with PayPal, and pays the freelancer through PayPal Payouts the moment every item passes. If something is missing, the agent sends the work back with a list of what to fix.

**Live demo:** https://proofpay-szfp.onrender.com (PayPal sandbox, test money only. On the free tier the first load can take up to a minute.)

\---

## The problem

Small freelance jobs (a product description, a short report, a logo, a script) run on trust. Clients worry about paying for work that doesn't match the brief; freelancers worry about delivering and never being paid. Marketplaces solve this with escrow plus human review, which is slow and costly for jobs worth $5 to $500. Disputes are usually about one question: *did the delivery meet what was asked?*

## What ProofPay does

1. **Client posts a job.** Pick a job type (or start from a ready-made brief), set a budget and an optional due date. **Check my brief** (AI brief coach) flags requirements that can't be checked objectively, suggests missing ones and a fair budget, and offers an improved brief. The AI then converts the brief into a numbered checklist of objective, checkable requirements, each with a note on how it will be checked.
2. **Client funds it with PayPal.** The PayPal order is captured and the money is held by the platform.
3. **Freelancer finds work and submits.** The **Find work** board lists funded jobs by type, with the checklist visible up front. The first freelancer to accept gets the job; from then on **only that client and that freelancer can open it**, and it shows as *Accepted* to everyone else. Each freelancer has a track record (jobs paid, first-try pass rate, earnings). Work is pasted or uploaded: text, PDF, image, CSV or code.
4. **AI verifies.** Each checklist item gets pass or fail, a one-line reason and quoted evidence. Facts are **measured exactly by code** for each job type and handed to the model, so limits are never guessed:

|Job type|Measured by code|
|-|-|
|Writing, translation|words (total, per paragraph, first and last line), bullets, lines, links|
|Social media|posts, hashtags, mentions, emojis, longest line in characters|
|Design|image format, width and height in pixels, aspect ratio, square, transparency, file size|
|Data cleaning (CSV)|header row, columns, rows, duplicate rows, empty cells per column, invalid emails, date formats|
|Code|functions and classes defined, language, line counts, TODOs, tests and docstrings present|

5. **Settlement agent moves the money.** If every item passed, the agent calls `verify\_funding` (PayPal Agent Toolkit `get\_order`) to confirm the capture, then `release\_payment` (PayPal Payouts). Otherwise it calls `request\_revision` with a specific list of what to fix.
6. **Disputes get a second opinion.** If the check fails, the freelancer can ask for a second opinion: a different AI model re-checks the same submission independently. If it passes, the client makes the final call (approve and pay, or keep the rejection).
7. **Ask the agent.** On each job, the client and freelancer can ask questions ("What do I still need to fix?", "Where is my money?"). The agent answers from the job record and can look up the live PayPal payment status via the Agent Toolkit. It can explain but never move money.
8. **Everything is on the record.** Each user's dashboard (built with **AG Grid**) lists their jobs with status, checklist results and deadlines. A money path shows where the money is (client, held, freelancer), and an audit trail logs every agent decision and PayPal movement with its reference IDs.

**Fair refunds with deadlines.** The client can cancel and be refunded through PayPal before a freelancer accepts, or after a missed deadline, but not while a freelancer is working on time.

## How PayPal is used

|Step|PayPal capability|
|-|-|
|Client funds the job|Orders API v2: create order, buyer approval, capture|
|Agent confirms funds before paying|**PayPal Agent Toolkit** `get\_order` (Orders API as fallback)|
|Freelancer is paid|**Payouts API**, one payout per job (`sender\_batch\_id` as duplicate guard)|
|Job cancelled|**PayPal Agent Toolkit** `create\_refund` (Payments API as fallback)|

## How AI is used

|Step|Model work|
|-|-|
|Brief → checklist|Structured output: 2–10 objective requirements plus how each is checked|
|Verification|Structured output: per-item pass/fail, reason, evidence; reads text, PDFs and images|
|Brief coach|Structured output: uncheckable phrases with measurable rewrites, missing requirements, fair price range, improved brief|
|Settlement|Tool-calling agent with `verify\_funding`, `release\_payment`, `request\_revision`|
|Second opinion|Independent re-check by a different model, with the original file|
|Ask the agent|Read-only tool-calling assistant with `check\_paypal\_payment` (Agent Toolkit)|

Models: Google Gemini (`gemini-3.8-flash`, with automatic fallback to other Gemini models) and optionally Groq (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`) or Anthropic Claude, via the Vercel AI SDK. The provider chain is configured with environment variables.

## Safety by design

The AI decides, but hard rules sit **in code, not in the prompt**:

* **No payout without a full pass.** `release\_payment` refuses unless every checklist item passed. The overall result is recomputed from the item results, not taken from the model.
* **No payout without confirmed funds.** `release\_payment` refuses until `verify\_funding` has confirmed the capture with PayPal.
* **No double payment.** The payout status is re-read from the database before paying, and PayPal's `sender\_batch\_id` is unique per job.
* **Spend cap.** No single payout above `MAX\_PAYOUT\_USD`.
* **Prompt-injection resistant.** The verifier is told to ignore any instructions inside the submission.
* **Money never gets stuck.** If the AI is unavailable at settlement, the same rules are applied directly, and the audit trail records it.
* **Locked checklist.** The checklist is fixed when the job is posted, so neither side can move the goalposts.
* **Accounts and roles.** Only the client can fund, refund or decide a dispute; only the freelancer who accepted can submit. Accepting is atomic, so two freelancers can't win the same job. Passwords are hashed with scrypt and sessions are signed cookies.
* **Payouts go to the accepted freelancer's account email**, never to an address typed at payout time.

## Architecture

```
Client / Freelancer (browser)
        │
        ▼
Next.js app on Render ── Postgres (Neon): jobs, submissions, events
        │
        ├── AI layer (Vercel AI SDK): checklist · verification · settlement agent
        │        └── Gemini / Groq / Claude with automatic fallback
        └── PayPal sandbox: Orders · Agent Toolkit · Payouts · Refunds
```

Key files:

* `lib/ai.ts`: checklist generation and verification
* `lib/measure.ts`, `lib/textstats.ts`: exact measurements for text, CSV, code and images
* `lib/templates.ts`: job types and ready-made briefs
* `lib/rules.ts`, `lib/stats.ts`: refund rule, deadlines, freelancer track record
* `lib/auth.ts`, `app/login/`: accounts, roles, sessions and job access rules
* `lib/dashboard.ts`, `app/jobs-grid.tsx`: AG Grid dashboards
* `lib/agent.ts`: settlement agent and its guarded tools
* `lib/paypal.ts`: Orders, Payouts and Refunds REST client
* `lib/paypal-toolkit.ts`: PayPal Agent Toolkit integration
* `lib/model.ts`: model provider chain, timeouts and fallback
* `app/`: pages, server actions and the PayPal return route

## Try it (judges)

Use the one-click demo accounts on the sign-in page. Open the demo freelancer in a second browser or a private window to see both sides at once.

1. Open the live demo → **Sign in** → **Continue as the demo client**. Under **Start from a job type** click **Use this** on *Product description*, optionally click **Check my brief**, then **Post job and create checklist**.
2. Click **Fund with PayPal** and log in to PayPal with the sandbox **client** account:

   * Email: `sb-kszla53855379@personal.example.com`
   * Password: `7H)Z">q)`
3. In the second browser, **Continue as the demo freelancer** → **Find work** → open the job → **Accept job**.
4. Click **Paste the sample deliverable** (or paste the sample below) and click **Submit for checking**. Samples exist for every text-based job type; for the design job, upload any PNG or JPG.
5. Watch the checklist turn green, the money path move to the freelancer, and the payout batch appear in the payment record.

To see the revision path, submit the same text with one bullet deleted: item 3 fails and the agent asks for changes instead of paying.

<details>
<summary>Sample submission that passes</summary>

```
Stay Smart, Stay Hydrated with HydraSmart

HydraSmart is the water bottle that thinks ahead so you don't have to. Built from double-walled stainless steel, it keeps drinks icy cold through long workdays, gym sessions and weekend hikes. A sleek LED cap shows the exact temperature of your water at a tap, so you always know what you're sipping. Gentle glowing reminders nudge you to drink throughout the day, helping you build a healthy hydration habit without another app to manage. The leak-proof lid slips easily into any bag, and the matte finish resists scratches and fingerprints. Whether you're commuting, training or travelling, HydraSmart keeps you refreshed, focused and ready for whatever the day brings. It is simple to clean, easy to carry and made to last for years.

- Temperature display: the LED cap shows your drink's temperature with a single tap.
- Hydration reminders: a soft glow reminds you to drink at regular intervals.
- 24-hour cold retention: double-wall insulation keeps water cold for a full day.

Order your HydraSmart today and make every sip count.
```

</details>

## Run it yourself

Requirements: Node.js 20+, a Postgres database, a PayPal developer sandbox app (with Payouts enabled), and a Gemini, Groq or Anthropic API key.

```bash
npm install
cp env.example .env.local   # fill in the values
npm run build \&\& npm start
```

|Variable|Purpose|
|-|-|
|`PAYPAL\_CLIENT\_ID`, `PAYPAL\_CLIENT\_SECRET`|Sandbox app credentials|
|`PAYPAL\_ENV`|`sandbox`|
|`APP\_URL`|Public URL, used for the PayPal return link|
|`DATABASE\_URL`|Postgres connection string|
|`GOOGLE\_GENERATIVE\_AI\_API\_KEY` / `GROQ\_API\_KEY` / `ANTHROPIC\_API\_KEY`|Any one or more|
|`MAX\_PAYOUT\_USD`|Spend cap per payout (default 500)|
|`SESSION\_SECRET`|Optional; signs login cookies (derived from the PayPal secret if unset)|

Tables are created automatically on first run.

## Production path

The demo holds funds in the platform's sandbox business account and pays out with Payouts. A live launch would use PayPal's multiparty/marketplace onboarding for proper held funds and seller onboarding, add a human dispute desk for contested verdicts, and add PayPal webhooks for status sync.

## License

MIT. See [LICENSE](LICENSE).


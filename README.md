# ProofPay

**Freelance payments that release themselves.**

ProofPay works for any job whose result can be checked against written requirements: copywriting, social media packs, logo and banner design, spreadsheet and data cleaning, small coding tasks and translations.

The client funds a job through PayPal. An AI agent turns the brief into an acceptance checklist both sides can see, checks the delivered work item by item with quoted evidence, confirms the funds with PayPal, and pays the freelancer through PayPal Payouts the moment every item passes. If something is missing, the agent sends the work back with a list of what to fix.

**Live demo:** https://proofpay-szfp.onrender.com (PayPal sandbox, test money only. On the free tier the first load can take up to a minute.)

---

## The problem

Small freelance jobs (a product description, a short report, a logo, a script) run on trust. Clients worry about paying for work that doesn't match the brief; freelancers worry about delivering and never being paid. Marketplaces solve this with escrow plus human review, which is slow and costly for jobs worth $5 to $500. Disputes are usually about one question: *did the delivery meet what was asked?*

## What ProofPay does

1. **Client posts a job.** Pick a job type (or start from a ready-made brief), set a budget and an optional due date. The AI converts the brief into a numbered checklist of objective, checkable requirements, each with a note on how it will be checked.
2. **Client funds it with PayPal.** The PayPal order is captured and the money is held by the platform.
3. **Freelancer finds work and submits.** The **Find work** board lists funded jobs by type, with the checklist visible up front and the freelancer's track record (jobs paid, first-try pass rate, earnings). Work is pasted or uploaded: text, PDF, image, CSV or code.
4. **AI verifies.** Each checklist item gets pass or fail, a one-line reason and quoted evidence. Facts are **measured exactly by code** for each job type and handed to the model, so limits are never guessed:

   | Job type | Measured by code |
   |---|---|
   | Writing, translation | words (total, per paragraph, first and last line), bullets, lines, links |
   | Social media | posts, hashtags, mentions, emojis, longest line in characters |
   | Design | image format, width and height in pixels, aspect ratio, square, transparency, file size |
   | Data cleaning (CSV) | header row, columns, rows, duplicate rows, empty cells per column, invalid emails, date formats |
   | Code | functions and classes defined, language, line counts, TODOs, tests and docstrings present |
5. **Settlement agent moves the money.** If every item passed, the agent calls `verify_funding` (PayPal Agent Toolkit `get_order`) to confirm the capture, then `release_payment` (PayPal Payouts). Otherwise it calls `request_revision` with a specific list of what to fix.
6. **Everything is on the record.** A money path shows where the money is (client, held, freelancer), and an audit trail logs every agent decision and PayPal movement with its reference IDs.

**Fair refunds with deadlines.** The client can cancel and be refunded through PayPal before a freelancer accepts, or after a missed deadline, but not while a freelancer is working on time.

## How PayPal is used

| Step | PayPal capability |
|---|---|
| Client funds the job | Orders API v2: create order, buyer approval, capture |
| Agent confirms funds before paying | **PayPal Agent Toolkit** `get_order` (Orders API as fallback) |
| Freelancer is paid | **Payouts API**, one payout per job (`sender_batch_id` as duplicate guard) |
| Job cancelled | **PayPal Agent Toolkit** `create_refund` (Payments API as fallback) |

## How AI is used

| Step | Model work |
|---|---|
| Brief → checklist | Structured output: 2–10 objective requirements plus how each is checked |
| Verification | Structured output: per-item pass/fail, reason, evidence; reads text, PDFs and images |
| Settlement | Tool-calling agent with `verify_funding`, `release_payment`, `request_revision` |

Models: Google Gemini (`gemini-3.8-flash`, with automatic fallback to other Gemini models) and optionally Groq (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`) or Anthropic Claude, via the Vercel AI SDK. The provider chain is configured with environment variables.

## Safety by design

The AI decides, but hard rules sit **in code, not in the prompt**:

- **No payout without a full pass.** `release_payment` refuses unless every checklist item passed. The overall result is recomputed from the item results, not taken from the model.
- **No payout without confirmed funds.** `release_payment` refuses until `verify_funding` has confirmed the capture with PayPal.
- **No double payment.** The payout status is re-read from the database before paying, and PayPal's `sender_batch_id` is unique per job.
- **Spend cap.** No single payout above `MAX_PAYOUT_USD`.
- **Prompt-injection resistant.** The verifier is told to ignore any instructions inside the submission.
- **Money never gets stuck.** If the AI is unavailable at settlement, the same rules are applied directly, and the audit trail records it.
- **Locked checklist.** The checklist is fixed when the job is posted, so neither side can move the goalposts.

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

- `lib/ai.ts`: checklist generation and verification
- `lib/measure.ts`, `lib/textstats.ts`: exact measurements for text, CSV, code and images
- `lib/templates.ts`: job types and ready-made briefs
- `lib/rules.ts`, `lib/stats.ts`: refund rule, deadlines, freelancer track record
- `lib/agent.ts`: settlement agent and its guarded tools
- `lib/paypal.ts`: Orders, Payouts and Refunds REST client
- `lib/paypal-toolkit.ts`: PayPal Agent Toolkit integration
- `lib/model.ts`: model provider chain, timeouts and fallback
- `app/`: pages, server actions and the PayPal return route

## Try it (judges)

1. Open the live demo. Under **What can you hire for?** click **Use this** on *Product description* (or any other type), then **Post job and create checklist**.
2. Click **Fund with PayPal** and log in with the sandbox **client** account:
   - Email: `sb-kszla53855379@personal.example.com`
   - Password: `<SANDBOX_CLIENT_PASSWORD>`
3. Back on the job, accept it as the freelancer with `sb-20twj53855622@personal.example.com`.
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
npm run build && npm start
```

| Variable | Purpose |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox app credentials |
| `PAYPAL_ENV` | `sandbox` |
| `APP_URL` | Public URL, used for the PayPal return link |
| `DATABASE_URL` | Postgres connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` / `GROQ_API_KEY` / `ANTHROPIC_API_KEY` | Any one or more |
| `MAX_PAYOUT_USD` | Spend cap per payout (default 500) |

Tables are created automatically on first run.

## Production path

The demo holds funds in the platform's sandbox business account and pays out with Payouts. A live launch would use PayPal's multiparty/marketplace onboarding for proper held funds and seller onboarding, add a human dispute desk for contested verdicts, and add PayPal webhooks for status sync.

## License

MIT. See [LICENSE](LICENSE).

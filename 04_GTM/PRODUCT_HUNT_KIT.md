# PRODUCT HUNT KIT — FinancIA Chile

## Tagline (≤ 60 chars)
**Your financial rights, explained simple. Right in your DMs.**

Alternativa Spanish: "Tu derecho financiero explicado por DM, gratis."

## Description (260 chars)
> An AI agent that answers your questions about Chilean financial regulation in plain Spanish — via Instagram DM or WhatsApp. Cites the regulator (CMF) in every reply. Free. No app. No signup. Built on Claude.

## Topics
- Artificial Intelligence
- Personal Finance
- Fintech
- Bots
- Latin America

## Maker comment (primer comment del founder)
> Hi PH! 👋
>
> I'm Benjamin, founder of QUANT24. We built FinancIA Chile after my mother got charged a "maintenance fee" she never authorized — and I realized that the rule that protects her (Art. 17B of the Chilean Consumer Law) is openly published, but written for lawyers, not for her.
>
> The problem isn't transparency. It's translation.
>
> So we built an AI agent that lives where Chileans already are — Instagram DM and WhatsApp — and translates the regulator's public data into plain Spanish in <8 seconds. It cites the source on every reply.
>
> What it does:
> - Verifies if the "bank" calling you is actually supervised
> - Tells you if your loan rate is legal under the Maximum Conventional Rate
> - Generates step-by-step complaint guides to CMF/SERNAC
> - Explains terms (CAE, UF, TPM, DICOM) in plain Spanish
> - Publishes 1 educational Reel/day automatically based on CMF data
>
> What it does NOT:
> - Recommend products or investments (would be unlicensed advisory)
> - Sell your data
> - Charge you anything
>
> Stack: Claude Haiku + Sonnet (90/10 routing), pgvector hybrid RAG over CMF corpus, n8n for content automation, Vercel + Railway. Total cost at 10K MAU: ~$220/month.
>
> First product validation. Would love feedback — especially from anyone who has built consumer-facing AI in regulated industries.
>
> If you live in Chile or know someone who does, try it: [link]
>
> Available globally as a tech demo, but the data is Chile-specific (we expand to MX, CO next).

## Screenshots (6 imágenes para Product Hunt)
1. **Hero shot** — phone with IG DM mostrando una pregunta + respuesta del bot
2. **Reel showcase** — captura del Reel diario auto-generado
3. **Admin dashboard** — KPIs y gráficas
4. **Tool use demo** — bot llamando `verify_entity` ante una entidad sospechosa
5. **Comparison tool** — bot calculando si una tasa supera la TMC
6. **Footer disclaimer** — destaque del disclaimer regulatorio en cada mensaje

## Video demo (60s)
**Storyboard:**
- 0-5s: hero text "79% of Chileans don't understand their financial rights"
- 5-15s: phone screen, user types DM "What is the CAE?"
- 15-25s: bot reply appears with citation to CMF
- 25-40s: complex case — user asks about a suspicious "bank" call
- 40-50s: tool use animated, showing verify_entity returning "not supervised"
- 50-60s: brand close + CTA

## Hunt by
Try to get hunted by Chris Messina, Andrew Wilkinson, or local LATAM hunter (Felipe Cárdenas, Pablo Larrain). If not, founder hunts directly.

## Launch day timing
- 12:01 AM PST (start of PH day)
- Submit at 11:50 PM previous day
- Announce on LinkedIn + Twitter at 6 AM PST
- Engage in comments throughout the day

## Goals
- Top 5 of the day in AI / Finance categories
- 200+ upvotes
- 50+ comments engaged
- Drive 500+ visits to landing → conversions to IG/WhatsApp DM

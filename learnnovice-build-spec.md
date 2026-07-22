# learnnovice.com — Website Build Specification

Everything needed to build. Design system, components, page-by-page layout, and copy.

**Design direction in one line:** the visual world is a **school asset ledger** — ruled rows, tag numbers, status columns, tabular figures — not a terminal.

---

## PART 1 — DESIGN SYSTEM

### 1.1 Direction and why

The old site spoke in terminal: `System.init()`, code blocks, monospace as mood. That reads as competence to a developer and as a student project to a principal. But the fix isn't "make it light" — a dark palette is not the problem (plenty of institutional software is dark). The problem is **code as set dressing**. Strip the theatre and the palette question mostly answers itself.

What survives from the old site, because it's the actual brand equity:

- **Serif-italic emphasis words** in headlines
- **The registry voice** — everything is an enumerated, labelled record
- **Tag chips** on cards

What dies: `System.init()`, the `const project = {...}` block, code as decoration, monospace as ambient texture.

**The replacement reference: the asset ledger.** Every school device carries a numbered inventory sticker. Every managed IT engagement is fundamentally a ledger — what do you have, where is it, is it patched, is it backed up. It is the one artifact where the school world and the infrastructure world physically overlap, and it's the honest visual form of what this business sells. Ruled rows, alternating stripes, tabular figures, a left margin rail, asset-tag numbering.

Deliberately avoided: warm cream + high-contrast serif + terracotta accent, and near-black + acid green. Both are current defaults that appear regardless of subject.

### 1.2 Palette

Greenbar ledger paper — the alternating pale-green striping of printed tabular reports — is the anchor. It also ties to the existing tree/botanical brand mark without becoming a hacker green.

```css
:root {
  /* Paper — cool, not cream */
  --paper:        #F2F4F1;   /* page background */
  --paper-card:   #FFFFFF;   /* raised surfaces */
  --stripe:       #E7EDE6;   /* greenbar alternating row */

  /* Ink — blue-black, like pen on a form */
  --ink:          #111B1F;   /* primary text, headlines */
  --graphite:     #5A6660;   /* secondary text, labels */
  --rule:         #C9D3CB;   /* hairlines, table borders */
  --rule-soft:    #DFE6DE;   /* interior dividers */

  /* Accent — darkened brand green, AA on paper */
  --leaf:         #1F6B44;
  --leaf-hover:   #175536;
  --leaf-wash:    #E3EFE8;   /* tinted backgrounds, active states */

  /* Exception — ledger red. Status only. Never brand, never CTA. */
  --flag:         #B3261E;
  --flag-wash:    #F7E6E4;

  /* Dark instrument — Asset Ledger panel and diagrams ONLY */
  --slate:        #0E1512;
  --slate-card:   #18211C;
  --slate-rule:   #2A3730;
  --slate-ink:    #E4E9E3;
  --slate-leaf:   #57A97C;
}
```

**Usage rules.** `--flag` appears only in status cells and error states — never a button, never a heading. `--slate` appears only inside the Asset Ledger, code samples, and architecture diagrams. If a dark region covers more than roughly a third of any viewport, it's being used as mood again — cut it back.

### 1.3 Type

```
Display   Newsreader  (Google Fonts) — 400 / 500, italic for emphasis words
Body      Public Sans (Google Fonts) — 400 / 500 / 600
Data      IBM Plex Mono (Google Fonts) — 400 / 500, tabular figures
```

**Why these.** Newsreader has more spine than the serif everyone is currently reaching for, and its italic carries the existing emphasis-word signature. Public Sans is the typeface of US federal government forms — institutional, unglamorous, extremely legible for older readers, and thematically exact for a page selling trust to American schools. IBM Plex Mono appears only where numbers must align: asset tags, status columns, device counts.

Self-host all three. `font-display: swap`.

**Scale** (rem, 16px root):

| Token | Size | Line | Face | Use |
|---|---|---|---|---|
| `--t-mega` | 4.0 / 2.75 mobile | 1.05 | Newsreader 400 | H1 only |
| `--t-h2` | 2.5 / 2.0 | 1.15 | Newsreader 400 | Section heads |
| `--t-h3` | 1.5 / 1.375 | 1.25 | Public Sans 600 | Card and subsection heads |
| `--t-lead` | 1.3125 / 1.1875 | 1.5 | Public Sans 400 | Hero subhead, section intros |
| `--t-body` | 1.125 | 1.65 | Public Sans 400 | Body copy |
| `--t-small` | 0.9375 | 1.55 | Public Sans 400 | Captions, footnotes |
| `--t-label` | 0.75 | 1.2 | IBM Plex Mono 500 | Eyebrows, ledger headers — `letter-spacing: 0.08em; text-transform: uppercase` |
| `--t-data` | 0.9375 | 1.4 | IBM Plex Mono 400 | Ledger cells, `font-variant-numeric: tabular-nums` |

Body copy 18px minimum. Measure capped at **68ch**. Headline measure capped at 20ch — long headlines that wrap four times lose their force.

**Emphasis rule.** One italic emphasis word per headline. Two is a tic.

### 1.4 Grid, spacing, geometry

```css
--max:        1200px;   /* content container */
--max-prose:  68ch;     /* running text */
--rail:       80px;     /* left margin rail, ≥1024px */
--gutter:     24px;
```

12-column grid. On screens ≥1024px a **left margin rail** runs the full page: an 80px column bounded on its right by a 1px `--rule` line, carrying section numbers and eyebrow labels. This is the ruled margin of a form, and it's structural — it holds the section index, it isn't decoration. Below 1024px the rail collapses and eyebrows sit inline above their headings.

Spacing scale (8px base): `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`. Section vertical padding: 96px desktop, 64px tablet, 48px mobile.

Radii: `2px` on inputs, buttons, and chips. `0` on ledger rows and tables. Nothing rounder — ledgers have corners.

Borders: 1px `--rule` everywhere. **No shadows.** Elevation is communicated by the white card sitting on the paper background, not by blur.

Breakpoints: `480 · 768 · 1024 · 1280`.

### 1.5 Components

**Nav** — 72px tall, sticky, `--paper` at 92% opacity with `backdrop-filter: blur(8px)`, 1px bottom `--rule`. Wordmark left (tree mark 28px + "Novice" in Newsreader 500, 20px). Links right in Public Sans 500, 15px, `--graphite`, → `--ink` on hover with a 1px `--leaf` underline offset 4px. Final item is the primary button. Below 768px: hamburger → full-screen panel, links at 24px, 56px row height.

**Buttons** — 44px min height, 20px horizontal padding, 2px radius, 15px Public Sans 500.
- *Primary*: `--leaf` fill, white text. Hover `--leaf-hover`.
- *Secondary*: transparent, 1px `--ink` border, `--ink` text. Hover: `--ink` fill, `--paper` text.
- *Quiet*: text only, `--leaf`, 1px underline on hover.
- Focus: 2px `--ink` outline, 2px offset. Never remove.

**Ledger row** — the workhorse. A full-width row, 1px bottom `--rule-soft`, 56px min height, 16px vertical padding. Grid columns per context. Odd rows get `--stripe` background. First cell is a mono asset tag or label; last cell is a status. Hover on interactive rows: `--leaf-wash` background, 120ms.

**Status pill** — inline, mono 12px, 2px radius, 3px/8px padding. `ok` = `--leaf-wash`/`--leaf`. `attention` = `--flag-wash`/`--flag`. `neutral` = `--rule-soft`/`--graphite`. Always paired with a text label — never colour alone.

**Card** — `--paper-card` fill, 1px `--rule`, 2px radius, 32px padding. Optional 12px mono eyebrow in `--graphite`. H3 title, body copy, tag chips at the foot. Hover on linked cards: border → `--leaf`, 120ms.

**Tag chip** — mono 12px, 2px/8px padding, 1px `--rule` border, 2px radius, `--graphite`.

**Tier card** — a card with a 1px `--rule` top strip, price in Newsreader 40px with the interval in 15px `--graphite` beside it, then a `--rule-soft` divider, then a feature list with 16px `--leaf` check marks. The recommended tier gets a 2px `--leaf` border and a mono `--leaf` "Most schools start here" ribbon.

**Form field** — label above in 15px Public Sans 500 `--ink`. Input 48px tall, 1px `--rule`, 2px radius, 16px text, 12px padding. Focus: 1px `--leaf` border plus 3px `--leaf-wash` ring. Error: 1px `--flag` border, message below in 14px `--flag` stating what to fix. Required fields marked on the label, not with a bare asterisk.

**FAQ** — a ledger row per question. Question in 18px Public Sans 500, chevron right, answer expands to `--stripe` background with 24px padding. One open at a time. Keyboard operable.

**Footer** — 64px top padding, 1px top `--rule`, `--stripe` background. Four columns ≥768px, stacked below. Wordmark + one-line descriptor, then Schools / Work / About / Trust / Contact, then GitHub + YouTube + email, then the entity line. Bottom bar: 14px `--graphite`, current year, entity, "Built in Hyderabad."

### 1.6 Motion

Three moments, nothing else.

1. Hero: headline fades up 12px over 400ms, subhead and buttons follow at 80ms stagger. Once, on load.
2. Ledger rows: fade up 8px on scroll into view, 40ms stagger, capped at 8 rows.
3. Hover states: 120ms ease-out on border and background.

Nothing loops. Nothing moves on `/schools` while someone is reading. `prefers-reduced-motion: reduce` disables all of it and renders final states immediately.

### 1.7 Quality floor

AA contrast on every pairing (verify `--graphite` on `--stripe` specifically). Visible keyboard focus everywhere. Full mobile responsiveness tested on a real phone. Lighthouse ≥95 mobile. Images AVIF/WebP with explicit width and height. Semantic landmarks, one H1 per page, alt text on everything meaningful. Forms usable without JavaScript where possible.

---

## PART 2 — GLOBAL SHELL

**Nav:** `[🌳 Novice] ......... For Schools · Work · About · [Talk to us →]`

**Footer entity line:** Novice Digital Solutions · Wyoming, USA · Engineering in Hyderabad, India

Remove the Twitter link. Do not replace it.

---

## PART 3 — PAGES

### 3.1 `/` — Homepage

**Job:** state the thesis, route two audiences, prove it with one real deployment. Nothing else.

---

**§ Hero** — 88vh, capped 760px. Rail label: `01 / OVERVIEW`

Left column (7 of 12):

> **The engineering team your school doesn't have to *hire.***
>
> We design, document, and maintain the technology a school runs on — networks, devices, filtering, backups, and the platforms on top of them. Built so it doesn't break, rather than staffed to wait until it does.
>
> `[See the school offer →]` `[Everything else we build]`

Right column (5 of 12): a compact Asset Ledger excerpt, four rows, `--slate` panel. This is the hero thesis — the most characteristic artifact of the business, shown rather than described.

```
UNDER MANAGEMENT                          ABRAAR ACADEMY

AC-0118   domain controller     ●  online
AC-0119   replica               ●  online
AC-0204   filtering             ●  14,208 blocked today
AC-0301   backup                ●  restore verified 6d ago
```

Mobile: ledger drops below the copy, three rows, horizontal scroll disabled — truncate instead.

---

**§ Router** — `--stripe` background, 64px padding. Rail label: `02 / START HERE`

Two cards, 6 columns each:

| | |
|---|---|
| **I run a school** — Managed IT, filtering, devices, parent portals, and platforms. → `/schools` | **I need software built** — SaaS, internal tools, and business platforms outside education. → `/contact` |

---

**§ What we do** — Rail label: `03 / SERVICES`

H2: *What we do.* Three cards, 4 columns each.

| Card | Copy | Chips |
|---|---|---|
| **School infrastructure** | Networks, devices, filtering, backups, and the accounts that hold it together — designed once, documented, and maintained. | `Google Workspace` `ChromeOS` `Active Directory` `Filtering` |
| **School platforms** | Parent and student portals, learning tools, simulations, and Quran and Tajweed apps — built for how a school actually runs. | `Portals` `LMS` `PWA` |
| **Custom software** | SaaS, internal tools, and business platforms for teams outside education. | `Next.js` `Docker` `Postgres` |

---

**§ Proof** — Rail label: `04 / WORK`

H2: *Work.* Five ledger rows, each linking to a case study. Columns: tag · project · category · one-line outcome.

```
NV-01   Abraar Academy        Schools · Infrastructure   Rebuilt after the provider left
NV-02   CITCD                 Schools · Institution      Site and systems for the operator
NV-03   Build Imara           Enterprise · Platform      Operations platform, shipped
NV-04   At-Tayyibun           Community · Product        Matching platform, live
NV-05   PhET Remaster         Education · Simulations    Independent remaster
```

Below: `[See all work →]`

---

**§ Who's behind it** — `--stripe`. Rail label: `05 / WHO`

Photograph left (4 cols, 4:5 ratio, 2px radius). Right (7 cols):

> **A teacher who runs the *systems.***
>
> I teach at a school and I run its infrastructure. That's an unusual combination, and it's the reason this works: I've sat in the classroom the technology is supposed to serve, and I've been the person called when it stops working.
>
> `[More about Novice →]`

---

**§ Closing CTA** — centred, 96px padding.

> **Start with a conversation, not a contract.**
> Twenty minutes. We'll look at what you have and send you a written summary of what we find. No charge, no obligation.
> `[Book a call →]`

---

### 3.2 `/schools` — the page that matters

Written for a buyer who has **never purchased this category**. The competition is a parent volunteer and $0, not another vendor.

---

**§ Hero** — Rail: `01 / SCHOOLS`

> **Someone should own the *technology.***
>
> Managed IT, content filtering, device management, and the platforms on top — for private and faith-based schools. Designed and documented so problems don't start, not staffed to wait until they do.
>
> `[Book a free findings call →]` `[See a live deployment →]`

---

**§ What it looks like when nobody owns it** — Rail: `02 / THE PROBLEM`

H2 as above. Six ledger rows, each a symptom in the administrator's own words. Left cell mono tag, right cell the sentence. **No IT vocabulary in this section.**

```
01   The one person who knew the passwords left.
02   Every teacher installs whatever they want.
03   Nobody has checked whether the backups actually restore.
04   The lab has been down since October.
05   We don't know how many devices we own.
06   Filtering works on some machines and not others.
```

Closing line under the ledger, 18px `--graphite`: *"Most schools we talk to have never bought IT support. They've had volunteers, parents, and a teacher who was good with computers. That works until it doesn't."*

---

**§ We work with what you already have** — `--stripe`. Rail: `03 / YOUR STACK`

**Critical section. Do not cut it.** Most small US schools run Google Workspace and Chromebooks, not on-premise Windows. A page that only shows on-prem architecture answers the first technical question wrong.

H2: *We work with what you already *have.**

Intro: "Most schools we meet are already running Google Workspace and Chromebooks, a filter, and a student information system. We manage what's there before proposing anything new."

Four cards, 3 columns each:

| Card | Body |
|---|---|
| **Google Workspace & ChromeOS** | Admin console, org units, enrolment, policy, licensing, and account lifecycle for staff and students. |
| **Filtering & safety** | GoGuardian, Securly, Lightspeed, or DNS-level filtering — configured, tested per device, and reviewed. |
| **Student information systems** | FACTS, Gradelink, Blackbaud, and similar — integration, data hygiene, and parent access. |
| **On-premise, where it exists** | Windows Server, Active Directory, virtualisation, labs, and backup — for schools with servers on site. |

Closing line: *"If you're on Microsoft 365 instead, that's fine too. The point is that we manage your school, not our preferred architecture."*

---

**§ Start with a findings call** — Rail: `04 / START HERE`

The true bottom rung. The first dollar from a school that spends nothing is the hardest dollar; this removes it from the first step entirely.

Two panels side by side, 6 columns each. Left panel is the recommended path (2px `--leaf` border):

**Free — Findings call.** Twenty minutes on a video call. We look at what you're running and what's exposed. You get a one-page written summary within two days, yours to keep whether or not you ever hire us. `[Book it →]`

**Paid — Full audit.** One week. Every device, account, and system inventoried, with risks ranked and a costed plan. A written report your board can read. Fixed fee, no commitment to anything after it. `[Ask about an audit →]`

---

**§ How support actually works** — Rail: `05 / HOW`

Answers the offshore, coverage, and on-site questions before they're asked, and reframes from reactive helpdesk to proactive management.

H2: *How support actually works.*

Lead: "We're not a helpdesk waiting for the phone to ring. Most of what we do happens before anything breaks — patching, monitoring, testing restores, reviewing policy. Here's exactly what that means in practice."

Four ledger rows, label / detail:

```
COVERAGE      Monday–Friday, [hours] US Central. Requests acknowledged
              within [X] business hours. Stated plainly because a
              promise we can't keep is worse than a smaller one we can.

PROACTIVE     Patching, monitoring, backup verification, and policy
              review happen on a schedule, off-hours, without a ticket.

ON SITE       Chicago metro: a named local partner, dispatched within
              [X] business days. Elsewhere: we guide your staff through
              physical work remotely, and we say so before you sign.

ESCALATION    Hardware failures, vendor tickets, and anything needing
              a person in the building follow a written path you get
              a copy of on day one.
```

---

**§ Under management** — Rail: `06 / THE LEDGER`

**The signature element.** Full-bleed `--slate` panel, 96px vertical padding. Header row in `--slate-leaf` mono. Eight rows, greenbar striping rendered as alternating `--slate-card`.

```
ASSET LEDGER — REPRESENTATIVE VIEW              anonymised

TAG       SYSTEM                 STATUS      LAST CHECK
AC-0118   domain controller      ● online    uptime 99.94%
AC-0119   replica                ● online    uptime 99.91%
AC-0204   filtering              ● online    14,208 blocked today
AC-0301   backup target          ● online    restore verified 6d ago
AC-0402   lab fleet A            ● 24 / 24   patched 3d ago
AC-0403   lab fleet B            ● 18 / 18   patched 3d ago
AC-0510   staff accounts         ● 31        MFA enforced
AC-0511   student accounts       ● 214       filtering enforced
```

Caption below, 15px `--graphite`: *"A representative view of what a managed school looks like. Hostnames anonymised, no client data shown."*

**Build honestly.** Source from a manually maintained JSON file. Label it as representative. A fabricated dashboard presented as live telemetry is a trust failure on the page whose entire job is trust.

---

**§ What it costs** — `--stripe`. Rail: `07 / PRICING`

**Flat monthly with device bands, not per-device.** Boards approve round numbers; device counts fluctuate and generate invoice arguments.

Four tier cards, 3 columns each:

| Tier | Price | Includes |
|---|---|---|
| **Findings call** | Free | 20-minute review · one-page written summary · yours to keep |
| **Audit** | `$[X]` fixed | Full inventory · ranked risks · costed plan · written report · one week |
| **Essentials** *(recommended)* | `$[X]/month` — up to 60 devices | Filtering · backup with verified restores · monitoring · account management · remote support |
| **Managed** | `$[X]/month` — up to 150 devices | Everything in Essentials · device management · patching · vendor liaison · on-site dispatch in covered metros · quarterly review |

Below the tiers, a callout card — **answer the cheapness objection directly, because a competent buyer will have it:**

> **Why is this less than you expected?**
> Two reasons. Our engineering is in India, so our cost base is lower than a US managed service provider's. And these are founding-client prices — we're building a track record with schools like yours, and the rate is reviewed annually rather than being a permanent discount. You'll always get thirty days' notice of any change.

---

**§ If I disappear** — Rail: `08 / CONTINUITY`

The bus-factor question, answered contractually rather than reassuringly.

> **What happens if we stop working together.**
>
> Your school keeps full administrator access to every system, at all times — we never hold credentials you don't have. Documentation is updated quarterly and delivered to you, not kept on our side. Every configuration decision is written down in language another IT professional can act on. If we disappear tomorrow, someone competent can pick this up in an afternoon.
>
> That's written into the contract, not offered as a promise.

---

**§ Your students' data** — Rail: `09 / DATA`

Three-column summary with a link to `/trust`: where data lives · who can access it · what happens when you leave. Plus a line on the paperwork schools actually send: *"We'll work through your data privacy agreement — including NDPA-format agreements — before anything is signed."*

---

**§ Proof** — Rail: `10 / PROOF`

Abraar case study card, full width, with the architecture diagram as the image. Honest label: built unpaid for the school where the founder teaches, after the high school program was outsourced and support disappeared.

---

**§ Questions schools ask** — Rail: `11 / QUESTIONS`

FAQ ledger rows:

- Your team is in India — what does that mean for us day to day?
- Who comes to the building when hardware fails?
- We already have someone who handles IT. Can you work with them?
- What happens to our data, and can you sign our privacy agreement?
- Can you manage our Google Workspace and Chromebooks, or do we need to change systems?
- We've never paid for IT support. Why now?
- What if we want to leave?
- Have your on-site people been checked to work around students?

---

**§ Form + booking** — Rail: `12 / CONTACT`

Two columns. Left: form — school name · contact name · role · email · phone · student count · device count (approx) · what prompted you to get in touch (textarea) · best time to call, with a timezone select defaulting to US Central. Right: Cal.com embed.

Submit button: **Book the call.** Success state: "Booked. You'll get a confirmation by email within a few minutes." Not "Thank you for your submission."

---

### 3.3 `/work` and `/work/<slug>`

**Archive:** H1 *Work.* Filter chips — All · Schools · Education · Product · Infrastructure. Ledger rows, one per project: tag · name · category · outcome · year. Rows link through.

**Case study template**, five sections, one screen each:

```
01  CONTEXT      Who they are, size, what existed before
02  PROBLEM      3–4 ledger rows, in their words
03  WHAT WE DID   The actual work, stack named, architecture diagram
04  OUTCOME      Ledger rows with real numbers
05  ARTIFACTS    Live links, screenshots
```

Sticky right-hand fact panel on ≥1024px: client · sector · size · duration · stack.

**Write `/work/abraar-academy` first.** It's the only asset proving you *operate* infrastructure rather than build websites, and operating is what the tiers sell. Include the architecture diagram — hypervisor → domain controllers → service containers → backup → overlay network — rendered in `--slate`.

Don't let it block on the board's answer. Write it now around the unpaid deployment, labelled truthfully, and upgrade the language if the contract lands.

---

### 3.4 `/about`

Photograph, 5 columns, real, not a stock desk. Then:

> **A teacher who runs the *systems.***

Bio leading with teaching — six years in the classroom *and* running the school's IT is the differentiator against every MSP competitor. Then a ledger: what Novice is · who's behind it · where the team is · how contracting works · what we don't do.

**Be accurate about scale.** Founder-led, with named local partners for on-site work. This is the page where a prospect checks whether the rest of the site was honest.

Labs at the bottom, quiet: CPTS Companion, YouTube, homelab.

---

### 3.5 `/trust`

Ledger rows, plain language, one row per commitment: what we can access and what we never touch · where data lives, per tier · access control · backup and restore testing · content filtering and CIPA alignment · FERPA and COPPA posture · data privacy agreements including NDPA format · offboarding · incident response with notification windows.

**Two constraints.** Don't claim certifications you don't hold — describe practices. And have a US attorney review the wording once before publishing regulatory commitments or signing any school's addendum; these are contractual representations, and there's currently no insurance behind them.

---

### 3.6 `/contact`

Routing select as the first field: *I'm from a school · I need software built · Something else*. The form adapts. Cal.com embed alongside. Response-time expectation stated plainly.

---

## PART 4 — BUILD ORDER

Four days. Not three weekends.

| Day | Ship |
|---|---|
| **1** | Next.js scaffold, static export, tokens, fonts, nav, footer, button/card/ledger-row/status-pill components |
| **2** | `/schools` complete — every section in 3.2 |
| **3** | Homepage complete, `/work/abraar-academy` written and built |
| **4** | `/about`, `/contact`, `/work` archive, forms wired to Resend + Turnstile, Cal.com embedded, metadata, OG images, sitemap, JSON-LD, Lighthouse pass |

Deferred to gaps: `/trust`, remaining case studies, `/tools/word-to-deck` move, PhET attribution notices, analytics.

Stack: Next.js App Router, static export, Dokploy behind Cloudflare. Forms via API route + Resend, persisted to Postgres. Turnstile for spam. Umami self-hosted for analytics.

---

## PART 5 — NUMBERS TO FILL IN BEFORE LAUNCH

The spec has placeholders that only you can set. All of them appear on `/schools`:

- Audit fee, Essentials monthly, Managed monthly — flat, with device bands
- Coverage hours in US Central, and acknowledgement window
- On-site dispatch window for the Chicago metro
- Real figures for the Asset Ledger and the Abraar case study
- Which metros get on-site coverage — write the list before any outreach

Two things the site can't fix, from the plan: **start the LLC and EIN now** rather than after a client says yes, because you cannot invoice without them and the EIN takes weeks. And **get a second reference in motion** — every part of this currently routes through one counterparty.

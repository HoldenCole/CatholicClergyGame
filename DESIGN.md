# Vocation — V1 Design Document

*A career and life simulation of a Catholic diocesan priest.*

---

## 1. Vision

You are one man, ordained into one diocese, for life. The game is about how a vocation survives contact with an institution.

The player begins as a seminarian, is ordained, is assigned somewhere he probably did not ask for, and spends decades trying to do good work inside a structure that has its own needs. Advancement is possible but never guaranteed and never entirely in his control. The central tension is that the higher he rises, the more of his week is spent administering and the less is spent being a priest — and the game models that as a literal resource drain.

**Reference points:** *Suzerain* for narrative decision structure and the feeling of committing before you can see the board. *Plutocracy* for variable time speed and simulation-under-the-hood. *Crusader Kings* for succession shock and NPCs who outlive their usefulness to you.

**V1 ships when a player can go from character creation through seminary, ordination, assignment, and a full career as a parochial vicar, ending with appointment as a pastor and several years running his own parish.** Chancery, bishop, cardinal, and papal tiers are explicitly post-V1.

This is a personal project. No monetization, no audience, no accessibility mandate beyond what the developer wants. Scope decisions should favor depth over breadth every time.

---

## 2. Time and the core loop

### 2.1 The week

The atomic unit of time is one week. A 40+ year career is roughly 2,000 weeks, so the game must never require the player to play all of them.

**Free hours are loose, and the extras are separate** *(owner's decision, recorded at build time)*. Every week leaves at least ten free hours for the weekly activities, in the unit each sheet shows: hours in seminary, at study, and in a parish, and blocks in a friar's week (`systems/hours.ts`). Obligations, the horarium, and offices still come first, but they cannot take the week below that floor. Clubs and circles, side works, parish projects, a group being founded, a parish problem in hand, and the jobs taken from letters meet in their own time and take nothing from the week. There is no limit on clubs. They keep their own effects, their stamina, and their invitations.

### 2.2 Speed control

Four settings, changeable at any time:

| Speed | Behavior |
|---|---|
| `PAUSED` | Nothing advances. Free inspection of all panels. |
| `MANUAL` | Player allocates action points and resolves events week by week. |
| `AUTO` | Weeks resolve against the standing routine. Stops on any event flagged as an interrupt. |
| `SKIP` | Runs to the next major beat (assignment, evaluation, promotion decision, succession). Stops only for `CRITICAL` events. |

**Interrupt configuration.** The player sets, per category, whether an event stops the game: parish deaths, finance, chancery communications, group problems, classmate news, personal/spiritual, scandal. Default is stop on everything except routine finance and routine admin. This is the single most important quality-of-life system in the game and should be built early, not bolted on.

**Rewind one week.** Any auto-resolved week can be rewound exactly one step and replayed manually. Prevents the digest from feeling like something happened *to* you. Only one step of history is retained.

### 2.3 The standing routine

Set once per assignment (and editable any time), the routine is the player's default allocation of discretionary action points. It is itself a characterizing choice and should be surfaced as such — a priest whose routine is 60% study and 10% visits is a different man than the reverse, and NPCs should comment on it.

### 2.4 Played weeks vs. digest weeks

Most weeks auto-resolve into a **weekly digest**: three to six lines of parish life, generated flavor, no decisions. The game hands the player a week only when something is at stake.

An assignment is structured as an **arc** of roughly 20–30 played weeks spread across 2–8 in-game years. When the arc's content is exhausted, remaining time compresses to digest and the next assignment beat fires.

### 2.5 The liturgical calendar

The year is not flat. Advent, Lent, Holy Week, Christmas, and Easter raise the mandatory action point floor and open seasonal event pools. Ordinary Time in summer lowers it. Holy Week should be the hardest week of every year and should regularly force the player to neglect something.

### 2.6 Action points

10 AP per week at parochial vicar. Mandatory obligations consume a baseline; the rest is discretionary.

**Obligations have quality dials.** Nothing is silently deducted. Each obligation offers a minimum, standard, or invested level:

| Obligation | Min | Standard | Invested |
|---|---|---|---|
| Sunday masses + homily | 1 AP (recycled homily) | 2 AP | 4 AP (written fresh, researched) |
| Weekday masses | 1 AP | 1 AP | 2 AP |
| Scheduled confessions | 1 AP | 1 AP | 2 AP (extended hours) |
| Staff/parish meetings | 1 AP | 1 AP | — |
| Sacramental prep & occasional services | 1 AP | 2 AP | 3 AP |

Going minimum buys back AP at a cost to lay support and piety. Going invested costs AP and pays in reputation, charisma growth, and event outcomes. **The recycled homily should be one of the most tempting and most corrosive habits in the game.**

Discretionary spends: extra confessions, sustaining a group, home and hospital visits, personal prayer and adoration, study, time with brother priests, administrative catch-up, civic and community presence, correspondence and writing.

---

## 3. Character creation

Delivered as a narrative sequence of questions about the player's own past, not a point-buy screen. **Stat changes are never shown as numbers during creation.** The player sees consequences described in prose and can inspect the resulting profile only at the end.

Every choice must plant a **hook**: a named person, a place, or an unresolved thing the event system can pull on decades later. Background is a set of content seeds, not a stat allocation.

### 3.1 Selection layer (up front)

Name, portrait, and ordination year (sets the historical backdrop and Rome's temperament).

### 3.1a Choosing a diocese — the preview screen

**The player chooses his diocese, and he sees it before he chooses.** A man discerning where to apply visits, talks to the vocations director, reads what people say, and knows roughly what he is walking into. Hiding it would be both unrealistic and bad design, since diocese choice is the single largest determinant of how a run plays.

The world generates *first*, then the player picks from five generated dioceses, each presented as a card:

| Field | Displayed as |
|---|---|
| **Disposition** | A traditional↔progressive bar, plus a **tension** readout (*"quietly split," "openly divided," "one voice"*). Shows the balance, not the exact three faction weights. |
| **Clergy need** | Plain language: *"critically short," "stretched," "adequate," "a deep bench."* This is the promotion-pace signal and the player should be able to read it. |
| **The bishop** | Name, age, years in office, a one-line temperament description, and his two stated priorities. Not his hidden temperament, not his ambition, not whether he will like you. |
| **Character** | Two or three lines of prose on the diocese's culture, written from the presets and modified by the rolled state. |
| **Opportunities** | The institutions present and what they open: *"a major seminary and a Catholic university — strong academic tracks," "three parishes in serious financial trouble — a fixer will be noticed."* |
| **Complication** | One visible problem. Debt, a scandal working through the courts, a consolidation plan, a presbyterate at war with itself. |

**Hidden from the preview:** the bishop's true temperament and ambition, whether he will already have an opinion of you, chancery composition, scandal exposure that has not surfaced, the pastor age distribution, and every parish's detailed state.

**Drift.** Between the preview and ordination, seven years pass. Disposition, need, and finances all drift modestly, and roughly one run in four should see the bishop change *during seminary* — which is the game teaching its most important lesson early: you cannot pick your superior, only your gamble.

A "surprise me" option rolls the diocese without a preview and grants a small starting bonus.

### 3.2 Question 1 — Where you're from

Working-class urban ethnic parish / Latino immigrant family / rural farm town / affluent suburb / convert household / lapsed-Catholic family.

Sets starting Knowledge and Charisma, generates family NPCs, and sets **home terrain**: a permanent lay-support modifier at parishes matching or mismatching your origin. The suburban intellectual sent to a struggling urban parish plays a genuinely different game than the man who grew up there.

### 3.2a Question 1b — Your tie to the diocese

Separate from where you grew up. This is how much of a native you are, and it matters for the whole career.

| Tie | Effect |
|---|---|
| **Son of the diocese** | Raised here. Starting `parishioners` and `brother_priests` bonus. Your home parish is a real, named place you can be assigned to or visit. A pre-existing relationship with at least one priest who knew you as a boy. The chancery reads you as *one of ours* — a standing trust bonus, and cover during a scandal. Cost: your past is local and retrievable, and the small-world event pool can surface people who remember you before you were impressive. |
| **Went to school here** | Not from here, but you did college or graduate work in the diocese. Moderate `public` and institutional bonus. Ties to the university, which opens academic and donor tracks. A middle position — known, not owned. |
| **Came for the seminary** | An outsider who applied from elsewhere. No local bonus and a small early trust penalty; you spend your first years being placed rather than known. Cost is real, but so is the upside: no history, no expectations, no one's nephew. Judged only on what you do. Foreign-born and other-region variants sit here. |
| **Transferred in late** | Discerned or began formation elsewhere and came here. Carries a visible question mark — *why did he leave?* — that events can pull on. Highest variance. |

Ties interact with the diocese preview: a son of the diocese knows more, so **choosing this tie reveals one hidden preview field** (a chancery figure, the bishop's true temperament, or the unsurfaced complication) before the run begins.

### 3.3 Question 2 — Your road to seminary

**Hard rule: seminary is always 7 years. Ordination age = entry age + 7.**

| Path | Enters | Ordained |
|---|---|---|
| Out of high school | 18 | 25 |
| Some college, unfinished | 20 | 27 |
| College graduate | 22 | 29 |
| College + 1-year master's | 23 | 30 |
| College + 2-year master's | 24 | 31 |
| Professional/doctoral (JD, MD, PhD) | 25–28 | 32–35 |

#### Field of study

Any path involving college also picks a field. This is the primary source of starting stat shape and it gates what careers are available.

| Field | Stats | Seminary effect | Opens |
|---|---|---|---|
| **Business / Finance** | Administration ++, Knowledge + | Discount on nothing academic; free AP is scarce | Fastest track to parish finance competence, capital campaigns, chancery finance office. Partial CPA/MBA credential. |
| **Philosophy / Theology** | Theology ++, Piety + | **Largest philosophy-year discount (Y2–3).** Banks the most free AP of any field | STL/STD track, seminary faculty, doctrinal roles. Alignment drifts faster — you arrive with opinions. |
| **History / Law** | Knowledge ++, Administration + | Moderate discount | The canon law track (JCL), tribunal work, chancellor. The strongest *institutional* build in the game. |
| **STEM** | Knowledge +, Administration + | Small discount; you find the philosophy years harder than the theology men do | Schools, hospital systems and bioethics, facilities and construction competence. Unusual credibility with skeptics and with donors in tech and medicine. |
| **Classics / English** | Knowledge ++, Charisma + | Moderate discount; Latin and Greek reduce later study costs | Preaching and writing. The best homily quality curve in the game, liturgical and translation work, media. |

Fields carry soft social readings too: the philosophy man is assumed orthodox and slightly dull, the business man is assumed useful and unspiritual, the classics man is assumed to be an aesthete. Events should trade on those assumptions and let the player defy them.

#### Careers, gated by field

The work-experience slider stacks on top: entry age = education end + years worked, capped at entry 40 (ordained 47). Each year gives small Knowledge or Administration gains and deepens the career trait, with diminishing returns after year 8.

Available careers are **gated by field**, which forces the education choice to matter:

| Career | Requires | Grants |
|---|---|---|
| Attorney | History/Law | Partial JCL. Trait: *reads a document properly.* Immediate credibility in tribunal and personnel matters. |
| Accountant / financial analyst | Business/Finance | Partial CPA. Trait: *the books do not lie to him.* Can audit a parish and find what the last pastor hid. |
| Corporate management | Business/Finance, STEM | Trait: *runs a meeting.* Staff and delegation bonuses. |
| Teacher | Any | Trait: *holds a room of the unwilling.* Youth and school bonuses, vocations bonus. |
| Professor / researcher | Philosophy/Theology, History/Law, Classics/English, STEM | Partial doctorate. Trait: *published.* Opens the academic track immediately. |
| Physician / nurse | STEM | Trait: *has been present at deaths.* Large hospital, hospice, and bioethics bonuses; strong Piety authenticity floor. |
| Military officer | Any | Trait: *has given and taken orders.* Administration and crisis bonuses; chaplaincy track. |
| Trades / construction | No degree required — and available to the high-school path | Trait: *knows what the estimate should say.* Buildings and blue-collar parish bonuses. The best non-degree option and deliberately strong. |
| Journalism / communications | Classics/English, History/Law | Trait: *knows how this will be reported.* Media and scandal-handling bonuses. |
| Social work / nonprofit | Any | Partial MSW. Trait: *knows which agency to call.* Poor relief and addiction-recovery bonuses. |

**Age is not a ceiling.** See §7. Late vocations are read as mature and often promote *faster*.

### 3.4 Question 3 — Why you went

Lifelong certainty / conversion experience / a priest who marked you / intellectual conviction / grief after a loss / something you were running from.

Sets the Piety baseline and — more importantly — determines what the doubt-and-crisis event pools key off for the entire game. The man who entered running from something breaks differently than the man who never questioned it.

### 3.5 Question 4 — Family and obligations

Parents living or dead, siblings, whether the family supported or opposed the vocation, whether anyone depends on you financially or otherwise. Generates persistent NPCs. A mother declining in another diocese becomes a live conflict at exactly the moment the best assignment of your life is offered.

### 3.6 Question 5 — Something in your past

Optional. Taking one grants a stat boost and a permanent **latent risk** the scandal system can surface at a bad time. Declining is safe and slightly weaker. Offer 4–6 options ranging in severity, plus "nothing worth mentioning."

### 3.7 Not chosen

- **Theological alignment** — starts as a tendency inherited from origin and formation, then drifts based on actions. Never a slider.
- **Archetype** (pastoral / teaching / theological / administrative / missionary) — emerges from seminary choices, formally named at ordination. The player may express a leaning; it is a weight, not a lock.
- **Positions on contested issues** — accumulated through events, tracked as private belief *and* public record separately (§5).

---

## 4. Stats and credentials

### 4.1 The five stats

Scale 0–100. Gains go logarithmic above 70. **Two stats above 70 by mid-career is a strong build; all five is impossible.**

**Administration** — finances, staff, buildings, canon-law paperwork. Key effect: *reduces the AP cost of mandatory administrative obligations*, so it buys back time. Gates budget, school, and construction decisions.

**Charisma** — preaching, presence, one-on-one persuasion. Drives homily quality, lay support gain, recruitment into groups, and vocations produced. Wins rooms.

**Theology** — doctrinal precision and credibility with clergy. Allows holding controversial positions without damage, defending against heterodoxy accusations, teaching, publishing. Wins arguments on substance.

**Knowledge** — history, literature, languages, culture. Unlocks the *informed* option in events — the choice where you correctly read what is actually happening. Currency with donors, universities, media, and civic elites.

**Piety** — decays. Gates authenticity checks: genuine consolation of the grieving, real discernment, resisting temptation events. Semi-visible to others, feeding a **reputation for holiness** that functions as a promotion path parallel to and independent of chancery favor.

### 4.2 Decay is asymmetric

| Stat | Decay |
|---|---|
| Administration | None |
| Charisma | None |
| Theology | Slow atrophy if unused |
| Knowledge | Slow atrophy if unused |
| Piety | Active drain proportional to administrative load |

The intellectual and spiritual life require maintenance; the political skills do not. **This asymmetry is the thesis of the game in one table.**

**Piety's only reliable maintenance channel is a standing spiritual director** (§9.4). Everything else pauses the drain; direction slows it. A man without one is not merely unlucky, he is running the game's central stat on a leak.

### 4.3 Every high stat carries a cost

- **High Administration** — the chancery finds you too useful where you are and buries you in committees. Promotion to *pastor* may actually slow.
- **High Charisma** — envy from brother priests; a parish that depends on you personally and visibly collapses when you transfer.
- **High Theology + strong alignment** — beloved by your bloc, a marked man to the other.
- **High Knowledge** — "he's an academic, not a pastor" in a working-class parish; pulled toward teaching assignments away from parish life.
- **High Piety, low Administration** — revered, but the roof leaks and the books are a mess. Passed over as impractical.

### 4.4 Credentials

Discrete, separate from stats, and they **hard-gate roles**.

`STB` / `STL` / `STD` (theology) · `JCL` / `JCD` (canon law) · `MBA` / `CPA` · `MA/PhD` (secular field) · `SSL` (scripture) · liturgy certification · `MSW` / counseling · Roman-university variants of any of the above (worth more).

A chancellor effectively requires the JCL regardless of Administration score. Credentials come from background, seminary track, or post-ordination study assignments — and taking one costs years of parish time and pastoral reputation. **Accepting a Rome assignment is one of the sharpest trade-offs in the game.**

---

## 5. Reputation, conviction, and volume

### 5.1 Constituencies, not a slider

There is no single reputation number. Standing is tracked separately (−100 to +100) with:

- `chancery` — the bishop and his officials
- `brother_priests` — the presbyterate
- `parishioners` — local, per-parish, resets on transfer with partial carryover
- `traditional_bloc` — diocesan traditionalists, clergy and lay
- `progressive_bloc` — the same on the other side
- `public` — local media and civic society
- `rome` — dormant until the bishop track, then critical

Promotion runs on `chancery`. Parish life runs on `parishioners`. These pull apart constantly. That gap is where the game lives.

### 5.2 Positions have volume

Every position taken is recorded with a volume:

| Volume | Meaning |
|---|---|
| `private` | Said to one trusted person |
| `semi_public` | A homily, a class, a clergy dinner |
| `public` | Published, on the record, in front of people who will repeat it |

The same belief at different volumes produces completely different careers. **Volume is a multiplier on fit, not a penalty.** An `outspokenness` value (0–100) accumulates from public positions and scales the effect of alignment with whoever holds a decision.

- **Loud and aligned with the bishop** — not a risk, an *asset*. Bishops want visible men who say what they believe but cannot always say themselves. You get platformed: the cathedral parish, seminary faculty, the vocations office, the diocesan paper. **Faster than a quiet peer.**
- **Loud and opposed to the bishop** — buried. Rural parish, hospital chaplaincy, no committees, no visibility, possibly disciplined.
- **Quiet, either way** — steady, unremarkable, promoted on competence alone.

The real cost of outspokenness is not promotion, it is **volatility**: you have bet your career on a bishop you did not choose and who will be replaced.

### 5.3 Succession is the payoff

When a bishop dies or turns 75, the successor rolls. The loud priest who was the last bishop's favorite becomes the new bishop's problem; the man exiled to a rural parish is called back within a year. This reversal should be among the most dramatic events in the game and should be able to fire twice in a long career. Quiet men are barely affected. **This is the mechanism that makes conviction meaningful rather than decorative.**

### 5.4 The public record

Everything said publicly is permanent, retrievable, and surfaceable by enemies. The chain system must be able to reach back fifteen or more years — to a terna vote, a media cycle, a parish where it plays badly.

### 5.5 Consistency and honesty

Two derived values:

**Consistency** — the gap between the private and public position records, plus the frequency of public reversals.

- Consistent and outspoken → high respect from everyone including opponents. Rare and valuable.
- Consistent and quiet → trusted, promotable, unremarkable.
- Inconsistent → if the gap is discovered, the credibility hit exceeds what either position alone would have cost.

**Honesty reputation** — accrues from saying the hard true thing publicly at personal cost. Makes your defenses believable during a scandal and makes people take your word in disputes. Also makes you exhausting to work with (small `chancery` penalty).

### 5.6 Becoming a figure

Past an outspokenness threshold with strong bloc support, the player stops being a priest with opinions and becomes a **figure**: people seek him out, a faction forms around him, invitations arrive, and the chancery finds him harder to bury. A different kind of power than chancery favor, and it can eventually force the chancery's hand.

---

## 6. The seminary arc

Seminary is the tutorial disguised as a prologue: the weekly loop at low stakes with fewer AP and simpler consequences. Target playtime ~90 minutes.

### 6.1 Year shape

Each year runs: an **opening emphasis choice** → **2–3 played weeks** drawn from the year's pool → a **summer assignment** → an **annual evaluation**. Everything between auto-resolves against the emphasis.

### 6.2 The four pillars

Formation is scored on the Church's own four pillars, mapped to stats: **Human** (Charisma), **Spiritual** (Piety), **Intellectual** (Theology + Knowledge), **Pastoral** (blend). The annual emphasis is an allocation across the four. A pillar left at zero for consecutive years becomes a flag on the record.

### 6.3 Year by year

**Y1 — Propaedeutic.** Cut off from the world: no phone, no news, silence. The year asks whether you can bear it. Sets Piety baseline, first classmate impressions.

**Y2–3 — Philosophy.** The academic grind. Prior-degree holders get a **discount** here and bank free AP; the 18-year-old grinds. This is how earlier education stays meaningful without breaking the seven-year rule. Alignment begins drifting based on which professors the player gravitates toward.

**Y4 — Theology I · Candidacy.** First hard gate. The rector's evaluation determines admission as a candidate for orders. First year a leave can be imposed.

**Y5 — Theology II.** Instituted Lector and Acolyte. Real parish exposure. Specialization becomes visible; faculty begin steering toward a track. Graduate-study offers appear.

**Y6 — Theology III.** Pastoral year or diaconate prep. **Diaconate ordination at year's end — the point of no return.** Celibacy promised. The game should slow down and make the player sit with it.

**Y7 — Transitional deacon.** Serving a parish, preaching, baptizing. Full weekly loop at near-parish complexity. Assignment preferences submitted. **Ordination.** Archetype formally named.

### 6.4 Evaluations and failure

Annual, scored on the four pillars plus event outcomes. Four results:

- `ADVANCED` — small bonus
- `ADVANCED_WITH_CONCERNS` — permanent flag on the record; affects first assignment
- `HELD_BACK` — repeat the year; extends the timeline and costs runway
- `DISMISSED` — run ends

Dismissal is reachable only through sustained neglect or a serious event, never before Y2. **Voluntary departure** is available every year and is always the honest option during a doubt event. Both end the run — acceptable, because the player is 20–40 minutes in and it is what makes the diaconate promise mean anything.

### 6.5 Classmates

8–12 generated men, rolled independently rather than drawn from archetypes. See §9.2. Relationships tracked from Y1. Every played week offers a social option in direct competition with study or prayer.

**They persist for the entire game.** In thirty years one is the chancellor, one is a pastor across town, one has left the priesthood, one is dead, and one is on the same terna list. Seminary is where the player decides whether he will have allies.

### 6.6 Religious in the seminary

Most seminary faculty are religious, and these are the player's first religious contacts. The formation staff generates from the institutes present in the diocese (§9.4) plus one or two from outside: the Dominican who teaches philosophy, the Benedictine spiritual director, the Jesuit running the pastoral year, the diocesan rector over all of them.

**They persist for the entire game.** A formator who thought well of the player writes to his bishop at exactly the right moment twenty years later, and one who did not remembers that too.

**Choosing a spiritual director (Y1).** Three or four are offered, mostly religious, each with a visible charism and temperament and a hidden depth. It is presented as a minor administrative choice and is in fact one of the most consequential decisions in the game. See §9.4 for the internal forum and the mechanics.

### 6.7 The classmate who becomes a religious

One or two men per cohort discern out of diocesan formation and into an order, usually Y2–Y3, sometimes in the wake of the Y4 candidacy crisis.

**They do not leave the game. They diverge.** The man comes off the diocesan ladder permanently and re-enters as a religious NPC years later: a Dominican preaching a mission at the player's parish, a Jesuit at the university who has quietly become more famous than the player ever will be.

The mechanical consequence is the interesting part. He now has **nothing to gain from the player and nothing to lose to him.**

- If the relationship was strong, he becomes a lifelong friend with no agenda, and a second honest channel alongside the spiritual director.
- If it was competitive, the competition simply evaporates, which is its own kind of complicated. He got out of the race the player is still running, and he seems happier.

**The reverse fires occasionally:** a man arrives in Y5 or Y6 from a religious novitiate he left, and nobody quite asks why. He carries a visible question mark and a set of contacts inside his former institute.

### 6.8 Exit payload

Ordination emits: final stats, alignment, archetype, credentials, private and public position records, classmate roster with relationship values, evaluation history, latent risks, and submitted assignment preferences.

---

Also emitted: **the standing spiritual director relationship, the formation faculty roster, and any classmates who diverged into religious life.**

## 7. Promotion and assignment

### 7.1 Promotion is a scored decision by an actor

Never a threshold the player crosses. Every appointment is a decision made by someone — the bishop, the personnel board, later the nuncio — weighing candidates against a specific opening.

```
score = (need × w_need)
      + (readiness × w_ready)
      + (trust × w_trust)
      + (fit_effective × w_fit)
      + maturity_modifier
      + rng(seeded, ±10)

fit_effective = fit × (1 + outspokenness / 100)
```

`fit` can be negative. Outspokenness amplifies it in both directions — that is the entire volume mechanic in one line.

**Need** (0–100) — how badly the diocese requires a body. The largest lever, and it swings hard. Shortage, retirement waves, and a parish in crisis all promote fast and forgive a lot. A well-staffed diocese with a deep bench makes you wait ten years. Concretely: above a need of 60 the years at which experience saturates shrink (to 60% at need 100), and a diocese past 'stretched' fields fewer rivals for each opening. Years worked before the seminary count as half-years ordained for a pastorate (up to half the saturation), and the degree a man came in with counts alongside his credentials. Houston and Washington are critically short every time.

**Readiness** — role-relevant stats, credentials, years ordained, and demonstrated results at the current post.

**Trust** — chancery standing, bishop relationship, and who vouches for you (a classmate in the chancery is worth a great deal here).

**Fit** — match to *this specific opening*. Spanish fluency for a Latino parish. A former CPA for a parish with a $2M deficit. Fit can override everything else.

### 7.2 The maturity curve

Ordination age enters through trust, not as a cap, and it is not linear:

| Ordained | Effect |
|---|---|
| 25–29 | Trust penalty (−8), decaying to 0 by age 35. Seen as promising but green. Receives long-term investment: graduate study, grooming. |
| 32–40 | **Trust bonus (+10).** Arrives with professional bearing. Bishops hand these men parishes at 3 years ordained rather than 12. The sweet spot. |
| 41–47 | Trust bonus (+6), weighted toward stability. Read as safe hands for a difficult parish. |

A man ordained at 38 with a business background in a shorthanded diocese can be a pastor by 41 and in the chancery by 45. Bishop at 55 is entirely plausible — the late-vocation profile reads as mature and unthreatening, which is what terna lists favor.

### 7.3 No ceilings, only headwinds

Nothing is gated by age. What changes is probability and pace. Retirement letters go in at 75 and are frequently not accepted for years. Careers run into the late seventies. A late vocation gets a compressed, urgent career; a young one gets a long career with more time to be held back or forgotten.

**Promotion goes badly in both directions.** A visible young priest can be made pastor at 30 and be underwater. A strong priest can sit in a rural parish for fifteen years because his bishop dislikes him — or because he is too useful where he is. Both should occur in normal play.

### 7.4 Assignment

The player submits preferences. The bishop decides. Mismatch is content, not failure — a progressive priest in a TLM parish is one of the better games available.

For outspoken priests, fit dominates the assignment algorithm, because a bishop placing a vocal traditionalist knows exactly where he will thrive and where he will start a war. **Being outspoken therefore partly determines where you live and work**, which is a more interesting consequence than a promotion penalty.

### 7.5 Special opportunities

The reward layer for building a specific man rather than a balanced one. Opportunities are **offers, not choices from a menu** — they arrive because of who you are, they are gated on stats, background, education, credentials, reputation, and relationships, and most of them expire.

They run from seminary Y3 through the pastor tier and are the primary way a specialized build converts into advantage.

#### Anatomy

Every opportunity has: **requirements** (hard gates), **a cost** (AP over a period, or years, or a reputation hit), **a reward** (credential, stat, relationship, standing, or a permanent flag), **a window** (usually 2–8 weeks to decide, sometimes one scene), and **a risk of failure** if the player is underqualified but accepts anyway.

**Declining has a cost too.** Turning down the man who offered it damages that relationship, and some offers are made exactly once.

#### Categories

**Academic**
- *Study in Rome* (Gregorian, Angelicum, Santa Croce) — requires high Theology, a strong evaluation record, and a rector's recommendation. Costs 2–4 years out of parish life. Grants a Roman credential worth substantially more than its domestic equivalent, plus permanent `rome` standing and a network of foreign classmates. **The sharpest trade in the game: you return credentialed and slightly a stranger.**
- *Canon law licentiate* — History/Law or high Knowledge. The institutional track.
- *Dissertation or research project* — high Theology or Knowledge. Multi-year background commitment consuming AP, yielding publication, `rome` and academic standing, and a permanent *published* flag that surfaces at terna time.
- *Seminary faculty appointment* — teaching archetype, high Theology. Puts you in front of every future priest in the diocese, which compounds enormously over thirty years.
- *Language study* — Spanish, Latin, Italian. Cheap, and Spanish alone can reshape which parishes fit you.

**Chancery and institutional**
- *Vocations office* — high Charisma. Visible, bishop-adjacent, and you personally shape your future presbyterate.
- *Tribunal* — JCL or Knowledge gate. Unglamorous, quietly powerful, and you learn everyone's secrets.
- *Finance council or diocesan CFO track* — Business/Finance background or high Administration.
- *Bishop's secretary or master of ceremonies* — requires trust, not stats. The single fastest trust-accumulation post in the game and a classic bishop pipeline. Costs nearly all discretionary AP.
- *Diocesan communications* — journalism background or high Charisma. Powerful and exposed.

**Patronage**
- *Assist a prominent priest* — a famous preacher, a respected theologian, a well-known pastor. Requires a relationship or a recommendation. Grants his network, his enemies, and a share of his reputation. **If he later falls, you fall partway with him.**
- *Mentorship by a chancery figure* — a named official takes an interest. Accelerates trust, obligates you.
- *Substitute for the bishop* at an event he cannot attend. Small, one-scene, and a real test.

**Social and civic**
- *Invitation to a group or movement* — Opus Dei, Cursillo, a traditionalist clerical society, a progressive clergy caucus, a fraternity of diocesan priests. Gated on alignment and reputation. Grants a durable faction, a mentor, and a permanent affiliation flag that **other people will judge you by for the rest of your life** — an asset under one bishop and a liability under the next.
- *Major donor fundraiser* — Knowledge or Charisma gate. Opens named donor NPCs who can fund a project years later, or expect things.
- *Civic and interfaith boards* — high Knowledge or `public` standing.
- *Chaplaincy* — hospital, prison, university, police and fire, military reserve. Each gated on background, each opening its own event pool and constituency.

**Seminary-specific**
- *Summer assignments* — Rome, a mission, a chancery internship, a hard parish, a hospital.
- *Student leadership* (senior class, liturgy, sacristan) — small, and the rector notices.
- *Special retreat or spiritual direction with a notable figure* — Piety gate, and one of the few reliable ways to build Piety rather than merely slow its decay.

#### Design rules

1. **Offers must be legible in hindsight.** The player should be able to name the thing he did that produced the offer.
2. **Roughly half should be visibly *bad* fits** — a real offer the player should probably refuse. Prestige and correctness are different.
3. **Anything requiring years away from parish life must cost pastoral reputation**, or the academic track becomes free.
4. **Opportunities cluster.** Accepting one tends to generate more of the same type, so the game gently produces coherent careers rather than scattered ones.
5. **A "figure" (§5.6) generates his own offers**, independent of the chancery. That is what the status is for.
6. **A run with no opportunities is a design failure.** Every build, including the low-stat generalist, must have a reachable ladder — his is the parish itself: the hard assignment nobody wanted, the parish everyone had written off.

### 7.6 Asking to be moved

*Added in playtesting.* §7.4 is a form naming a **kind** of place. This is a letter naming **a place**: an ordained priest writes to the vicar for clergy and asks for one particular parish, or for one of the postings (the hospital, the Newman Center, Rome, the tribunal, the seminary chair, the bishop's own desk). It sits in the file until it is answered.

1. **One request stands at a time.** Filing a second withdraws the first, and the chancery counts how many times a man has asked. Past the first in five years, asking costs chancery regard: a man who asks for everything is a man who is never where he is.
2. **The ordinary answer is the board.** The request is read when his arc ends, where it weighs more than a name put in for an opening (§7.1), and it can put a parish or a posting on the desk that would not otherwise have been offered.
3. **A strong man, or an urgent need, moves sooner.** Once a year the vicar for clergy may act on a standing request in the middle of an arc. The chance is built from what the chancery thinks of him, whether the place he asked for is actually open or short, the diocese's own shortage, the bishop's regard, and how long he has stood in his present post. A man his parish cannot spare is held where he is, exactly as §4.3 says: competence is a cage.
4. **A granted request is an offer, not an order.** The letter lays the post he asked for beside the post he holds, and he may stay. Staying costs — he asked, the chancery moved, and he said no.
5. **The years are a gate, not a wish.** A vicar may ask for a pastorate; he is granted the parish as its vicar until the canonical years are there, unless the board would have made him pastor anyway.
6. **Requests lapse.** Four years unanswered and the vicar for clergy closes the file with a line. He may ask again.
7. **No one asks for a mitre.** The episcopal postings are the nuncio's business and cannot be requested.

### 7.7 Special assignments

*Added in playtesting.* The ladder is vicar, pastor, the chancery. These are the posts beside it — each a full posting like the hospital chaplaincy (§7.5): a place with its own dials, a book of what the years there counted, six ways to spend the hours of the week, its own scenes, and a parish again when it ends. They arrive as offers, gated on who the man is, and all but one can be asked for by letter (§7.6).

| Post | Years | What it is |
|---|---|---|
| **Chaplain of the state penitentiary** | 3 | Two thousand men, a chapel with bolted benches, a room a mile from the gate. The tiers, the grille that is actually a grille, the last corridor, the gate on release days. Counts for nothing at the deanery and something with the bishop. |
| **On loan to the missions** | 3 | A bishop with eleven priests for forty thousand square miles borrows a man. Six stations, a truck, a wood stove, a language learned from a grandmother, a two-year backlog of baptisms done in an afternoon. The chancery counts the years as years away, which they are. |
| **Deployed as chaplain** | 1 | Orders, not an appointment: the Guard battalion he drills with deploys and its chaplain goes with it. Mass on the hood of a truck, the flight line at two in the morning, the sergeants, the days that are not most days, and letters written for men who could not. The bishop has no say and says so. Requires the reserve commission. |
| **Spiritual director at the seminary** | 4 | Not a professor: a director. Twenty men an hour each a month in a room where nothing said leaves, the corridor at ten at night, the one who knocks at midnight. Its direction scenes are sealed (CLAUDE.md rule 7); its book counts hours, never names. Requires that he kept a director himself. |
| **Superintendent of schools** | 4 | Eleven schools, four thousand children, a board of donors and lawyers, and the school that cannot be saved. The post for a man who can read a balance sheet; every pastor with a school telephones before eight. |

Design rules: each must be **legible in hindsight** (the penitentiary comes to the man who went to the county jail on Thursdays; the deployment to the man who took the reserve commission); each must **cost the parish** he leaves; and none is a promotion — the board reads the file that comes home, and what it says depends on the dials.


---

## 8. The parish

### 8.1 Roles

**Parochial vicar** — 10 AP/week, ~5 mandatory. Someone else's parish, someone else's decisions. The pastor is a major NPC and can be a mentor, an obstacle, or a disaster.

**Administrator** — temporary charge of a parish without the title. A test.

**Pastor** — 10 AP/week, ~6 mandatory (higher admin floor, reducible by Administration). Full authority: budget, staff, schedule, groups, liturgy, school. Six-year renewable terms.

### 8.2 Parish resources

- **Collections** — weekly, driven by attendance, wealth, and lay support
- **Debt** — to the diocese or a bank, with servicing pressure
- **Assessment** — the diocesan tax, non-negotiable, resented
- **Buildings** — church, rectory, hall, school, each with a condition value that decays
- **Staff** — secretary, music director, DRE, maintenance, each an NPC with an alignment and an agenda
- **School** — open, at risk, closing, or none. The single largest financial and political object in a parish.

### 8.3 The pastor's projects

Multi-year efforts consuming AP and money: renovation, restoration, debt retirement, saving or closing the school, liturgical change, founding a mission, a capital campaign. **Projects survive transfers only if the successor keeps them.**

*Added in playtesting:* ten more, each written on the project itself (what finishing it does to the man, and what it does to the parish record) rather than in code — a rectory rebuilt, a columbarium that pays for the roof, a food pantry, a census that finds the families, a parish made bilingual, the parish history written, a youth center in the hall, the cemetery restored, the bells rehung, a grotto. A project may require the parish's second language or a hall that could take it.

**The bishop's causes.** Among the spends (§8.2) are four gifts a pastor can make in the parish's name to what the bishop cares about — the appeal over its goal, a burse at the seminary, the retired priests' fund, his own cause of the decade. Each moves the bishop and the chancery, costs the parish, and costs a little with the people who notice where the money went; each can be given only so often.

---

### 8.4 The chapel, the monastery, and the older form

*Added in playtesting.* Three things a priest can reach for beyond the church and the school.

**The chapel.** The chapel is a furnishing place of its own, the pastor's, with three slots: the room's style (as it was, dark stone and old wood, light and glass, warm and soft, or to match the church, which reads the sanctuary), the devotion on the wall (the tabernacle alone, Our Lady with candles, an icon corner, the Divine Mercy, the Stations), and the seating (kneelers, chairs, short pews). Each option has a cost and an alignment; the parish reacts at half the strength it does to the church. Apart from that a pastor can restore the chapel (a one-time spend: windows, statues, more candles) and, once an adoration chapel is built, keep perpetual adoration going as a standing program. The chapel scene draws all of it.

**Religious houses.** Every diocese generates one to four houses from `content/houses.json`: an abbey, a friary, a monastery of nuns, with an order, a charism (contemplative or active), an alignment, and a size, all rolled independently. They are visible on the diocese card. A pastor may join forces with one (a one-time spend, a flag); after that a stipend to a contemplative house is a standing program that pays in piety and steadiness, and a confessor from an active house is a standing program that gives a block of the week back and a second face in the confessional. Events come to a parish that has done this. `house` conditions gate content on the diocese having such a house.

**Faculties for the older form.** Under the 2021 norms the diocesan bishop grants a priest faculties to celebrate the 1962 Missal. Any priest with a parish, vicar or pastor, may write to the chancery for them from the Mass sheet; the bishop's stance on the topic (`older_form_faculty`, rolled with his policy and usually shut where he shuts the parish Mass) and the man's Latin, his circle, and his years decide the answer. Faculties set `can_celebrate_tlm` and open the weekly action *The older Mass* (a weekday evening as a vicar, a Sunday afternoon if the pastor puts it on). A pastor needs them to *begin* the parish's own older Mass from 2021 on (a `calendar_year` condition); where it already stands it stays, and a parish with a Latin Mass community starts with it. Before 2021 the bishop's leave alone was enough. The traditional wing counts the man who asks; the record shows it.

**Away.** In Rome and Washington a priest-student can say Mass for a monastery of nuns, sing Vespers with the monks, and give a hand at a friary's kitchen, from the city scene or the routine sheet. Hours there build piety and a flag the cloister remembers.

### 8.5 The year, the pulpit, the staff, the deanery, and the men

*Added in playtesting.*

**The why.** Every move of a constituency's opinion is written with its reason and kept a quarter, and the Parish sheet reads them back: what moved the people, where the pews are heading and what pulls them, what the plate comes to and why. Numbers stay hidden where the design says; reasons are always shown.

**The liturgical year.** A strip under the clock shows the season and the feasts ahead. Feasts follow the US calendar; each parish has a patronal feast from its name; the communities' feasts (Guadalupe, Simbang Gabi, Santo Niño, Tết, Częstochowa, the Korean Martyrs) are kept where the community is. A `feast` condition gates scenes on the week. Vietnamese, Polish, Filipino, and Korean Masses join the language dial where the share warrants.

**The homily.** What the man preaches on is chosen a month at a time from six topics in content, each with weekly effects under its own name. It is the one lever a vicar has as fully as a pastor.

**The staff.** Desks the parish has (secretary, DRE, music director, maintenance) are filled by generated people. A pastor may let one go; the desk then draws three rolled candidates; a hire reads as new for half a year; a member of staff who cannot stand the priest may give notice.

**Away.** Canon 276's retreat is owed each calendar year and two weeks of vacation are allowed, at places in content with their own weeks, rest, effects, and a supply priest paid by a pastor. A week away runs instead of the routine and fires one authored scene; a skipped year is noticed.

**The map and the deanery.** Every parish has a place on a map of the diocese, the cathedral at the center and the country beyond the suburbs; miles follow the diocese's size. The deanery forms from the nearest parishes when an assignment starts, with a dean (a pastor long enough ordained may be named dean himself). A neighbor who trusts the man will trade cover, which gives a block of the week back; a neighbor may be said to want the same opening. Scenes come through `@dean` and `@deanery_priest`.

**The pastor's temperament.** A vicar's pastor is a mentor, a micromanager, or absent, rolled once and kept. A mentor leaves him the music and the homily dial and makes his hours with the people pay a little more; a micromanager wants his reports; an absent pastor leaves him most of the Mass and the desk, and his Masses. Each has its scenes and a yearly talk.

**The men you form.** In June a seminarian may come for ten weeks, carrying a block of the week; at the end the man writes his evaluation (strong, reserved, concerned), and an unwritten one writes itself. Four years on, a man he formed may be sent back as his parochial vicar, remembering what was written. A parish big enough may have a permanent deacon on staff, with his own scenes and half a block back.

### 8.6 The book: what a ministry adds up to

*Added in playtesting.* The game keeps a running count of what the man has actually done, and it is the one place in the game where numbers are the point rather than a thing to be hidden.

Counted: Masses celebrated, confessions heard, baptisms, first communions, confirmations prepared, weddings, funerals, anointings, and receptions into the Church. They accrue from the week as it was actually worked — the obligations kept and at what quality, the parish's size and how full it is, its generational shape (an aging parish buries more than it baptizes), and how many priests are in the house to share the work — and they keep accruing through a posting and through the years as a bishop, at that place's own rates.

The Profile sheet reads it back with the rest of a life: his name and age, the years since ordination, every parish and posting in order, the men he formed and where they are now, the vocations that came out of his parishes, the parishes he was given dying and handed on alive, the offices he has held, the degrees, and the groups he founded. It is the one screen that answers "what have I done with forty years", and it is written in whole numbers and plain sentences.


### 8.7 What is wrong with this parish in particular

*Added in playtesting.* The diocese writes down one problem (§8.2). These are the two to four other things the pastor finds in the first year, rolled at generation from a pool of named troubles and weighted by what the parish actually is: the 1961 school wing with asbestos in the lagging, the car park that belongs on paper to the family that owns the hardware store, the two choirs who have not spoken since 2004, the festival that has never shown anybody a ledger.

They are not a mechanic on their own. They are what the Parish sheet lists in the pastor's own words, what a `parish_issue` condition gates a scene on — by name, or by what it touches (buildings, money, people, liturgy, school, neighborhood, history) — and what an arc can be built on. Two parishes of the same kind never play the same, and a man moved after eight years finds a different set of things to worry about.


### 8.8 The thing he does besides the parish

*Added in playtesting.* It is shown on the You sheet, with the man, because it is his and not the parish's. A parish will take every hour a man has. What makes two priests of the same rank into two different men is what else they did with thirty years: a book, an hour a week on the diocesan radio, a lecture series around the deaneries, a translation nobody else would attempt, a pilgrimage led, Thursday mornings at the county jail, a seat on the hospital board, retreats preached in other men's parishes.

One at a time. It takes an hour or two of every week — off the top of the same budget as everything else — for two to five years, passes **milestones** that report themselves in the digest and move stats and standing, and then **lands or does not**: some works carry a real chance of coming to nothing, unless the man has built the thing that saves them (the book wants learning behind it; the radio hour wants a chancery that is not looking for a reason). Coming to nothing is also something that happened to a man, and the flags remember it.

It can be put down at any time, quietly, and nobody is told, because nobody was watching.


### 8.9 The town as a place

The parish's neighbourhood with a life of its own. Every parish has a **town**: five to seven *places* rolled once from archetypes by terrain (`content/town.json`; sixteen kinds: the diner, the employer, the high school, the funeral home, the bar, the field, the other church, the hall, the store, the library, city hall, the clinic, the shelter, the nursing home, the park, the station), named from pools over the parish's heritage and a street list, each with a blurb, a **state** (open, thriving, failing, closing, closed, new), a **regard** (−100..100, what its people make of him), and, where the archetype has one, an owner. The employer, the diner, and the funeral home come first where the terrain allows them. The town is kept in the save by parish, so a man who returns finds it as he left it, changed by the years between (`state.towns`).

- **The week.** After the cast has had its chance, a quarter of ambient lines are about a place, in the state it is in; they sit in the Around lane.
- **The year.** Places move (open → failing → closing → closed; open → thriving → open; a closed place is replaced, a year or more on, by something new of its kind). At most two changes a year. The employer and the station carry households with them: a closure costs the parish a share, an opening brings some. Each change is a line in the record and a row in the year in review.
- **Scenes in the town.** `content/events/parish/town.json`: things that happen at the diner, the union hall, the school board, the funeral home, the bar, the field, the other church, the shelter, the station. They hang on `{ type: 'town', key, value }` (a kind of place in a state) and `{ type: 'town_regard', key, op, value }`. Text can name the places: `{town}`, `{town:diner}`, `{town:employer}`, and the rest, with the plain word where the town lacks the place.
- **What the town remembers.** The effect `{ target: 'town', key, delta, value }` moves a kind's regard (or `any`) and, when `value` is a string, adds it to the town's memory, shown on the Town sheet. The town's regard is its own thing, beside the `public` constituency: the public is the diocese's press and its opinion; the town is the people at the counter.
- **The sheet.** A Town tab under the parish: each place, its state and since when, its regard, its blurb; and the memory.

Numbers (chances, household shares) are invented and live in the content file.

### 8.10 Correspondence

The mailbag: the place the past reaches him from. A few times a year a letter comes from *someone* rather than from the chancery: a parishioner whose father he buried, a family from a former parish with news of the man who came after him, a classmate abroad or one who left, a stranger who read the column, the mother of a seminarian he formed, his own mother or father or sibling, the pastor he served under, now retired. Most only tell. Some ask.

- **Templates as data** (`content/mail.json`): each letter names the kind of sender it needs; `systems/mail.ts` finds one from the man's own life (bonds, tenures, classmates and their trajectories, the formed, the family, a rolled stranger) or the letter does not come. Bodies are in the sender's voice, rendered when delivered. Suppression per template in years; at least four weeks between letters; about three a year.
- **Answered or left.** A letter with replies stops the clock like any letter. Each reply costs hours off next week (a parish week's blocks) and carries effects with the sender bound as `@sender`: a warmer friend, a bond written, a stand taken, a name given at the plant. Leaving it in the drawer is always allowed, costs nothing, and is recorded; some letters cool when left. The outcome is a line in the record and a note in the career.
- **The mailbag** on the Letters sheet: every letter, from whom, and whether it was answered, so the drawer's contents are visible and the unanswered asks are marked.
- Never a mechanic to be optimized: the letters are small, the effects are small, and the point is that the past keeps writing.

### 8.11 Lives that move without you

Every named person in the man's orbit carries a clock of their own: the staff of his parish and its deacon, the pastor he serves under and the priests of the deanery, his classmates, his family, his director, the brothers of his house. A year at a time (`content/lives.json`, `systems/lives.ts`), one of the lives there may begin for one of them: a spouse ill, a job offer, a baby coming, a parent dying slowly, a marriage coming apart, an illness of their own, the bottle, burnout, the thought of leaving, a parent failing, a sibling moving away, a back gone, a son thinking of the seminary, a grandchild. It runs its years and resolves one way or another (recovered or widowed; stayed or left; treatment, a quiet move, or the priesthood left), with a status for the person where it ends that way, a permanent mark, and small effects on the man.

- **Rolled from each person's own state**: who they are to him, their age, their sex, whether they are married; at most three begin a year; each life once per person.
- **Surfacing when they cross his path**: the beginning and the end are lines in the record; the sheets (staff, deanery, classmates, the house) show the open life under the name; the year in review has a row for who around him is carrying something. Deaths are notes in the career; a director's death ends the direction; a member of staff who dies or retires leaves the desk empty for the staff system to fill.
- **Scenes hang on them**: `{ type: 'npc_life', key, who? }` and the selector `@life:<id>`, which resolves to the person carrying that life, so a scene can be about *the* secretary whose husband is ill or *the* priest of the deanery who is drinking. The cast round (§8.2) moves the parish's lay people; this moves everyone else.
- Numbers (the chance a year, the years a life runs, the odds of each ending) are invented and live in the content file.

### 8.12 The presbyterate as people who talk

A rumour engine (`content/rumours.json`, `systems/talk.ts`). What the priests of the diocese say about each other and about him, seeded by what actually happened and distorted as it travels; wrong as often as right; a man's standing with his brothers moved by what is said as much as by what he did. The bishop hears the same things a step later.

- **Seeded by what happened.** About him, from his own record: a parish turned around or going under, a column, a stand taken in public, a promotion or a passing-over, a request to be moved, the hall opened to the shelter, the lot sold, looking worn out. About the men he watches (the deanery, the pastor above him, his classmates, the brothers of his house), from a snapshot diffed week to week: a man moved, made pastor, named to the chancery or a see, put on leave, dead, gone; a life opened (drinking, burnout, thinking of leaving, ill, a parent dying).
- **True or distorted.** A rumour is true a little more than half the time; the rest are distortions with a motive supplied or a fact improved. Each kind has both.
- **It goes round at once, and reaches him later.** Talk about him moves his standing with his brothers the week it starts. He hears a rumour later, at a venue: the deanery meeting, the dean in the parking lot, the priests' dinner, the confessors' dinner in Lent, the cathedral sacristy before the Chrism Mass, a classmate on the phone, a funeral lunch; a friar hears it at table, after chapter, from the provincial's secretary. Talk about himself reaches him only half the time.
- **The bishop a step later.** A rumour about him reaches the bishop six to fourteen weeks on unless he has set it straight, and moves the chancery's view by most of what it did to his brothers'. A note goes in the career.
- **Answering it.** Scenes hang on the talk (`rumour` condition; `@rumour_subject` selector for the man being talked about; `rumour` effect to answer the latest): set the record straight at the meeting, own the true one, let it lie, defend the man they are talking about or join in, and what the bishop says with his hand on the door. The deanery and house sheets show what he has heard; the year in review counts what went round about him, how much was untrue, and whether the bishop heard.
- Numbers (the share that is true, the chance a fact becomes talk, the hearing chances, the bishop's delay) are invented and live in the content file.

### 8.13 The house at night

The rectory after the office closes; the priory after Compline. What a man does with an evening alone, who calls, what he reads, whether he sleeps. A small nightly state (`NightState`: the evenings as a habit; company, rest, and the breviary as three numbers the sheets show only as words), kept in `content/night.json` and moved by `systems/night.ts`.

- **The evenings** are chosen on the Week tab and cost no hours, because they are outside the week's hours: company (the parlour open, dinner at the deacon's), quiet (the door shut at seven), reading, the phone (a classmate, your mother, the man who left), the breviary (Compline in the dark church), the television. Each pulls the nights toward its own targets; a vicar's rectory has a pastor in it and a friar's house has a community, so the same habit lands differently.
- **The week draws from it.** Rest decides how much a plain week recovers strain (from 0.6 of the base at no rest to 1.2 at full); the night office kept is a little piety a week; the phone warms the closest classmate. Strain pushes rest down, so a bad month makes worse nights, which make a worse month. Company under a floor with strain over a ceiling counts the alone weeks.
- **One scene a season in which the night is the whole of the story** (`night` condition; drawn ahead of the pool at most once in thirteen weeks): the phone at eleven, Friday in the empty rectory, the doorbell at midnight, Christmas night after the last Mass, the letter written at one in the morning, Compline in the dark and the woman in the back pew; and for a friar, the light under a door in the great silence and the common room at nine.
- **The bottle** is never a number and never a dial. It is a thread of authored scenes (§11): the third glass, noticed, after months of alone nights and too-much days, with a sink and a phone and a doctor on offer; the brother who noticed, with a number at the door; the place the diocese sends men, or the meetings on Tuesdays in the next town; a year, by the count kept. Every step has a way out, the way out is always written with respect, and the sheet says only that there is a bottle in the evenings, or the date he has been sober since.
- Numbers (the targets, the follow, the rest factor, the scene cadence) are invented and live in the content file and `NIGHT`.

## 9. Generation

### 9.1 Dioceses

The ten presets keep their character across runs; everything else rolls at game start.

- **New York** — large, wealthy, media-exposed, nationally significant cathedral
- **Chicago** — deep ethnic parish roots, shrinking, consolidating
- **Los Angeles** — enormous, fragmented, heavily Latino
- **Houston** — fast-growing, heavily Latino, short on priests
- **Washington, DC** — small, political, disproportionately connected to Rome
- **Philadelphia** — clerical, rowhouse parishes, a school system in retreat, traditional presbyterate
- **Boston** — Irish to the bone, chastened by the scandal, collaboratives, Brazilian and Haitian pews
- **San Francisco** — small, wealthy in land, a progressive laity under a conservative archbishop
- **Miami** — young, built by exiles, Cuban and Haitian, growing, short on priests
- **New Orleans** — old, French and Black Catholic, post-storm, in bankruptcy, the seminary of the South

**Incardination is permanent.** The player belongs to this diocese for life and does not transfer because he dislikes the bishop. This is what makes the succession roll land.

**Rolled per run:**

- **The bishop** — age (sets his runway), alignment, outspokenness, priorities (finances / vocations / education / social outreach / liturgy / evangelization), management style (delegator / micromanager / absentee / reformer), temperament (what he rewards, what he cannot tolerate), and his own ambition (a bishop angling for a larger see behaves very differently from a contented one). Plus **whether he already knows you**, rolled from the seminary record — in some runs he has a strong opinion before you speak to him. His priorities determine which stats get noticed, which alone makes two runs in the same diocese feel different.
- **Clergy shortage** (1–5) — the primary driver of promotion pace. Also roll the age distribution of existing pastors; a top-heavy diocese produces a cascade of openings in ten years.
- **Financial state** — healthy / strained / crisis. Crisis means parish closures, the ugliest and most interesting content in the game.
- **Faction balance** — three weights (traditional / mainstream / progressive) *plus a hostility value*. A diocese can be evenly split and peaceful, or lopsided and vicious.
- **Chancery composition** — 6–8 named officials with alignments and ambitions. They write the assignment memos. Some are the player's classmates.
- **Institutions** — seminary, university, hospital system, school network. Each unlocks assignment tracks and event pools.
- **Scandal exposure** — latent history plus how the current bishop handles it.

**The five parishes** each get: size, wealth, ethnic and generational makeup, alignment, building condition, debt, school status, current pastor (age, health, competence), staff, existing groups, and one live problem. Spread them deliberately — a wealthy suburban flagship, a struggling urban parish, a growing immigrant parish, a rural post, and one that is genuinely difficult (debt, a divided congregation, a predecessor who left badly).

**Custom dioceses (post-V1)** use the same generator with the preset layer replaced by player input. Build the presets *as data files in the same schema* and the custom feature is nearly free.

### 9.2 Classmates and NPCs

Build each man from **independent rolls**, never from an archetype list, or every run produces "the traditionalist one."

Roll separately: origin, entry age, prior education, alignment tendency, five-stat profile shaped by background, ambition, and a private struggle. Names come from era-appropriate pools weighted by the origin roll — **the same name can attach to wildly different men.**

**Alignment and stats roll independently.** The politically ambitious man is sometimes traditional, sometimes progressive, sometimes genuinely indifferent to all of it. That decoupling is what makes them read as people.

Each NPC carries **one hidden trait** the player discovers only through interaction: fragile, careerist, genuine mystic, hiding something, smarter than he lets on. Never shown in a roster panel.

**Class composition also rolls.** Sometimes twelve men with three obvious future bishops; sometimes six mediocrities, which makes the player look good and leaves his future network thin.

**Trajectories roll at ordination**, seeded from stats, ambition, and relationship with the player, then simulate forward in the background. The player should be genuinely surprised who ends up where.

**Departure to a religious institute is a trajectory, not a removal.** It moves the NPC off the diocesan ladder and into the religious cast (§9.4), where he keeps his record and his relationship with the player and loses every reason to compete with him.

### 9.3 Bishop succession

On death or retirement, the successor rolls with weight from Rome's current temperament, the outgoing bishop's residual influence, and the diocese's state (financial crisis → a fixer; scandal → an outsider). Every chancery relationship is instantly revalued and every public statement is re-read against a new standard.

### 9.4 Religious institutes and religious NPCs

Religious priests, brothers, and sisters are **standing characters**, not event flavor. Four asymmetries make them structurally different, and each is a mechanic rather than a colour:

1. **They are outside the player's ladder.** A religious never competes for a parish or a place on a terna, so he is the only cleric the player can be entirely honest with. Given that the game is largely about the gap between private belief and public record, that role has to exist somewhere.
2. **Neither the player nor the bishop controls them.** They answer to a provincial in another city, under obedience.
3. **They hold institutions the player needs and does not own:** university, hospital system, retreat house, high school, and often a parish.
4. **Charism cuts across the diocesan factions.** A Dominican and a Jesuit are not the same man, and neither maps cleanly onto traditional ↔ progressive.

#### Generation

Each diocese rolls **2–4 institutes present**, weighted by the preset: a Jesuit university in Chicago or Washington, a traditional institute where the traditional bloc is strong, teaching and nursing congregations everywhere. Each institute carries charism, size and trajectory (growing, stable, collapsing), alignment, works held in the diocese, and **relationship with the bishop** (warm, correct, or openly strained).

From those institutes, generate **4–6 named religious** as persistent NPCs, rolled on the same independent-attribute model as classmates (§9.2), plus a charism and a provincial. Standing roles worth filling:

- **The university theologian** — credentialed, published, sometimes a problem for the bishop. Academic-track gateway.
- **The order-run parish's pastor** — a peer with a different rulebook, in the middle of the friction below.
- **The hospital chaplain** — the man who has been present at more deaths than anyone else in the diocese.
- **The retreat master** — spiritual-direction gateway.
- **The itinerant preacher** — booked by every parish for missions, knows everyone, carries gossip across the whole diocese. An excellent information source.
- **The contemplative** — a monk or a prioress. Rarely seen, and the source of the few genuinely unnerving spiritual events in the game.

#### Spiritual direction and the internal forum

Piety otherwise only decays (§4.2), which is thematically right and mechanically thin.

**The relationship begins in seminary Y1, not at ordination.** The player chooses a spiritual director from three or four offered, most of them religious (§6.6). Kept, that relationship can run forty years and is the longest single thread in the game.

**The internal forum is a real canonical seal and the game uses it exactly as it exists.** Formation separates the internal forum, spiritual director and confessor, from the external forum of the rector and formation faculty who write evaluations. The director cannot be consulted by the formation team, cannot contribute to an evaluation, and cannot disclose anything said to him.

Mechanically: **nothing said in spiritual direction ever produces a reputation effect, an evaluation change, or a flag visible to any other NPC. Ever.** The guarantee is built into the engine, not into individual events: a spiritual-direction scene is structurally incapable of writing to the reputation system. See `CLAUDE.md`.

**The seal is also the best dilemma in the seminary arc.** The director cannot report the player, but he can insist the player go and disclose it himself, and he can refuse to let it go across multiple years. He pushes; he cannot act; the choice stays with the player. Author heavily against this.

The roles may be split: choose a director in Y1 and either keep him as confessor or use someone else. **Splitting them is a slightly guarded move and NPCs read it that way.**

The relationship provides:

- A recurring **1 AP** spend that **slows Piety decay** rather than merely pausing it, the only reliable maintenance channel in the game.
- A charism-and-temperament match determining **which crisis events the player can survive**. A brisk, practical director is useless during a dark night; a contemplative is useless to a man drowning in administration. A mismatch is worse than no director at all.

Directors can be changed, at a cost. They can die. They can be reassigned by a provincial with no notice. **That loss lands hard**, and the replacement is never as good immediately.

#### Women religious

- **The principal.** Runs the parish school. At pastor tier one of the best conflict NPCs in the game: the player holds canonical authority over the school, she holds thirty years of actual authority over it, and both of them know whose side the parents will take. She is also his most effective ally if he can get her there.
- **The local superior.** Runs a community and a work, a clinic, a shelter, a food program. Has opinions about the player and expresses them.
- **The contemplative prioress.** A monastery praying for the diocese. Appears rarely, carries disproportionate weight.
- **Parish staff sisters.** DRE, pastoral associate, sacristan. Common, and they change how a parish runs (§10.5).

#### Friction with the diocese

- The bishop wants a parish back from an order that has held it for eighty years, and the player is somewhere in the middle.
- A religious says something publicly that the bishop must answer for but cannot discipline.
- An order's institution adopts a policy the diocese opposes.
- An institute is collapsing from lack of vocations and must withdraw from its works, leaving the diocese to absorb them.
- A religious is available to say things a diocesan priest cannot risk saying, and can be used as a proxy, which is a real and slightly dishonourable option.

Religious NPCs make the `rome` constituency live earlier, because institutes are international and report through their own generalates, and they build the data model the religious-life expansion needs (§16).

---

#### Choosing a director (as built)

The kind of man is chosen before the man: a diocesan priest (the seminary's own director, or later an older pastor of the diocese), a friar of an active order, a monk of a contemplative house (the diocese's monastery, or a monk of the abbey two hours away when it has none, who is always among the offers), or a priest of the older observance. Each kind says what it is for; each man says what he is good to and what he is no use for, and two men of one temperament do not name the same weakness. A man who has lost his director looks for another from the You sheet, and the last one is not offered again. Nothing here writes outside the internal forum.

### 9.4a The order next door

*Added in playtesting.* §9.4 gives a diocese its institutes and its religious. This is what a parish priest can actually **do** with them, and what they do to him.

Each religious house of the diocese (the abbey, the friary, the Carmel) carries a **standing** with this priest: −100 to 100, built only by turning up — an hour a week in the routine, the guesthouse, Vespers, the parlor — and by saying yes when the house asks for something. It cools slowly when nobody goes. It is not reputation: no constituency sees it, the chancery has no view on it, and it cannot be bought.

**What standing buys**, each gated on a bar and spending some of itself in the asking:

| Favour | Needs | What it does |
|---|---|---|
| Their prayers for the parish, by name | nothing | the people know somebody prays for them who has never met them |
| A retreat at their house | a little | the canonical retreat, made properly, for nothing |
| A confessor every Saturday | a working relationship | most of the confessions hour back, and a box that is never empty |
| A preached parish mission | a real friendship | a parish that is different in April; the parish pays them |
| Supply cover when he is away | a real friendship | a retreat or a fortnight that costs the parish nothing |
| A priest of theirs for the parish | years of it | two blocks of the week back, and a second priest in the house |

**What the house asks in return**: a priest for their community Mass while their chaplain is ill, a second collection for their missions, their novena in his church, a letter backing them when the diocese wants their land, a young man of theirs boarded for a summer. Saying yes builds standing faster than any hour; saying no costs a little; **silence is a no**, and the clock answers for him in six weeks.

**The asymmetry is the point.** Every arrangement runs at the provincial's pleasure: once a year he may end one, less often where the standing is high, and the notice is six weeks and the reason is a house in another state. A pastor cannot appeal it, cannot hire around it, and cannot hold it against them, and the parish notices the Saturday confessional is dark.

### 9.4c Growing the order

*Added in playtesting.* A man **connected** to an order — standing at the bar, an order priest in his rectory, a chair at their table, or professed in their third order — can do more than ask favours of it. He can help it grow in his diocese, and the growth is on the map afterward:

| Work | Costs | What it does |
|---|---|---|
| **Help them build** | a gift to the building fund; once in five years | a wing on the house: three more of them, sent by a provincial who sends men where there is room |
| **Found a house of theirs** | a convent bought and given; once for an order in a life | a second house of the order in the diocese, made from the first, three to five men, its book beginning with his name; it starts with a standing of its own |
| **Be their patron** | a gift each year, standing | the house grows by a man most years, and counts him one of its own; the provincial may end it when the house can stand alone |

The mother house keeps its standing; a foundation has its own. Every house of an order is a house for favours and asks alike.

### 9.4b Three orders, told apart

*Added in playtesting.* §9.4 and §9.4a treat every active house alike: a confessor, a mission, a man for the rectory. A Dominican priory, a Franciscan friary, and an Augustinian priory are not the same neighbour, and the difference is data (`content/orders.json`), not a switch on the order's name. An **order profile** gives the order its own words (the house, the superior, the family, the governance, the habit), its own people beyond the roles every institute fills, the favours only it does, the asks only it makes, and the lines the sheet uses when one of its favours is given. Any order can be given a profile; three have one.

| | **Dominicans** (OP) | **Franciscans** (OFM) | **Augustinians** (OSA) |
|---|---|---|---|
| The house | a priory under a prior, elected for three years | a friary under a guardian | a priory under a prior, with the table at the centre of it |
| The family | friars, cloistered nuns, apostolic sisters, lay Dominicans | Friars Minor, Capuchins, Conventuals, TOR, Poor Clares, Secular Franciscans | friars, contemplative nuns, the Recollects, teaching sisters |
| Their people | the **prior** (always); the **lector** who has read everything, or a **student brother** who preaches better than he knows | the **guardian** (always); the **brother who runs the kitchen**, or the **friar in the box on Saturdays** | the **prior** (always); the **headmaster** of their school, or the **pastor of the parish they have held a century** |
| What only they do | a **course in the hall** (six Thursdays on the Creed); a **written opinion** from the lector that puts a stand of yours on paper the chancery cannot move | a **kitchen in your hall** on Tuesdays, standing; **the parish's winter** taken off the books | a **place at their school** for a family of the parish; a **chair at their table** on Thursdays, standing, the one arrangement that helps the man rather than the parish |
| What only they ask | the hall for a **public disputation** | your church for the **Transitus** on the 3rd of October | a **table at the school's dinner** |

**The house is the institute.** A house whose order has an institute in the diocese is that institute's house, linked by id, never by charism alone: the Dominicans of §9.4 and the priory of §9.4a are the same men, and they are generated first, before the pool fills the count. Every favour's effects are authored on the favour and applied when it is given (CLAUDE.md rule 1); a standing favour leaves a flag (`house:<id>`) that scenes read, and loses it when the provincial ends the arrangement.

**Dioceses differ.** A preset may say how present each order is (`orders`: strong, present, thin, none) and give a line of what it holds here, which is appended to the house's line in the preview because it is public knowledge. *Strong* means the institute is always present — Villanova does not roll away from Philadelphia; *none* means never; the rest weight the roll. The lines name real houses and provinces where the author was sure of them and stay general where he was not. A custom diocese without the block rolls on charism alone, in the same schema.

### 9.5 The men you were ordained with

*Added in playtesting.* A diocesan priest has no community and no rule. What he has instead is twenty men who were in the same building at twenty-four, and whichever of them he has bothered to keep up with.

The hours in the routine marked *time with brother priests* now land on **one man at a time** — the one he has left longest — rather than on a constituency. Everything else drifts: a friendship nobody tends slides back toward civil at a few hundredths a week, and stops at civil, because nobody forgets the seminary entirely.

What it buys is **favours**, each gated on the relationship and on what that man actually is: a weekend covered (blocks back in the week), a word at the chancery from somebody who is there, what the board is actually thinking three months early, a name for a roofer or a bookkeeper or a lawyer who will not charge a parish, and an hour on the telephone at eleven at night. A favour costs the man who grants it — that is what makes it a favour — and it cannot be asked of the same man twice.


## 10. Special interest groups

The parish's living layer and the most direct way the player changes anything.

Every parish generates with **3–6 existing groups**, each carrying: type, size, **vitality** (thriving / steady / declining / dying), **a named lay leader** with personality and agenda, alignment, and relationship to the player.

**Types:** young adult · youth · pro-life · St. Vincent de Paul and poor relief · Knights of Columbus · women's guild · Bible study · prayer and adoration · choir and music · RCIA · marriage prep · school parent association · ethnic and language communities · TLM society · social justice committee · men's group · grief support · addiction recovery.

### 10.1 The three verbs

**Sustain** — groups decay without attention. Spend AP or watch vitality fall. This is the quiet pressure that eats the week.

**Found** — costs sustained investment across months, requires recruiting a lay leader, and can fail outright. A founded group is the player's legacy and the thing he grieves on transfer.

**Suppress or let die** — withdrawing support from a group that is dysfunctional, hostile, or bleeding the parish. Politically expensive; the leader will call the chancery.

### 10.2 Why they matter mechanically

- **They do work the player would otherwise pay AP for.** A thriving St. Vincent de Paul handles poor relief for free. Investment compounds.
- **They are the lay support engine, and they are segmented** — groups reach constituencies the player cannot personally reach.
- **They generate events** — a pro-life group that wants to protest, a youth group with a chaperone problem, a women's guild at war with the new music director. A renewable content source specific to *this* parish.
- **Lay leaders are NPCs with agendas.** Some are saints. Some are empire-builders who treat the group as personal property. Firing a beloved but toxic leader is a genuine dilemma.
- **Groups fight each other** over the hall, the budget, the bulletin, and the player's attention.

### 10.3 Alignment friction

Groups carry alignment. A traditional priest inheriting a progressive social justice committee must work with it, redirect it, or let it wither — each costing something. **Founding groups that match your alignment is how a parish's character slowly changes** across a ten-year pastorate. And the next pastor may undo all of it; design for that sting.

### 10.4 Scale

At pastor level the player manages a portfolio rather than individuals. Post-V1 at diocesan level, groups become **movements** — Cursillo, Charismatic Renewal, Opus Dei, Neocatechumenal Way, diocesan TLM communities — where supporting or suppressing one is a major political act.

### 10.5 Religious-led groups

A group led by a sister or a religious brother is a different object from a lay-led one.

| Property | Lay-led | Religious-led |
|---|---|---|
| Vitality decay | Normal | **Far slower** — it is her assigned mission, not her hobby. She shows up whether encouraged or not. |
| AP to sustain | Normal | **Lower.** She is competent and does not need managing. |
| Suppress / let die | Available | **Unavailable.** The verb does not exist. She cannot be removed. |
| Loss risk | Leader may quit or be fired | **Her superior can reassign her** with six weeks' notice, for reasons unrelated to the player or the parish. The group she built may not survive it. |
| Deference | Varies | **Low.** She answers to her community, states disagreement plainly, and is not intimidated by the pastor. |
| Agenda | Often personal empire-building | Charism-driven. Different, not absent. |

So a parish with two sister-run groups is stable, cheap to maintain, and partly outside the player's control. **That is a meaningfully different parish to play**, and generation deliberately produces some of each. Parish staff sisters — DRE, pastoral associate, sacristan — follow the same rules.

---

## 11. Sensitive content policy

The game touches abuse and scandal, celibacy and loneliness, crises of faith, burnout, and alcohol. A diocesan simulation that omits them is sanitized to the point of dishonesty. Guidelines:

- **Abuse** is present as an institutional reality the player confronts as an administrator — allegations, chancery handling, the cost of a predecessor's crimes, a brother priest under suspicion. The player character is never a perpetrator and this is never a mechanic to optimize.
- **Celibacy, loneliness, and attraction** are handled as genuine interior struggle with real consequences, not titillation.
- **Doubt and burnout** are core mechanics via Piety, and leaving the priesthood is always an available, respected ending.
- Everything above is authored, never generated. See §12.

---

## 12. Event system and content pipeline

### 12.1 The hard rule

**Authored events own all state changes. The LLM only skins them.**

Three tiers:

1. **Authored** — triggers, conditions, choices, and effects in typed JSON. Deterministic, testable, version-controlled. All mechanics live here.
2. **Skinned** — the outcome is already decided; the LLM is handed the decision plus parish, NPC, and year context and asked to narrate it in specifics. **Generated text never determines a result.** Generate at arc start, not on click, and cache into the save file.
3. **Ambient** — parish bulletin, background chatter, the weekly digest. Fully generated, zero mechanical weight.

This rule is what keeps the game from turning to mush at hour twenty.

### 12.2 Draw model

Each phase-year has a pool of 12–20 events; each year draws 2–3. Pools are large enough that consecutive runs share roughly a third of their content.

Events are tagged by **pressure type**, not topic: `loyalty_vs_honesty` · `ambition_vs_integrity` · `friendship_vs_duty` · `belief_vs_safety` · `body_vs_vow` · `doubt` · `competence` · `money`.

The draw is **weighted by character, not uniform.** The Question 3 answer, alignment drift, standing with formators, and classmate relationships all bias which events fire. The pool is shared; *your* pool feels personal.

**Guarantee one beat per year, not one event.** Y4 always has candidacy; Y6 always has the diaconate promise. Which specific event carries that weight varies. Structure repeats, content does not.

**Suppression** — a fired event cannot recur for N years. **Chains** — a Y2 event plants a thread resolving in Y5 differently depending on what was done.

### 12.3 Schemas

```ts
type StatKey = 'administration' | 'charisma' | 'theology' | 'knowledge' | 'piety';

type ConstituencyKey =
  | 'chancery' | 'brother_priests' | 'parishioners'
  | 'traditional_bloc' | 'progressive_bloc' | 'public' | 'rome';

type Volume = 'private' | 'semi_public' | 'public';

type Phase =
  | 'seminary' | 'parochial_vicar' | 'administrator' | 'pastor'
  | 'chancery' | 'bishop';

type Condition =
  | { type: 'stat'; key: StatKey; op: '>=' | '<='; value: number }
  | { type: 'reputation'; key: ConstituencyKey; op: '>=' | '<='; value: number }
  | { type: 'relationship'; npcId: string; op: '>=' | '<='; value: number }
  | { type: 'credential'; key: string }
  | { type: 'flag'; key: string; value: boolean }
  | { type: 'alignment'; op: '>=' | '<='; value: number }   // -100 trad .. +100 prog
  | { type: 'outspokenness'; op: '>=' | '<='; value: number }
  | { type: 'phase'; value: Phase }
  | { type: 'season'; value: 'advent' | 'lent' | 'holy_week' | 'easter' | 'ordinary' }
  | { type: 'not'; inner: Condition }
  | { type: 'any'; inner: Condition[] };

interface Effect {
  target: 'stat' | 'reputation' | 'relationship' | 'flag'
        | 'group' | 'money' | 'ap' | 'thread' | 'position';
  key: string;
  delta?: number;
  value?: string | boolean;
}

interface Choice {
  id: string;
  label: string;
  requires?: Condition[];     // gate
  hidden?: boolean;           // hide entirely when requirements unmet
  volume?: Volume;            // if this choice states a position publicly
  positionTopic?: string;     // e.g. 'tlm', 'ecumenism', 'liturgical_dance'
  positionValue?: number;     // -100..100, recorded against the topic
  effects: Effect[];
  opensThread?: string;
  resolvesThread?: string;
  followUpId?: string;
}

interface GameEvent {
  id: string;
  phase: Phase;
  yearGate?: number[];        // e.g. [2,3] for philosophy years
  pressure: string[];
  severity: 'ROUTINE' | 'NOTABLE' | 'MAJOR' | 'CRITICAL';  // drives interrupts
  category: string;           // for interrupt configuration
  baseWeight: number;
  requires?: Condition[];
  bias?: { when: Condition; multiplier: number }[];
  suppressYears: number;
  once?: boolean;
  title: string;
  body: string;               // authored prose, may contain {tokens}
  flavorPrompt?: string;      // guidance for the skinning layer
  choices: Choice[];
}
```

### 12.4 V1 content targets

| Pool | Count |
|---|---|
| Seminary (all 7 years) | 100 |
| Parish life (vicar + pastor) | 150 |
| Group-generated | 60 |
| Assignment, promotion, evaluation | 40 |
| Personal, spiritual, crisis | 50 |
| Diocesan and succession | 30 |
| Special opportunities (§7.5) | 45 |
| Religious, direction, and the internal forum (§9.4) | 55 |
| Milestones of the book (§8.6) | 14 |
| The second half of a life: the institution, the parish, the man | 33 |
| **Total** | **~578** |

Seminary is the smallest self-contained chunk and the right first target. The late pool is what a long run is made of: the board that has stopped considering him, the deanery clustering, the school that cannot be carried, the organist whose hands have gone, the neighborhood that changed around a parish, the night road at seventy, and the arrangements a man eventually has to make. The religious and internal-forum pool is complete at 55: 22 sealed scenes (8 in the seminary, 14 across the priesthood) and 33 open ones (7 in the seminary, 26 in the parish years). The authored total across every pool now stands well past the V1 target.

---

### 12.5 Arcs: the things that take years

*Added in playtesting.* A scene is a week. An arc is the decade in which a family comes apart, a building is fought over, or a boy who served the eight o'clock turns into a priest.

An arc is authored as a list of **stages**, each naming one scene and a range of weeks to wait before it comes. Its scenes carry `beat: "arc"`, so the general draw never touches them: only the arc brings them, in order, with real years in between.

Rules:

1. **They open on their own.** Once a quarter the game may open one, weighted, from those whose conditions hold. At most two run at a time: more than that and a life is a soap opera.
2. **Once in a life.** A man does not bury the same family twice; an arc that has opened cannot open again, ended or not.
3. **A stage waits for its week and for its conditions**, and then arrives as an ordinary scene with an ordinary decision.
4. **Playing the stage advances it.** A choice may instead move the arc itself with the `arc` effect: `end` (with a word for how it ended), `hold:<weeks>`, or the id of a stage to jump to. Branching is therefore authored, not scripted around.
5. **Some travel and some do not.** An arc that belongs to a parish ends the day the man is moved — he is not there to see how it comes out and nobody writes to tell him. One that belongs to him goes in the car.
6. **Content can read them back.** An `arc` condition asks whether one is running, has ended, or ended a particular way, so later scenes know what a man carries.
7. **The Record sheet says what is running**, with the years so far, and lists what has finished and how.

### 12.6 The draw forgets slowly

A scene the player has seen is not forbidden — a parish does have the same argument twice — but it must be rarer than one he has not, and rarer again the more recently it came. On top of each event's own suppression window, the draw multiplies its weight by a factor from the last twelve years of the man's own history: about a third for one sighting, and down from there to a floor. Nothing is ever excluded by this alone.


## 13. Technical

**Stack:** Vite + React 18 + TypeScript. Zustand for state. Tailwind for UI. Vitest for tests. `seedrandom` for RNG.

Rationale: the game is 95% text, menus, stat panels, and dialogue trees, which is exactly where an agentic coding workflow is strongest and where iteration is instant. Content lives in plain JSON that can be bulk-authored. Scenes (office, church, meeting room) are layered static images or SVG with CSS transitions — sufficient for the described art direction. Godot would be right if real scene rendering or controller feel mattered; it does not, and it would cost significant productivity.

**Determinism.** One seeded RNG service. The seed is stored in the save. No `Math.random()` anywhere in game logic — this makes bugs reproducible and makes the promotion engine testable.

**Saves.** Exportable JSON. Include seed, full state, cached generated text, and event history.

**Structure:**

```
/src
  /engine        time, AP, RNG, save/load, event selection
  /systems       stats, reputation, promotion, assignment, groups, finance
  /generation    diocese, parish, npc, classmates, names
  /content       *.json event pools, preset dioceses, name pools
  /llm           skinning layer, prompt templates, cache
  /ui            screens, panels, components
  /types         shared TS types
/tests
```

---

**Postings as places.** A full-time posting away from a parish (the residence, the Newman Center, the hospital, the seminary faculty, the chancery) carries its own dials, moved by the hours of the week and by its scenes, and the hospital keeps a book beside them: anointings, deaths attended, baptisms at the bedside, receptions into the Church, confessions heard, Masses said. The hours fill the book on average rates rolled with the week's seed; authored scenes write to it directly (`record`) and to the dials (`place`), and may read both as conditions. The book is shown on the posting's sheet, counted in the digest, and written into the career record when the years end. The hospital's ministry dial gates a second chaplain and the scenes that come with a department rather than a pager.

## 14. Roadmap

**Phase 0 — Skeleton.** Types, Zustand store, seeded RNG, save/load, time engine with all four speeds, interrupt configuration. No content. *Done when a clock runs and saves.*

**Phase 1 — Seminary.** Character creation flow (including fields of study and degree-gated careers), classmate generation, the four-pillar emphasis system, event engine, evaluation logic, the seven years, ordination payload. ~100 events. *Done when a full prologue is playable start to ordination, including both failure endings.*

**Phase 1.5 — Opportunities.** The offer engine: requirement evaluation, windows and expiry, decline consequences, clustering, multi-year commitments running in the background. Seminary-tier offers first. ~45 events across both tiers. *Done when two different builds through the same seminary receive visibly different offers.*

**Phase 2 — World.** Diocese generation, five presets as data, **the pre-seminary preview screen and its hidden/visible field split**, seven-year drift, parish generation, chancery NPCs, bishop generation, assignment algorithm. *Done when ordination produces a real assignment to a real parish, and when a bishop can change during seminary.*

**Phase 3 — Parish loop.** AP allocation, obligations with quality dials, the standing routine, digest weeks, liturgical calendar, parish finance. ~150 events. *Done when ten years pass as a parochial vicar and feel different from each other.*

**Phase 4 — Groups and religious.** Generation, the three verbs, lay leader NPCs, vitality decay, group events; institutes, the religious cast, spiritual direction and the internal forum, religious-led groups. Both are parish-adjacent NPC layers on the same relationship machinery, so building them together is cheaper than splitting them. ~115 events. *Done when the player has a spiritual director whose loss would matter.*

One exception to that ordering: **the Y1 director selection and the religious formation faculty belong in Phase 1**, because they are part of the seminary flow. The NPC records and the selection scene are built there; the decay modifier and crisis matching can follow.

**Phase 5 — Promotion.** Full scoring engine, competing candidates, terna simulation, the pastor tier with projects and authority, bishop succession. *Done when V1's arc completes.*

**Phase 6 — LLM layer.** Skinning, ambient generation, weekly digest, caching. Retrofit onto working authored content, never before it.

**Phase 7 — Polish.** Art, sound, UI pass, balance, records and career summary screen.

**Post-V1:** chancery tier · auxiliary and diocesan bishop · custom dioceses · cardinal · papal conclave. The expansions are §16.

---

## 15. V1 definition of done

A player can review five generated dioceses and choose one knowingly, create a character with a distinct background and a real tie to that diocese, live seven years of seminary that vary meaningfully between runs, be ordained, be assigned somewhere by an algorithm that considered him as a candidate, spend a decade or more as a parochial vicar in a parish with its own politics and groups, receive and refuse offers that arrived because of specific things he built, survive at least one bishop succession, be appointed pastor of a parish through a decision he can trace to specific things he did, run that parish for several years, and reach a career summary that reads like a life rather than a score.

Two playthroughs from the same starting choices should diverge visibly by the fourth seminary year.

---

## 16. Expansion roadmap

Ordered by how much each builds on existing systems rather than running parallel to them.

**E1 — Rome.** *First.* Additive rather than parallel: it touches every existing system and needs almost no new machinery. The Pope as a rolled NPC (two to four papacies per career), documents as the content vehicle (encyclical, exhortation, motu proprio, dicastery instruction, responsum, off-the-cuff papal remark), and the **implementation cascade** — Rome issues, the bishop interprets, the player is the last interpreter standing in front of actual people. Plus conclave, interregnum as a distinct state where all appointments freeze, the apostolic nuncio as a power centre separate from the bishop, and **reversal**: you spent two years implementing something painful, you lost families over it, and the new pope has undone it. Makes the dormant `rome` constituency live and gives the public record (§5.4) its real teeth. ~30 documents, ~50 events.

**E2 — Province and conference.** Metropolitan archbishops, suffragan dioceses, the national conference, priest loans across diocesan lines, regional reputation. **Not a standalone expansion**: it is a prerequisite for the bishop tier and belongs in that work.

**E3 — Religious life.** A full parallel campaign: a second character-creation flow, novitiate and juniorate instead of seminary, vows instead of incardination, community instead of parish, *elected* superiors instead of appointed pastors, and a ladder running to provincial, abbot, or superior general. Reuses the event engine and little else. Ship only when the diocesan game is genuinely finished. The base-game religious NPCs (§9.4) build the data model in advance. **Round 1 shipped** (R1.0–R1.5): the full specification is `docs/EXPANSION-E3-RELIGIOUS.md`. A friar is a separate campaign chosen at the title: Dominican or Augustinian, a province spanning presets and generated dioceses, the house and its horarium, poverty as permissions, obedience with a consultation before every letter, reassignment across dioceses, dual authority over a parish, chapters that elect prior and provincial ballot by ballot, terms and the return to the ranks, and each order's own mechanics as data. Content is at the §14 targets. A friar asks the prior for an office of the house and writes to the provincial for a work beyond it, drawn from what the generated diocese holds (E3 §3.10).

**E4 — Crossing over.** Diocesan-to-religious transition and back, biritual and bi-status clergy, a diocesan priest joining an institute in midlife. Depends entirely on E3.

**E5 — Alive.** The world around the man, made to move on its own. **Round one shipped**: a living cast per parish (`systems/cast.ts`, `content/parish/cast.json`: the sacristan, the flowers, an usher, the choir, the counters, a server, a widow, the one with opinions, the family; parts held by the generated parishioners, named in the week, moved by the year, refilled when emptied, at the door on the last Sunday); weather and the seasons (`systems/weather.ts`: a climate from the diocese's region, a rolled week that is a word in the header, a pull on that Sunday's pews, and a wash over the rooms); and the feasts kept in full (`FEAST_PULL` and `content/parish/feastLines.json`: each feast fills or empties the church and the basket that week and says what happened on it, with the cast in it; the man's own name day from `content/namedays.json`). **Feasts as scenes**: every parish feast has at least one scene, drawn feast-first on its own week whether or not the week is played; a friar keeps his order's calendar too (`OrderDef.feasts` in `content/religious/orders.json`, read by `systems/religious/feasts.ts`: the founder's solemnity, the doctors, the patrons, the devotions, the Order's dead, and the house's own patron from its name), each a line in the record, on the calendar strip, and a scene of its own (`content/events/religious/*_feasts.json`). The rest, in the order they are worth building:

- *The town as a place.* The parish's neighbourhood with a life of its own: the diner, the school board, the plant that closes, the ballpark, the bar the deacon owns, the funeral home that sends the parish its dead. Generated from the parish's terrain and the diocese's region, named from pools, and changing over the years (a shop that closes, a new development, a highway). Digest lines and scenes that happen *in* the town rather than in the church, and a town that remembers what the priest did in it.
- *Correspondence.* A mailbag beyond the chancery: letters from parishioners, from a classmate abroad, from a former parish, from a stranger who read the column, from the mother of a seminarian, from a man you buried's daughter ten years on. Some ask for something; most only tell. Answered or not, and the answering costs an hour. The mailbag is the place the past reaches him from.
- *The presbyterate as people who talk.* A rumour engine: what the priests of the diocese say about each other and about him, seeded by what actually happened (a transfer, a scandal, a parish turned round) and distorted as it travels. Heard at the deanery meeting, the priests' union, the confessors' dinner; wrong as often as right; and a man's standing with his brothers moved by what is said as much as by what he did. The bishop hears the same rumours a step later.
- *NPCs with lives that move without you.* Every named person carrying their own clock: the secretary's husband is ill, the DRE is looking at a job in another parish, the pastor next door is drinking again, the classmate's mother died. Rolled a year at a time from each person's own state, surfacing when they cross the man's path, and never waiting for him to notice. The cast round built this for the parish's lay people; this extends it to staff, clergy, and family.
- *The wider Church.* Papal transitions and the interregnum (E1's conclave brought forward), synods that ask the diocese for a report, the national conference's votes shifting Rome's temperament and the bishops' priorities, a document that lands in every parish the same week. A world that changes its mind over a career, and a man who lived through three popes and can say what each one cost him.
- *The house at night.* The rectory after the office closes: what a man does with an evening alone, who calls, what he reads, whether he sleeps. A small nightly state (company, quiet, the bottle, the phone, the breviary) that the week draws from and that the years shape, and the one scene a season in which the night is the whole of the story.

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

### 6.6 Exit payload

Ordination emits: final stats, alignment, archetype, credentials, private and public position records, classmate roster with relationship values, evaluation history, latent risks, and submitted assignment preferences.

---

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

**Need** (0–100) — how badly the diocese requires a body. The largest lever, and it swings hard. Shortage, retirement waves, and a parish in crisis all promote fast and forgive a lot. A well-staffed diocese with a deep bench makes you wait ten years.

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

---

## 9. Generation

### 9.1 Dioceses

The five presets keep their character across runs; everything else rolls at game start.

- **New York** — large, wealthy, media-exposed, nationally significant cathedral
- **Chicago** — deep ethnic parish roots, shrinking, consolidating
- **Los Angeles** — enormous, fragmented, heavily Latino
- **Houston** — fast-growing, heavily Latino, short on priests
- **Washington, DC** — small, political, disproportionately connected to Rome

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

**Custom dioceses (post-V1)** use the same generator with the preset layer replaced by player input. Build the five presets *as data files in the same schema* and the custom feature is nearly free.

### 9.2 Classmates and NPCs

Build each man from **independent rolls**, never from an archetype list, or every run produces "the traditionalist one."

Roll separately: origin, entry age, prior education, alignment tendency, five-stat profile shaped by background, ambition, and a private struggle. Names come from era-appropriate pools weighted by the origin roll — **the same name can attach to wildly different men.**

**Alignment and stats roll independently.** The politically ambitious man is sometimes traditional, sometimes progressive, sometimes genuinely indifferent to all of it. That decoupling is what makes them read as people.

Each NPC carries **one hidden trait** the player discovers only through interaction: fragile, careerist, genuine mystic, hiding something, smarter than he lets on. Never shown in a roster panel.

**Class composition also rolls.** Sometimes twelve men with three obvious future bishops; sometimes six mediocrities, which makes the player look good and leaves his future network thin.

**Trajectories roll at ordination**, seeded from stats, ambition, and relationship with the player, then simulate forward in the background. The player should be genuinely surprised who ends up where.

### 9.3 Bishop succession

On death or retirement, the successor rolls with weight from Rome's current temperament, the outgoing bishop's residual influence, and the diocese's state (financial crisis → a fixer; scandal → an outsider). Every chancery relationship is instantly revalued and every public statement is re-read against a new standard.

---

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
| **Total** | **~475** |

Seminary is the smallest self-contained chunk and the right first target.

---

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

## 14. Roadmap

**Phase 0 — Skeleton.** Types, Zustand store, seeded RNG, save/load, time engine with all four speeds, interrupt configuration. No content. *Done when a clock runs and saves.*

**Phase 1 — Seminary.** Character creation flow (including fields of study and degree-gated careers), classmate generation, the four-pillar emphasis system, event engine, evaluation logic, the seven years, ordination payload. ~100 events. *Done when a full prologue is playable start to ordination, including both failure endings.*

**Phase 1.5 — Opportunities.** The offer engine: requirement evaluation, windows and expiry, decline consequences, clustering, multi-year commitments running in the background. Seminary-tier offers first. ~45 events across both tiers. *Done when two different builds through the same seminary receive visibly different offers.*

**Phase 2 — World.** Diocese generation, five presets as data, **the pre-seminary preview screen and its hidden/visible field split**, seven-year drift, parish generation, chancery NPCs, bishop generation, assignment algorithm. *Done when ordination produces a real assignment to a real parish, and when a bishop can change during seminary.*

**Phase 3 — Parish loop.** AP allocation, obligations with quality dials, the standing routine, digest weeks, liturgical calendar, parish finance. ~150 events. *Done when ten years pass as a parochial vicar and feel different from each other.*

**Phase 4 — Groups.** Generation, the three verbs, lay leader NPCs, vitality decay, group events. ~60 events.

**Phase 5 — Promotion.** Full scoring engine, competing candidates, terna simulation, the pastor tier with projects and authority, bishop succession. *Done when V1's arc completes.*

**Phase 6 — LLM layer.** Skinning, ambient generation, weekly digest, caching. Retrofit onto working authored content, never before it.

**Phase 7 — Polish.** Art, sound, UI pass, balance, records and career summary screen.

**Post-V1:** chancery tier · auxiliary and diocesan bishop · custom dioceses · religious orders · cardinal · papal conclave.

---

## 15. V1 definition of done

A player can review five generated dioceses and choose one knowingly, create a character with a distinct background and a real tie to that diocese, live seven years of seminary that vary meaningfully between runs, be ordained, be assigned somewhere by an algorithm that considered him as a candidate, spend a decade or more as a parochial vicar in a parish with its own politics and groups, receive and refuse offers that arrived because of specific things he built, survive at least one bishop succession, be appointed pastor of a parish through a decision he can trace to specific things he did, run that parish for several years, and reach a career summary that reads like a life rather than a score.

Two playthroughs from the same starting choices should diverge visibly by the fourth seminary year.

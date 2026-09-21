# Expansion E3 — Religious Life

*Round 1: the Order of Preachers (Dominicans) and the Order of Saint Augustine (Augustinians). Round 2: the Franciscan family and the brother track.*

*Depends on `DESIGN.md` V1 being complete. Reuses its engine; this document specifies only what is new or different.*

---

## 1. Vision

The diocesan game is about one man belonging to one place for life, advancing by the favor of superiors he did not choose.

The religious game inverts almost all of it. **You belong to a family, not a place. You will live in five or six cities. You own nothing. And no one appoints you to lead — your brothers elect you, for a fixed term, and then you go back to being one of them.**

The central tension shifts accordingly. The diocesan priest struggles to stay a priest while becoming a manager. The religious struggles to stay a brother while becoming anything at all — because the community only elects the men who visibly do not want to be elected, and the vow of obedience can undo any plan with a single letter from the provincial.

### Round 1 scope

- Two playable orders: **Dominicans** and **Augustinians**
- **Clerical track only** — the player is a friar headed for priesthood
- Formation through ordination, multiple assignments across dioceses, the full chapter and election system, and elected office through **provincial**
- The general curia (Master of the Order, Prior General) exists as a rare late-career possibility, not a designed arc

**Deferred to round 2:** the Franciscan family (three branches) and the **brother track** — a non-ordained career that belongs with the Franciscans because Francis himself was never ordained and brotherhood sits at the center of Franciscan identity.

---

## 2. The inversions

Everything below follows from this table.

| System | Diocesan | Religious |
|---|---|---|
| Belonging | Incardinated in one diocese for life | Professed into an order and a province spanning many dioceses |
| Geography | One city, one bishop, forever | Reassigned every 3–6 years, often to a different state |
| Advancement | Appointed by the bishop | **Elected by brothers**, for a fixed term |
| Power | Accumulates and is kept | **Temporary.** Term ends, you return to the ranks |
| Ambition | Useful if aligned | **Disqualifying if visible** |
| Money | Salary, personal finances, a car | **Nothing.** Every expense is a permission |
| Home | A rectory, often alone | A priory, always with brothers |
| Daily obligations | Masses, confessions, meetings | Plus the Office in common, conventual Mass, meals, recreation, chapter |
| Superior | The bishop | **Two**: the provincial over your person, the local bishop over your pastoral work |
| Main constituency | The chancery | **The province** — every friar is a voter |
| Point of no return | Diaconate | **Solemn profession** |

---

## 3. Shared religious-life systems

These are order-agnostic and parameterized by order data. Build them once.

### 3.1 Obedience and mobility

The provincial assigns every friar, typically for 3–6 years. Before each assignment there is a **consultation**: the player states preferences, can argue, can object on real grounds. Then a letter arrives.

- **Obedience is the default and the game should honor it.** Accepting an unwanted assignment with good grace raises `superiors` and `province` standing and slightly raises Piety.
- **Visible reluctance** is remembered.
- **Refusal** is possible and extremely serious: it opens a formal process that can end in dismissal from the order. This should be one of the heaviest choices in the entire game, available and almost never correct.

Because a province spans several states, **each assignment places the player in a new diocese** with a new bishop, new laity, and mostly fresh local reputation. Standing with the province, the order, and Rome persists. This means a single religious career visits several generated dioceses — **the diocese generator must run without presets** (see §13).

**The assignment algorithm is reused from `DESIGN.md` §7**, with the provincial as the deciding actor. His inputs differ slightly: province need dominates, fit matters, and the friar's *formation* needs (a young friar sent somewhere to grow) are a factor bishops never consider.

### 3.2 The house

The player always lives in a **house** — a priory, a friary, a studium, a novitiate, or a small community attached to a parish, school, or mission.

Each house carries:

- **Members** — 4 to 40 friars, each a generated NPC, with a real age pyramid (many houses skew old)
- **Prior** — elected or appointed local superior
- **Cohesion** (0–100) — how well the community actually lives together
- **Observance** (0–100) — how strictly the common life is kept: attendance at common prayer, the habit, silence, meals together
- **Alignment** — its own, distinct from the diocese it sits in
- **Works** — what the house does: a parish, a school, a campus ministry, a preaching apostolate, formation
- **Budget** — held in common, controlled by the prior

The house replaces the rectory as the player's home and the presbyterate as his daily peer group. It is smaller, more intimate, and impossible to escape. **The old friar who drives everyone mad is at dinner every night.**

### 3.3 The horarium

The common life consumes mandatory AP before any assignment work begins.

| Obligation | Min | Standard | Invested |
|---|---|---|---|
| Liturgy of the Hours in common | 1 AP (attend selectively) | 2 AP | 3 AP |
| Conventual Mass | 1 AP | 1 AP | — |
| Community meals and recreation | 0 AP (absent often) | 1 AP | 2 AP |
| House chapter (monthly, amortized) | — | 0.5 AP | — |

The quality-dial rule from the base game applies. **Skipping common prayer is visible to everyone in the house, every day.** Minimum observance buys back AP at a cost to `community` standing, cohesion, and Piety. Invested observance is the religious equivalent of the invested homily.

Assignment work (parish, school, teaching, preaching) then takes its own mandatory floor on top. **The religious player has less discretionary time than the diocesan priest**, offset by carrying almost no administrative load unless he is a superior.

### 3.4 Poverty

The player has no money. Mass stipends, salaries, speaking fees, and gifts all go to the community.

Every personal expense is a **permission** from the prior: books, travel, a retreat, a sabbatical, a car for a ministry, a trip home when a parent is dying. Permissions are granted or refused based on the player's relationship with the prior, the house budget, the prior's own temperament, and precedent.

This makes **the prior a gatekeeper to almost everything**, which is the mechanical reason the local superior matters so much in daily play.

Poverty also creates:

- A latent-risk category: the friar with a private bank account, the gift quietly kept
- **The retirement burden** — provinces carry the cost of their elderly friars, and an old province is often a poor one. Province finance crises are a major content source at provincial level.
- A different relationship with donors. The friar cannot be bought, and some donors find that disconcerting.

### 3.5 Vows as milestones

Formation is structured around vows rather than orders.

- **Simple (temporary) profession** — at the end of the novitiate. Renewable, and each renewal is a real gate: the community is consulted and can vote against.
- **Solemn (perpetual) profession** — the point of no return. It replaces the diaconate as the emotional peak of formation. **The game should slow down here exactly as it does for the diaconate in the diocesan arc.**
- **Diaconate and priesthood** still follow, and matter, but they are not where the irrevocable choice sits.

### 3.6 Chapters and elections

The heart of the expansion and the system most worth getting right.

#### Chapter levels

| Chapter | Who votes | What it does |
|---|---|---|
| **House chapter** | Solemnly professed members of the house | Consulted on admissions to profession; community decisions; in many cases elects the prior |
| **Provincial chapter** | Delegates from the houses plus ex officio members | Elects the provincial; passes the acts that govern the province |
| **General chapter** | Delegates from every province worldwide | Elects the head of the order; sets direction for the whole order |

#### The election model

No one is a declared candidate. Every eligible friar can receive votes.

Each elector NPC scores every eligible friar on:

- **Respect** — stats, weighted by what the office requires (a province in debt weights Administration; a province in decline weights Charisma)
- **Relationship** — the elector's personal relationship with the candidate
- **Record** — how he performed in his last posts
- **Alignment** — match on the province's internal fault lines
- **Seniority and age** — too young is presumptuous; too old is a caretaker
- **Province need** — the chapter's reading of what the moment requires
- **Perceived ambition** — **a strong negative**

Each elector votes for his top-scoring candidate. Ballots are simulated round by round:

- Early rounds require an **absolute majority**
- If no one reaches it after a fixed number of ballots, the vote narrows to the leading candidates
- Each round, some electors shift — away from a fading candidate toward a viable one, toward a friend, toward a compromise

**The game should show the ballots.** Round-by-round tallies, the moment a compromise candidate surges, the friar who was expected to win stalling on the third ballot. This is a scene the player watches, not a number he receives.

#### Player agency at chapter

As an **elector**: vote, speak in the chapter's discussion, back a friend, quietly steer a bloc. **Steering too visibly backfires** and raises the player's own perceived ambition.

As a **potential candidate**: signal willingness or unwillingness, privately and carefully. Accept or **decline** after election. Declining carries honor in some cases and costs in others; declining twice ends the question permanently.

**Confirmation.** Most elections are confirmed by the higher superior. Confirmation is almost always given. The rare refusal is one of the most dramatic events in the game.

#### The ambition inversion

The player carries a **perceived ambition** value (0–100), partly hidden from him, raised by:

- Lobbying, or being seen to lobby
- Seeking visible posts, speaking too much at chapter
- Accepting every opportunity offered
- Public self-promotion and high outspokenness on non-doctrinal matters

It falls with time, with accepting humble assignments well, and with declining things.

**High perceived ambition is nearly fatal in elections.** The path to high office is to be excellent, trusted, and visibly uninterested in office. The best-positioned friar in the province is often the one who has spent six years quietly running the novitiate and turning down every invitation to speak.

### 3.7 Term limits and return to the ranks

Every elected office has a term, and most have a limit on consecutive terms. When the term ends, **the superior returns to ordinary life** and is assigned by his successor like anyone else.

This produces the best recurring content in the expansion: the former provincial assigned as parochial vicar in a parish run by a friar he once governed; the former prior living under the man who ran against him; the ex-superior who cannot stop governing.

Returning well is a virtue the game should reward. Returning badly — resentment, factionalism, undermining the successor — is a real and tempting failure mode.

### 3.8 Dual authority

When a religious serves as pastor of a parish entrusted to his order:

- The **bishop appoints** him, on the **presentation** of his provincial
- **Either the bishop or the provincial can remove him**, each informing the other, neither needing the other's consent

Two keys, and either can turn. Mechanically: the player's standing with the local bishop *and* with his provincial both gate his tenure, and he can lose his parish for reasons entirely unrelated to it — province needs him elsewhere, or a new bishop wants the parish back.

**Order withdrawal** is a major event: a shrinking province decides it can no longer staff a parish it has held for eighty years and hands it back to the diocese. The bishop is furious. The parishioners are devastated. The player may be the man sent to close it.

### 3.9 Constituencies

The religious campaign replaces the diocesan constituency set:

| Key | Who |
|---|---|
| `community` | The player's current house |
| `province` | Every friar in the province — **the electorate** |
| `superiors` | The provincial and his council |
| `local_bishop` | The current diocese's bishop and chancery |
| `laity` | The people of the current assignment |
| `order` | The international order and its general curia |
| `rome` | As in E1 |
| `observant_bloc` / `progressive_bloc` | The province's internal fault line (habit, liturgy, common life, choice of apostolates), distinct from diocesan politics |

`community` resets partially on each transfer. `province` is the long game.

The conviction and volume system from `DESIGN.md` §5 carries over unchanged. **Outspokenness now multiplies fit with the province's electorate as well as with superiors.** A loud friar aligned with the province's majority is a natural provincial; a loud friar aligned against it never will be.

---

## 4. Character creation changes

The base creation flow is reused. Changes:

### 4.1 Order and province selection

Replaces the diocese preview (`DESIGN.md` §3.1a). The player first chooses an **order**, then a **province** from a preview card showing:

- **Size and trajectory** — growing, stable, shrinking; the age pyramid in plain language
- **Disposition** — observant↔progressive, with a tension readout
- **The provincial** — name, age, years in office, temperament line, priorities
- **Works** — what the province does and where
- **Territory** — which of the game's dioceses fall in it
- **Complication** — one visible problem (retirement debt, a failing school, a withdrawal from parishes under discussion)

Round 1 provinces follow the real U.S. structure:

**Dominicans** — four U.S. provinces:
- **St. Joseph** (Eastern) → New York, Washington DC
- **St. Albert the Great** (Central) → Chicago
- **St. Martin de Porres** (Southern) → Houston
- **Most Holy Name of Jesus** (Western) → Los Angeles

**Augustinians** — three U.S. provinces:
- **St. Thomas of Villanova** (Eastern) → New York, Washington DC
- **Our Mother of Good Counsel** (Midwest) → Chicago, plus Houston as thin-presence territory
- **St. Augustine** (Western) → Los Angeles

Each province's territory is filled out with **generated dioceses** beyond the five presets.

**Real orders and provinces, generated people and institutions.** Following the base game's rule (real cities, generated bishops), the provinces are real but every friar is generated, and the order's colleges, schools, and priories are **generated analogs** of real ones — "a Dominican college in New England," not the real institution by name — because events will put them through generated crises.

### 4.2 Why this order

Added after Question 3. The player chooses what drew him to this order specifically:

- **The charism itself** — preaching and study, or community and interiority
- **A friar who marked him** — generates a named mentor NPC in the province
- **Intellectual attraction** — Aquinas for the Dominicans, Augustine's *Confessions* for the Augustinians
- **Longing for community** — weighted toward the Augustinians
- **Left a diocesan seminary** — a hook for round 2 and E4, carrying a question mark into the novitiate
- **Alumnus of the order's school or college** — a real and common pipeline; grants province contacts from the start

### 4.3 Tie to the province

Replaces tie to the diocese:

- **Grew up near one of its houses** — known to older friars, a local bonus in that city
- **Educated in its schools** — strong `province` baseline, a network of friars who taught you
- **Came from outside** — no history, no bonus, judged only on formation

### 4.4 Religious name

**Dominicans only.** At clothing, the novice receives a religious name. The player chooses from a list shaped by the order's saints plus a free-text option. Purely cosmetic, and worth including because it is a genuine moment of identity change and costs nothing to build.

### 4.5 Unchanged

Origin, road to formation (education, field of study, careers), why you went, family, something in your past, and cosmetics all work exactly as in the base game.

---

## 5. Formation — seven years

**The seven-year rule holds: ordination = entry age + 7**, for both orders. This matches real formation closely enough to keep the base game's formula intact.

### 5.1 Dominican formation

The formation pillars are **the four pillars of Dominican life**, reskinning the base engine:

| Pillar | Stat mapping |
|---|---|
| **Prayer** | Piety |
| **Study** | Theology, Knowledge |
| **Community** | Charisma |
| **Preaching** | Pastoral blend |

**Y1 — Novitiate.** A brief postulancy folds into the start of the year. **Clothing with the habit** and reception of the religious name early in the year. A year of prayer, common life, chant, and study of the constitutions under the **novice master**. The solemnly professed friars of the novitiate community judge whether the novice is fit. At year's end, **simple profession** — made, distinctively, as a single vow of obedience, understood to contain the others.

**Y2–3 — Studium: philosophy.** At the province's house of studies. Heavily Thomistic. The **master of students** now guides formation. Prior-degree discount applies as in the base game, and is larger for philosophy/theology backgrounds. Simple vows renewed.

**Y4 — Theology I.** First major evaluation by the studium. Part-time ministry begins.

**Y5 — Theology II.** Specialization becomes visible. The first **study dispensation** offers can appear (§6.2). Simple vows in their final period.

**Y6 — Theology III. Solemn profession and diaconate.** The point of no return. Solemn vows are made kneeling before the provincial. Diaconate follows.

**Y7 — Theology IV.** Serving as a deacon in a parish while living in community. **Ordination.** First assignment follows.

### 5.2 Augustinian formation

The formation pillars reskin around Augustinian values:

| Pillar | Stat mapping |
|---|---|
| **Interiority** | Piety |
| **Truth** | Theology, Knowledge |
| **Community** | Charisma |
| **Service** | Pastoral blend |

**Y1 — Pre-novitiate.** Living in an Augustinian community, working, praying with the friars, beginning studies. Low intensity, high discernment. The community forms its first opinion.

**Y2 — Novitiate.** Reception of the habit. A year apart under the novice director: the Rule of Augustine, the order's history, interiority. At year's end, **first profession** of poverty, chastity, and obedience.

**Y3–7 — Theological studies.** At a large theological union shared with many other orders — **which means the Augustinian student lives and studies alongside Franciscans, Servites, and others.** This seeds round 2 directly: classmates from other orders become cross-order NPCs.

**Temporary vows are renewed annually**, and every renewal is a gate: the community is consulted each year. This gives the Augustinian formation five small discernment checkpoints instead of the Dominican's one long simple-vow period, which is a real difference in feel.

**Solemn profession** falls around Y5–6. **Diaconate** Y6. **Ordination** at the end of Y7.

### 5.3 Shared formation rules

- **The novitiate class** replaces the seminary class and uses the same independent-roll generator (`DESIGN.md` §9.2). Novitiate attrition is higher than seminary attrition, and the game should reflect it: several men leave during the novitiate year in a typical class.
- **Evaluations, holding back, dismissal, and voluntary departure** work as in the base game, with community votes on profession layered on top.
- **The spiritual director and the internal forum** (`DESIGN.md` §9.4) carry over unchanged. For religious, the director is often from the same order, which is a tradeoff: shared charism, but a man embedded in the same electorate.
- **Classmates persist for the entire game** — and in the religious campaign, they are also voters in every chapter the player ever faces.

---

## 6. The Dominicans

*The game of the mind and the pulpit. Your output is truth, spoken. The chapter is a senate.*

### 6.1 Charism in play

The order exists to preach, and it preaches out of study and contemplation — handing on to others what has been contemplated. Its motto is *Veritas*. Every Dominican mechanic should push the player toward the pulpit and the library, and make him pay for both in community time.

### 6.2 Dominican systems

**Study is protected.** Study AP costs 25% less for Dominicans across the whole career. Theology grows faster.

**Study dispensations.** The Dominican tradition allows a friar to be dispensed from certain community obligations for the sake of study. The player can petition for one during a degree, research project, or major teaching load. Granted, it **lowers the horarium's mandatory AP** — at a cost to `community` standing and house cohesion, because the brothers are covering for him. A long-dispensed scholar can end up respected across the order and a stranger in his own house.

**Preaching reputation.** A separate tracked value (0–100), portable across every assignment and province. Grows from invested homilies, parish missions, retreats, and preaching opportunities. High preaching reputation generates **invitations from outside the province** — the Dominican path to becoming a figure (`DESIGN.md` §5.6). It is the one reputation that travels with the friar when every other local standing resets.

**Veritas amplification.** Public positions on doctrinal matters carry **1.25× weight** for Dominicans. People expect the Dominican to be right. The credibility cuts both ways: **being publicly wrong costs more**, and a Dominican caught in doctrinal inconsistency takes a heavier hit than a diocesan priest would.

**Dense democracy.** The order is famously democratic. Dominican houses vote on more matters, chapters are more frequent in the player's life, and elections are more contested. More chapter events, more ballots, more politics among brothers.

**Choral office.** Common prayer is sung and demanding. The Liturgy of the Hours line in the horarium runs one AP higher at every quality level for Dominicans, and absence is more conspicuous.

### 6.3 Offices

**Appointed** (by the provincial and council): novice master, master of students, **regent of studies** (oversees the intellectual life of the province — a distinctively Dominican office), promoter of preaching, vocation director.

**Elected**: prior (roughly 3-year terms), provincial (roughly 4-year terms), Master of the Order (a single long term, roughly 9 years, not renewable).

**Endgame rarities** via E1: the **Theologian of the Papal Household**, a post traditionally held by a Dominican.

### 6.4 Credentials

In addition to base-game credentials:

- **Lector of Sacred Theology** — the order's own teaching credential
- **Master of Sacred Theology** — the order's highest academic honor, conferred for distinguished teaching and scholarship over a career. **A late-career capstone**, never available before roughly twenty years of teaching. Grants permanent `order` and `rome` standing.
- **Roman degrees** from a Dominican pontifical university — worth more than domestic equivalents, as in the base game

### 6.5 Assignment types

Priory church or parish · campus ministry · teaching at the house of studies · teaching at a Dominican college · itinerant preaching · formation (novitiate or studium) · Roman study or teaching · a preaching apostolate or media work.

### 6.6 Dominican event texture

The pull between the library and the house. The brilliant student who cannot live in community. Being asked to preach something the player is not sure is true. The chapter where the province splits over what the order should be doing in this century. A dispensation that turned a man into a stranger. Being sent to preach a parish mission in a parish that does not want to be preached to.

---

## 7. The Augustinians

*The game of the heart and the household. Your output is community. The chapter is a family.*

### 7.1 Charism in play

The Rule of Augustine begins with living together in harmony, one in mind and heart, directed toward God. The order's spirituality rests on the search for truth, the practice of charity, and unity, with a deep emphasis on **interiority** — God found within, more inward than the self. Every Augustinian mechanic should make the health of the community the player's primary concern and his own spiritual life depend on it.

### 7.2 Augustinian systems

**Cohesion is primary.** House cohesion matters more for Augustinians than for any other order. It directly **modulates Piety decay for every member of the house**: high cohesion slows decay, low cohesion accelerates it and fires conflict events. The player is responsible for the house's cohesion even when he is not the prior — **the community is, in a real sense, his spiritual director.**

**Friendship.** Augustine wrote about friendship as few others have, and the order treats it as a spiritual good. The player has **2–3 close-friend slots** — deep bonds with specific brothers that function almost like a second spiritual director: crisis-survival bonuses, Piety support, honest scenes. Friends can be in other houses, but maintaining a friendship across distance costs AP. **A transfer that splits close friends should hurt more than anything else in the Augustinian game.**

**The restless heart.** Augustinian Piety swings wider. Deep drops happen more easily — and **a survived crisis raises the Piety ceiling**, so the man who has come through a dark period ends higher than he started. This models conversion as a pattern rather than an event, which is the shape of Augustine's own life.

**Education.** Schools and universities are central Augustinian works. A **school presidency** is a major pastor-equivalent role, with its own budget, faculty, parents, alumni, and board. An Augustinian career can run largely through education.

**Missions.** International missions are a major assignment type: long postings abroad, in places with their own languages and churches. The missionary track has its own event pool and returns the friar with a language, `order` standing, and a changed sense of what the Church is.

### 7.3 Offices

**Appointed**: novice director, formation director, vocation director, school principal or president, mission superior.

**Elected**: prior, provincial (roughly 4-year terms), councilors, assistant general, **prior general** (six-year terms, renewable once — a friar can lead the order for twelve years).

### 7.4 Credentials

In addition to base-game credentials:

- **Patristics** — from the order's own patristic institute in Rome. A distinctively Augustinian academic track, centered on the Church Fathers, with Augustine himself at its heart.
- **Educational administration** credentials for the school track

### 7.5 The Roman connection

The current Pope is an Augustinian who led the order for two terms as prior general, and the order is unusually prominent as a result. The game should model this generically rather than historically:

- If the rolled Pope in the E1 layer is from the player's order, `rome` standing baselines rise for every friar in it, and order-related opportunities multiply.
- **The rarest event in the religious game:** a friar from the player's own province — someone he lived with, studied with, voted for or against — is elected Pope. It should be possible, rare, and handled as a shock.

### 7.6 Assignment types

Parish · high school teaching and administration · college or university work · international mission · formation · the order's retreat and spirituality works · the patristic institute in Rome.

### 7.7 Augustinian event texture

A house where the cohesion has quietly failed and no one will say so. The close friend transferred across the country. Running a school whose alumni love the friars and whose finances do not. Coming home from a decade in a mission to a province that no longer recognizes the man who left. A crisis that ends higher than it began. The brother who needs to be forgiven for the third time.

---

## 8. Reputations — what you are known for

Constituency standing answers *how much do they like me*. Reputations answer **what am I**. They are the flavor layer, the currency of elections, and the gate on founding a house.

A reputation is a portable 0–100 value. Unlike local standing, **it survives every transfer** and crosses province lines. It is built slowly by repeated discretionary work, reinforced by event choices, and gated by stats — you cannot become known as a confessor with low Piety no matter how many hours you sit in the box.

### 8.1 The set

| Reputation | Built by | Stat gates | What it does |
|---|---|---|---|
| **Confessor** | Extra confessions, week after week, for years | Piety, Theology | Penitents travel to you. Other priests and religious come to you. Eventually people who matter come to you, and you cannot tell anyone. Quiet, enormous, unusable power. |
| **Preacher** | Invested homilies, parish missions, retreats | Charisma, Theology | Invitations from outside the province. The fastest route to becoming a figure. |
| **Professor** | Teaching, degrees, research, publication | Theology, Knowledge | Faculty appointments, doctoral students, academic networks, credibility in doctrinal disputes. |
| **Spiritual director** | Directing others over years | Piety, Knowledge | You form the formators. Directees become a network of men who trust you completely — and whom you can never discuss. |
| **Evangelist** | RCIA, conversions, street and campus work, missions | Charisma, Piety | Draws the unchurched and the curious. Vocations follow evangelists. |
| **Liturgist** | Invested liturgy, chant, ceremony, training others | Knowledge, Theology | Beautiful worship draws people from outside the parish. Polarizing by nature. |
| **Man of prayer** | Monastic observance: silence, adoration, the night office, lectio, fasting | Piety | The reputation for holiness from the base game, now one of the set. Slows Piety decay. The province protects such men. |
| **Builder** | Turning around failing works, debt, buildings, budgets | Administration | You get sent where things are broken. A blessing and a sentence. |
| **Advocate** | The poor, prisoners, immigrants, public witness | Charisma, Piety | Public standing, moral authority, and reliable political enemies. |
| **Pastor of the dying** | Hospitals, hospice, deathbeds, grief | Piety, Charisma | The least glamorous reputation and the one laypeople never forget. |
| **Confidant** | Donors, civic figures, chancery, benefactors | Knowledge, Charisma | Money and access. Faintly suspect among the brothers. |

### 8.2 Mixes make identities

The design payoff is combination. **Two or three high reputations resolve into a recognized identity** with its own effects, its own event pool, and its own way of being described in one sentence by men who have never met you.

| Mix | Identity | Effect |
|---|---|---|
| Confessor + Man of prayer | *The one they line up for* | Massive lay draw, strong Piety protection, the province shields him from administrative assignments |
| Professor + Preacher | *The public intellectual* | National reach, media, invitations, Rome notices |
| Evangelist + Builder | **The founder** | The strongest gate on founding a house (§9) |
| Liturgist + Professor | *The reformer* | Influential and polarizing; the province splits over him |
| Spiritual director + Professor | *The formator* | Shapes a generation; his students fill the province in twenty years |
| Builder + Confidant | *The fixer* | Sent everywhere, trusted with everything, elected to nothing |
| Advocate + Preacher | *The prophet* | Public power, permanent friction with someone |

### 8.3 Why this matters mechanically

**The electorate votes for a reputation, not a stat sheet.** When a chapter meets, electors are not reading attribute values — they are asking what this man is. A friar the province can describe in one phrase is electable. A competent friar nobody can characterize is not. This is the single largest change to the election model in §3.6: add a **legibility** term to elector scoring, driven by the player's highest reputations.

**Reputations drive what NPCs ask of you.** The provincial assigns against them. Bishops request you by name. Houses petition for you. A high Confessor reputation means the game starts handing you people in trouble whether or not you wanted that career.

**A reputation you did not earn is a liability.** Reputations can overshoot the underlying stats — a lucky sermon, a flattering profile, one famous convert. When that happens, the game asks you to do the thing you are supposedly good at, in public, and you may not be able to.

**They decay.** Slowly, and only if wholly unused. The scholar who has not published in fifteen years is still *the professor*, but less so every year.

---

## 9. Foundations — starting a house

*The creative layer. This is where the religious game stops being a career and becomes a legacy.*

A note on terms: what is being founded is a **house** — a priory, a friary, a new community. A *chapter* is the governing assembly that votes. The doc uses **foundation** for the act and **house** for the thing.

### 9.1 How it starts

Two triggers:

**You are asked.** The provincial or the chapter approaches you because a need exists and your reputations fit it. This is the better path: it arrives with province backing already in place.

**You petition.** You propose a foundation at chapter, with a location, a work, and a plan. Harder, more satisfying, and it raises perceived ambition unless your reputations carry it.

**There is no age requirement.** A friar of thirty-four with the right reputations and a bishop who wants him can found a house. Age helps — seniority reads as stability, and the chapter worries less — but it is one term in a score, not a gate. A young founder is rare, watched, and enormously exposed.

### 9.2 Choosing where

The player browses the province's territory, **sortable by state and city**, with each location showing:

- **Need** (1–5) — the central number. Catholic population without adequate care, a bishop asking for friars, a university with no chaplaincy, a collapsing parish nobody can staff
- **Standing invitation** — whether the local bishop has already asked for a house here
- **The bishop** — disposition toward religious, and toward your order specifically
- **Existing presence** — your order's houses nearby, and other orders already working there
- **University** — presence and type, which opens the academic model
- **Vocations climate** — the age and religiosity of the local Catholic population
- **Cost** — what it would take to start

**Higher need raises approval odds substantially.** A province will say yes to a thin plan in a desperate place and no to a strong plan in a comfortable one. This is the lever the player should learn to read first.

### 9.3 Approval

Two keys, as always in religious life:

**Your province must send men.** Scored on: the fit of your reputations to the proposed work, `province` standing, perceived ambition, seniority, whether the province can actually spare three or four friars, and province finances. A shrinking province in retirement debt says no to almost everything.

**The diocesan bishop must consent in writing.** Canonically required to erect a house. So the local bishop's disposition is a hard gate, not a modifier — and a bishop succession during the approval process can kill a foundation outright.

Failure is normal, especially early. A refused petition is not wasted: it establishes the idea, and a second attempt three years later with a better location scores higher.

### 9.4 The charter

Approved, the player writes the house's founding charter. **This is the design layer and the heart of the feature.** The charism is fixed — a Dominican house preaches, an Augustinian house lives in common — but everything below it is yours.

| Dial | Range | Consequences |
|---|---|---|
| **Observance** | Relaxed → strict | Strict attracts serious young vocations and creates friction with a relaxed province. Affects cohesion, Piety decay, and who applies. |
| **Liturgy** | Modern vernacular → chanted Latin office, and for Dominicans **the order's own rite** | The single most visible choice. Draws people from across the diocese or drives them away. Shapes the house's public identity more than anything else. |
| **Primary work** | Preaching · teaching · study house · parish · evangelization · poor relief · retreats | Determines the event pool, the income, and which friars want to be assigned here. |
| **University relationship** | None → adjacent → embedded | Embedded gives faculty appointments, a chaplaincy, a student vocations pipeline, and a permanent negotiation with an institution that has its own agenda. |
| **Alignment** | Traditional → progressive, within the charism | Where the house sits on the province's fault line. |
| **Poverty** | Moderate → austere | Austere builds credibility and limits what the house can do. |
| **Size target** | Small and deep → large and broad | Gates when daughter houses become possible. |

These interact, and the interactions are the game. Strict observance plus a traditional liturgy plus preaching is a vocations magnet in most eras — and puts the house permanently at odds with a progressive provincial who can, at any chapter, reassign its members. Relaxed observance plus an embedded university produces prestige, publications, and almost no vocations.

### 9.5 Running it

The house becomes a persistent object the player develops over decades:

- **Vocations.** Candidates arrive based on the house's character, visibility, the player's reputations, the location, and the era. Vocations are the resource everything else converts into.
- **Formation.** If the house grows enough it can take novices or students, which means **the player forms the men who will fill it** — and who will vote in chapters for the next forty years.
- **Works.** Add a school, a chaplaincy, a retreat program, a shelter. Each is a project in the base game's sense.
- **Reputation.** The house develops reputations of its own, on the same model as §8. *That house where the office is sung.* *That house the students go to.*
- **Finances.** Sunday supply, stipends, benefactors, tuition, donations.

### 9.6 Daughter houses

At roughly fifteen to twenty friars, the house can send out a foundation of its own.

**The player chooses who leads it** — one of the men he formed. That choice is the deepest thing in the expansion: you are selecting an heir, and the daughter house will inherit his reading of the charter rather than yours. A daughter house under a man who was always slightly stricter than you becomes, in thirty years, a different kind of place.

Enough daughter houses and the cluster can eventually become a vicariate or a province in its own right. That is a forty-year outcome and should be reachable roughly once in a long, well-played career.

### 9.7 The house outlives you

You will not be superior forever. Terms end. The provincial reassigns you. **A successor can revise the charter**, and a successor chosen by a hostile chapter will.

The late-career content here is the best in the game: returning at seventy to the house you founded at forty and finding the office no longer sung. Or finding it exactly as you left it, full of men you never met, who know your name.

Foundations can also fail outright: vocations never come, the bishop who invited you is replaced by one who resents religious, the province recalls your men during a shortage, the money runs out. **Early foundations should fail often.**

---

## 10. How the two orders feel different

| | Dominicans | Augustinians |
|---|---|---|
| **Core question** | What is true, and can you say it? | Can you live with these men and love them? |
| **Protected resource** | Study time | Friendship |
| **Portable reputation** | Preaching | — (reputation is local and relational) |
| **Piety model** | Standard decay, choral office heavy | Cohesion-modulated, wider swings, crises raise the ceiling |
| **Risk profile** | Doctrinal errors cost more | Community failure costs more |
| **Chapter feel** | A senate: frequent, contested, argued | A family: fewer votes, more personal |
| **Typical career** | Scholar, preacher, formator | Educator, pastor, missionary |
| **Signature office** | Regent of studies | School president |
| **Formation shape** | One long simple-vow period | Annual renewals, five small gates |

**Build test:** the same character, played through both orders, should produce two careers that feel like different games by year ten.

---

## 11. Integration with existing systems

**Reused unchanged:** stats, credentials, conviction and volume, the event engine, the internal forum, the spiritual director, special opportunities (reskinned per order), groups (for parish assignments), the diocese generator, the NPC generator, the speed system.

**Reused with a new actor:** the assignment algorithm (provincial instead of bishop), the promotion model (electors instead of a single decision-maker for elected offices; provincial for appointed ones).

**E1 (Rome) hooks:**
- **Apostolic visitation** of an order or a province — Rome sends an investigator. A heavy multi-year event for the entire province.
- Papal documents addressed to religious life specifically
- A Pope from the player's order (§7.5)
- Religious appointed as bishops — which within orders is often felt as a loss, since the man leaves the order's governance for good

**Base-game religious NPCs** (`DESIGN.md` §9.4) should be migrated onto this expansion's data model, so a Dominican NPC in the diocesan game is the same kind of object as a Dominican player.

---

## 12. Data model additions

```ts
type OrderKey = 'OP' | 'OSA';              // round 2: 'OFM' | 'OFMConv' | 'OFMCap'

interface OrderDef {
  key: OrderKey;
  name: string;
  pillars: { label: string; stats: StatKey[] }[];   // 4 entries, drives formation engine
  governance: {
    priorTermYears: number;
    priorMaxConsecutive: number;
    provincialTermYears: number;
    generalTermYears: number;
    generalRenewable: boolean;
  };
  formation: FormationStage[];
  mechanics: {
    studyApDiscount?: number;          // OP: 0.25
    studyDispensation?: boolean;       // OP
    preachingReputation?: boolean;     // OP
    doctrinalVolumeMultiplier?: number;// OP: 1.25
    choralOfficeExtraAp?: number;      // OP: 1
    cohesionModulatesPiety?: boolean;  // OSA
    closeFriendSlots?: number;         // OSA: 3
    pietyCeilingRaisedByCrisis?: boolean; // OSA
    annualVowRenewal?: boolean;        // OSA
    religiousName?: boolean;           // OP
  };
}

interface Province {
  id: string;
  order: OrderKey;
  name: string;
  dioceseIds: string[];                // presets + generated
  houseIds: string[];
  friarIds: string[];
  provincialId: string;
  councilIds: string[];
  finances: { balance: number; retirementBurden: number };
  factions: { observant: number; progressive: number; hostility: number };
  trajectory: 'growing' | 'stable' | 'shrinking';
}

interface House {
  id: string;
  provinceId: string;
  dioceseId: string;
  kind: 'priory' | 'studium' | 'novitiate' | 'parish' | 'school' | 'mission' | 'curia';
  memberIds: string[];
  priorId: string;
  cohesion: number;
  observance: number;
  alignment: number;
  works: string[];
  budget: number;
}

type ChapterLevel = 'house' | 'provincial' | 'general';

interface Chapter {
  id: string;
  level: ChapterLevel;
  week: number;
  electorIds: string[];
  office?: string;                     // if electoral
  ballots: { round: number; tallies: Record<string, number> }[];
  outcome?: { electedId: string; accepted: boolean; confirmed: boolean };
}

interface ReligiousPlayerState {
  order: OrderKey;
  provinceId: string;
  houseId: string;
  religiousName?: string;
  vows: {
    simpleWeek?: number;
    renewals: number[];
    solemnWeek?: number;
  };
  perceivedAmbition: number;           // 0–100, partly hidden
  preachingReputation?: number;        // OP
  closeFriendIds?: string[];           // OSA
  dispensed?: { from: string[]; untilWeek: number };
  termsServed: { office: string; startWeek: number; endWeek: number }[];
}
```

The religious campaign is a **separate campaign type selected at the main menu**, sharing the engine. Constituency keys are defined per campaign type, not globally.

---

## 13. Engine prerequisites

Before any order-specific work:

1. **Abstract the player's institution.** The engine currently assumes a diocese. It must support either a diocese or a province as the player's home institution.
2. **Per-campaign constituency sets.** Constituency keys become data, not a hardcoded union.
3. **Data-driven formation pillars.** The four-pillar engine reads labels and stat mappings from the order definition.
4. **Diocese generator runs without presets.** A province spans dioceses beyond the five presets, so the generator must produce complete non-preset dioceses on demand. This is most of the custom-diocese feature's engine work — the UI can still wait.
5. **Multi-actor decisions.** The promotion system must support an electorate as well as a single decision-maker.

---

## 14. Content targets — round 1

| Pool | Count |
|---|---|
| Shared religious life (house, horarium, obedience, poverty, dual authority, return to the ranks) | 80 |
| Chapter and election scenes | 25 |
| Dominican formation | 50 |
| Dominican career | 60 |
| Augustinian formation | 50 |
| Augustinian career | 60 |
| **Total** | **~325** |

---

## 15. Roadmap — round 1

**R1.0 — Engine generalization.** The five prerequisites in §13. No new content. *Done when the base game still plays identically and a province can be instantiated in a test.*

**R1.1 — Shared religious systems.** House generation, the horarium, cohesion and observance, poverty permissions, obedience and consultation, reassignment across dioceses, dual authority. *Done when a friar can be moved through three houses in three dioceses and each feels different.*

**R1.2 — The chapter engine.** Electorate construction, elector scoring, ballot simulation with majority rules and narrowing, confirmation, the ambition inversion, the ballot-by-ballot scene. **Test this more heavily than anything else in the expansion.** *Done when a provincial election run from the same seed produces the same ballots, and different seeds produce plausible, varied outcomes including upsets.*

**R1.3 — Dominicans.** Order definition, province data, creation additions, seven-year formation, study dispensation, preaching reputation, Veritas amplification, offices, content. *Built first because Dominican democracy stress-tests the chapter engine hardest.* *Done when a Dominican career runs from novitiate through an elected priorship.*

**R1.4 — Augustinians.** Order definition, province data, cohesion-modulated Piety, friendship slots, the restless-heart curve, annual vow renewals, education and mission tracks, content. *Done when the build test in §10 passes: the same character in both orders feels like two games by year ten.*

**R1.5 — Integration.** E1 hooks, migration of base-game religious NPCs onto the new model, provincial-level content, the rare general-curia events.

**Round 1 is done when** a player can choose either order and a province, pass through novitiate and vows to ordination, serve in several dioceses under obedience, live through chapters he can watch ballot by ballot, be elected to office, serve a term, and return to the ranks.

---

## 16. Round 2 — The Franciscans and the brother track

Planned, not specified. Notes for the next pass:

**Three branches as variants of one order.** Friars Minor, Conventuals, and Capuchins share a founder and a rule and differ in history, observance, and texture. Implementing them as **variants of a single order definition** tests whether the data model can express close relatives without duplication — valuable before any further orders are added.

**The brother track.** A non-ordained career: formation without ordination, solemn vows without priesthood, ministry through work, service, and presence rather than sacraments. It belongs here because Francis was never ordained and the Franciscan tradition centers the fraternity rather than the priesthood.

The canonical question of whether a lay brother can hold major superior roles in a clerical institute has changed in recent years and must be **verified against current law before implementation**. The game should model whatever the current rule actually is, including any need for Holy See permission.

**Heavier poverty.** The Franciscan poverty model should be stricter than round 1's, with more permissions, less discretion, and more friction with the practical demands of running institutions.

**Cross-order seeding.** Augustinian students in round 1 study alongside Franciscans. Those NPCs should already exist when round 2 ships.

---

## 17. Open questions

1. **Can a player transfer between orders mid-career?** Real, rare, and a natural E4 feature. Recommend deferring.
2. **Should the general curia get a designed arc** (Master of the Order, Prior General), or remain rare events in round 1? Recommend events only until the bishop tier exists, since both need the same "international body" machinery.
3. **Round 1 women religious.** Dominican and Augustinian sisters exist as NPCs via `DESIGN.md` §9.4. A playable sisters' campaign would be a separate, substantial design. Worth a conscious decision rather than silent omission.

---

## 18. Instructions for Claude Code

Add to `CLAUDE.md`:

- **Orders are data.** Every order-specific behavior is a flag or parameter on `OrderDef.mechanics`. No `if (order === 'OP')` anywhere in engine or systems code. If a mechanic cannot be expressed as data, extend `OrderDef` and say so.
- **The chapter engine is deterministic and exhaustively tested.** Same seed, same electorate, same ballots — every time. Test majority rules, narrowing, confirmation refusal, declined elections, and ambition effects as table-driven cases.
- **The base game must not regress.** R1.0 changes core engine abstractions; the full base-game test suite must pass unchanged before any religious content is written.
- **Verify canonical details before hardcoding them.** Term lengths, formation stages, and governance rules in this document are close to real practice but should be treated as configurable defaults, flagged for verification, and never scattered as literals through the code.
- **Real orders, generated people and institutions.** Never name a real living friar, and use generated analogs for the orders' schools, colleges, and priories.

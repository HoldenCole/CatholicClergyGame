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

**The house knows who governs it.** A chapter that seats the player writes him onto the house (`priorId: 'player'`, the old prior's tag gone) or the province (`provincialId`), and a parish house's parish takes him as pastor; the `@prior` and `@provincial` selectors then find no one, so a scene about "the prior" cannot fire while he is the prior, and the validator refuses any religious scene that speaks of the prior or the provincial without either the selector or an `office:` condition. When his term ends the chair stands empty and the body elects his successor at once, with him voting and not on the ballot (`successorChapter`). A scene that compares a person's age to his uses the `npc_age` condition, never a line that assumes it.

**The prior's desk** (`systems/religious/priorDesk.ts`, options in `content/religious/priorDesk.json`, the Prior sheet). While the office is his, three levers: the **rule** of the house (a target its observance drifts toward a point or so a week; the men of a mind gain or lose regard for him once, and a house being moved rubs his standing and its cohesion while it moves), the **offices of the house** in his gift (a man named is grateful, a better-fitted man passed over notices, and a house whose offices are filled rests at a higher cohesion), and the **purse** (one-off spends from the budget held in common, each with a cooldown: the library, the fabric, the guest wing, the door, the house's holiday, a man sent to study). A prior holds no office of the house under himself, gives himself permissions and dispensations at a larger cost with the house than asking, and answers the diocese's pastors himself. The elected offices take blocks (`ap` on the office in `orders.json`). To anyone not prior the sheet shows what the house's prior has set, greyed.

**The friar's week** is the diocesan twelve with the common life counted in: `weekBlocks` is 12 plus the horarium at standard, so a friar keeping the common life as the house does has the diocesan priest's week less his work, the minimum buys blocks back in full view of the house, and the invested level costs him.

**Formation houses sit where the province keeps them.** A province seed may pin its house of studies and its novitiate to a see city (`studiumSee`, `novitiateSee`: a preset diocese or a see of the generated pool); the house itself is generated and named from the order's pools. Verify the cities before relying on them; they are flagged in the data.

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

#### Discretionary spends

The religious activity set differs from the diocesan one and weights toward study, prayer, and the confessional:

- **Study** — the largest single category for religious, and protected for Dominicans (§6.2)
- **Degree and research work** — a multi-year background commitment, far more common than in a diocesan career
- **Teaching** — a house of studies, a school, a university. For many friars this is the primary work, not a side path.
- **Confessions** — friars are the Church's confessors. Central here in a way it never quite is for a busy pastor.
- **Preaching missions and retreats** — travel, days at a time
- **Sunday supply** — going out to cover Masses at diocesan parishes. Unglamorous, recurring, and valuable: it brings money into the house, spreads the player's name across a whole diocese rather than one parish, and costs him his Sundays. The most reliable slow builder of broad lay reputation in the religious game.
- **Monastic observance** — extended silence, lectio divina, adoration, the night office, manual labor, chant, fasting. Builds Piety and the *man of prayer* reputation (§8) and advances nothing worldly whatsoever. **This tension is the point.** A friar can spend thirty years becoming holy and remain entirely unelectable.
- **Spiritual direction of others** · **writing and publishing** · **community building** · **works of mercy**

Track a personal **observance** value alongside the house's, and let the gap between them generate friction in both directions.

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
- **Legibility** — whether the electors can describe this man in one phrase, driven by his highest reputations (§8.3). A competent friar nobody can characterize is not electable.

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

### 3.10 Asking for a work

A friar does not apply for jobs; he asks, and two men answer. **An office of the house** (procurator, sacristan, local promoter of vocations, guest master, infirmarian, librarian, and each order's own: the Dominican cantor and lay-chapter assistant, the Augustinian lay-fraternity assistant and prefect of the hall) is in the prior's gift, asked at the table and answered there by a seeded roll against fit, the prior's regard, and the house's. It costs blocks every week on top of the horarium and pays a little back; one at a time; laid down before a year, the house remembers; it stays with the house when he moves. **A work beyond the house** is asked of the provincial by letter and answered in four to ten weeks against the province's need, the man's fit, his standing with the council, and how often he has written. Local works are done from the house he lives in and are drawn from the institutions the generated diocese holds: the hospital chaplaincy, the county jail, the diocesan seminary's faculty, campus ministry at the university, the diocesan high school, and an order's own (itinerant preaching for the Dominicans, retreat direction for the Augustinians). Those the bishop appoints to on the provincial's presentation engage his regard, and the bishop's office can end them. House works are a move: the order's school, a parish of the order (held by two keys), the mission, the studium's lectern. A local work ends with a move out of the diocese. All of it is data on the order (`houseOffices`, `apostolates` in `content/religious/orders.json`); the engine is `systems/religious/requests.ts`.

### 3.11 The bishop asks the order

The bishop does not control a friar. He may be fond of him and of his order, or not, and that regard is real (`local_bishop`); but the order is in charge of the man. A bishop who wants a friar for something writes to the provincial, never to the friar: a chancery post (vicar for religious, director of vocations, superintendent of schools) or one of the diocese's own works (the hospital, the seminary's faculty, the diocesan school). The provincial answers for the province: **refused** when the man is in formation work, holds an elected or appointed office, is in a house that needs him, or is a man the council is not sure of; **both** when the week has room for it beside what he does; **spared** when the province can let him go from the work he has. Only when the provincial has not refused does the friar answer, and he answers the provincial, not the bishop. A refusal costs a little of the bishop's regard and earns a little of the council's; declining what the provincial left to him costs the bishop's regard and earns the house's. A work the bishop appointed to is his to end, and a bishop whose regard has soured does. Data in `content/religious/bishopAsks.json`; engine `systems/religious/bishopAsks.ts`, the only road from a bishop's wish to a friar's work.

**The bishop's file.** Each diocese he leaves keeps what its bishop and its people thought of him (`dioceseFile`). Returning under the same bishop restores most of it, less each year away; under a new bishop, a fraction, since the new man has only read the file. The people remember a little either way.

**One save, many dioceses.** Every diocese of the province is generated with the base game's generator, so its people and parishes are prefixed with the diocese (`bos:bishop`, `bos:parish_1`) and tagged with it, and the selectors for the bishop, a brother priest, or a parishioner mean the ones where he is now.

### 3.12 The deanery, and the diocese's pastors

A parish entrusted to the order is a parish of the diocese. Each parish house of the province holds one (`OrderHouse.parishId`): its pastor is the house's prior, the diocese's man having gone elsewhere. A friar posted there takes it as an assignment (pastor when he is the prior, curate otherwise), without the base parish loop, and the week he arrives the deanery forms around it as the base game forms one: the nearest parishes, their pastors, a dean, and the flags the deanery scenes read. The presbyterate's view of him is a constituency of its own, **the diocese's priests** (`diocesan_clergy`), which resets on a move out of the diocese and is remembered in the file; it drifts slowly toward what his people think, since the deanery hears what a parish says.

The diocese's pastors ask for him the way the bishop does: through his superior. A pastor who has heard of the friar writes to the prior (a mission, a month of Sundays, the Saturday confessions, a retreat weekend, Forty Hours, the school's Mass, a clergy-day talk; `content/religious/pastorAsks.json`), the prior says yes when the house can spare the blocks and no when it cannot, and only a yes reaches the friar, for six weeks on the House sheet; silence is a no. What is done lands on the people, the presbyterate, the bishop a little, and the pastor who asked. Engine: `systems/religious/deanery.ts`, `systems/religious/pastorAsks.ts`; scenes in `events/religious/shared_deanery.json`.

### 3.13 The diocese's men: classmates, the seminary, direction given

**Diocesan classmates.** The studium or the union shares its lecture halls with the diocesan seminary of its city, and in the first theology year two or three of its men are rolled by the base game's classmate generator (independent rolls, never a premade man) and sit beside the friar for the theology years. They are ordained the June he is, with trajectories rolled from their own stats, and become priests of that diocese: a pastor takes a real parish of the diocese's world (its old pastor going elsewhere), a chancery man, a bishop elsewhere, or a man who left. Flags (`dcm:pastor`, `dcm:chancery`, `dcm:bishop`, `dcm:left`, `dcm:here`) and selectors (`@diocesan_classmate`, `@closest_diocesan_classmate`) let scenes find them for forty years, and they sit in deaneries and chanceries the friar meets.

**The seminary's men.** A friar teaching at the diocesan seminary meets three or four of its seminarians, generated for that diocese, ordained four years on into its presbyterate (`@diocesan_seminarian`).

**Direction given.** A friar the diocese's priests trust is asked to direct them (the deanery first, then the classmates from the lectures, then the diocese's priests); a friar who teaches is asked by the seminary's men. Three at a time, a block a week each. Every week of it runs through the internal-forum resolver (CLAUDE.md rule 7): only the friar's own interior moves, the directee's regard is his own and not a standing, and a reputation effect throws. Scenes in `events/religious/shared_directing.json` carry `internalForum: true`. Engine: `systems/religious/diocesanClassmates.ts`, `systems/religious/directing.ts`.

### 3.14 Closures, foundations, and crossing over

**From the province.** A shrinking province closes its smallest house under the kind's floor some year; a growing one founds a house in a diocese of its territory that has none. The provincial's own scenes decide it when the player holds the office (the `province` effect, `close_house` / `found_house`); otherwise the year rolls it and the friar reads a letter. A closure sends the men to the other houses, hands a parish the house held back to the diocese under a diocesan priest, removes the house from the diocese's own list, and sets flags for both campaigns' scenes (`house_closed:<diocese>`, `parish_handed_back:<diocese>`). A foundation sends three to five solemnly professed men from the fuller houses, takes a parish when it is a parish house, and adds the house to the diocese's list. Engine: `systems/religious/foundations.ts`.

**From the diocese.** In the diocesan campaign, a collapsing institute withdraws a house some year (its arrangements end; `friars_leaving`), a growing one founds (`friars_arriving`), and a religious of a collapsing house may leave his order and come to a pastor without a curate as parochial vicar (`vicar:former_religious`, `@former_friar`). Engine: `systems/institutesDrift.ts`; scenes in `events/parish/institutes_drift.json`.

**Crossing over (E4's ground).** A scene marks a man with the `crossing` effect (`enter_order` on a diocesan priest or seminarian, `leave_order` on a friar); a year on, he crosses. A diocesan priest who enters becomes a novice of the province at the novitiate, his parish going to another priest of his diocese, and the bishop who lost him remembers it; a friar who leaves becomes a priest of the diocese he lived in. Engine: `systems/religious/crossing.ts`; scenes in `events/religious/shared_crossing.json`.

### 3.15 The habit

Portraits dress a religious in his institute's habit, as data on the institute (`habit` in `content/institutes.json`): the colour, a hood, a scapular, a cord or leather belt, a choir cloak, and for women a veil and coif. Dominicans are white with the capuce and scapular and a black cappa; Augustinians black with the capuce and the leather belt; Franciscans brown with the white cord; Capuchins chestnut with the long capuche; Carmelites brown with the white mantle; Benedictines black; the institutes in clerical black draw as priests. The player friar wears the habit from clothing (the novitiate's year) and may wear the cloak over it, a toggle on the House sheet kept in the save (`religious.cappa`); a friar of a cloaked order wears the cloak in his portrait some of the time.

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

### 6.7 As built: the desk, the brothers' letters, the studium, the circles

*Added at build time.*

- **The desk** (`content/religious/projects.json`, on the base game's side-work engine): one project at a time beside the house's work, in blocks of the week until it lands or does not. Dominican: a research article, a medieval text translated, the licentiate at the studium and then the doctorate (credentials `stl`, `std`), a lecture course at the studium, a children's catechesis the novices give, a year of homilies, a series on the Summa for the radio, the Rosary confraternity's manual, a critical edition, the province's Latin put into English, a summer of parish missions. Augustinian: an edition of the Confessions with notes, a religion curriculum for the order's school. Any friar: a retreat manual, the house's history, the novices' reading, Thursdays at the jail. Projects feed the §8 reputations through the `known` effect, and a friar pastor keeps the parish's works beside them.
- **A brother's letter** (`systems/religious/confrereAsks.ts`, `content/religious/confrereAsks.json`): a friar of the province, usually from another house, writes to the man himself: read his article, cover his lectures, translate his Latin, preach his mission two by two, sit in his box while he is in Rome, proofread the newsletter, take the novices' catechesis class, help with the chapter's report, write the necrology entry, read his thesis chapter, drive the old friar to dialysis. Six weeks to answer; yes takes blocks for the weeks and lands its effects and the brother's regard; no and silence are remembered. The chance rises with community and province standing and with the reputation the ask names.
- **The studium** gains a studies posting (`studium_studies`) on both orders' apostolates, asked of the provincial like any other, beside the teaching one.
- **The circles** (`content/clubs/religious.json`): a friar's circles are the order's, the diocesan tables (the deanery table, the Emmaus group, the liturgical commission, the canonists' lunch) closed to him unless he holds a parish. The province's Thomistic circle, the preaching band, the friars' schola, the Rosary confraternity's chaplains, the Lay Dominican chaplains, the justice and peace commission, the Thursday game, the young friars' table, the delegates' lunch, and the Augustinian reading circle; the fellows are friars of the order.

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

### 9.8 As built (R1.6)

*Added at build time; the sections above are the design.*

- **Sites** (`systems/religious/founding.ts`): every diocese of the province's territory, read from the generated worlds. Need 1–5 from the diocese's visible clergy need, a university with no house of the order, a standing invitation, the bishop's priorities, a parish lately handed back, and a penalty where the order already has two houses. The bishop's warmth comes from the diocese file when the man is known to that bishop and from the diocese's own temper otherwise. Cost by diocese size. The browser sorts by need, state, or city.
- **Two keys.** The province's score is fit of reputations to the work, province standing, humility, seniority, men to spare, and money, with the need as the swing term and an asked foundation a quarter higher; the roll around the pass mark is what makes early petitions fail. The bishop's consent is a hard gate on warmth, and a succession between petition and answer kills it unless the successor is warm. A refusal writes `foundation:refused_week` and `foundation:refused:<diocese>`, and the next try in the same place scores higher.
- **The charter** (`systems/religious/charter.ts`, options in `content/religious/foundations.json`): six dials plus alignment, every consequence a number on the option (vocations multiplier, observance, cohesion rest, income, house reputations a year, the faction it rubs, the men wanted before a daughter house). The order's own rite is gated to the Dominicans by data; the university dials need a university in the diocese. Writing it erects the house through the province's own `foundHouse`, sends three to five men, moves the founder as prior with a term, charges the province, and gives the diocese a new house on its list. Flags `charter:<dial>:<option>` carry it to the scenes.
- **The years** (`systems/religious/foundationYear.ts`): vocations a year from the charter, the works, the place's climate, the house's own name, and the founder's while he is prior; the men are generated by the province's friar generator, tagged `vocation_of:<house>`, formed in the house from eight men or the novitiate before, and take simple and solemn vows on the calendar. Works are data with men, cost, income, and reputations. House reputations feed from the charter, the works, and the founder's own, and fade unfed. Money is the works' income against the men. A shrinking province recalls men; a house at odds with the province's line (`foundation:rubs`) rests lower in cohesion. Failure a year from an empty choir, a hostile bishop, debt, and recall, doubled while the house is young. A successor's reading of the charter is derived from the man (`readingOf`); differing, he revises a dial a year with `foundation:revised`; not differing, `foundation:kept`.
- **Daughter houses.** From the charter's threshold, the prior chooses an heir among the men formed in the house and a site; the daughter inherits the heir's reading, and runs on the same year. Four houses alive in the line make a vicariate.
- **Scenes** (`content/events/religious/shared_foundations.json`, 70) gate on `foundation:*` and `charter:*` flags and touch the house through the `foundation` effect (`budget`, `reputation:<key>`, `vocation`, `revise:<dial>`, `fail`, `invite`).
- **The charter, second round.** Each work of the charter shows the diocese's need for it (0–3 marks) from the generated world: the clergy shortage, a university without a chaplaincy, the poor parishes, a hospital system, the size of the see; the works needed most are named. A work a house of the order already does in that diocese, or a house of studies when the province has one, is greyed with the reason. Two more works can be written at a half and a quarter of the first's weight (`secondaryWork`, `tertiaryWork`), distinct from it, the third wanting a second. New dials: formation (none, novices, students), hospitality (closed, a guest wing, retreatants), governance (the prior decides, the chapter decides: a voted charter stays a successor's hand), dress (the habit everywhere, in the house, clerics), language (English, bilingual, Spanish first, the last two wanting Spanish-speaking parishes). New options on the old dials: the mitigated and the primitive observance, a sung Mass with a choir, chaplaincies and media as works, a faculty of the house's own, mendicant poverty, a middling size. Charters written before these dials read their later dials as the first option.
- Every tunable in `FOUNDING`, `CHARTER_RULES`, and `FOUNDATION_YEAR` is invented and flagged for tuning.

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

type ReputationKey =
  | 'confessor' | 'preacher' | 'professor' | 'spiritual_director'
  | 'evangelist' | 'liturgist' | 'man_of_prayer' | 'builder'
  | 'advocate' | 'pastor_of_dying' | 'confidant';

interface Foundation {
  id: string;
  houseId: string;
  founderId: string;
  parentHouseId?: string;              // set for daughter houses
  dioceseId: string;
  foundedWeek: number;
  charter: {
    observance: number;                // 0 relaxed .. 100 strict
    liturgy: string;                   // per-order enum, incl. OP proper rite
    primaryWork: string;
    universityRelation: 'none' | 'adjacent' | 'embedded';
    alignment: number;                 // -100 trad .. +100 prog
    poverty: number;
    sizeTarget: number;
  };
  charterRevisions: { week: number; byId: string; changes: string[] }[];
  vocationsAttracted: number;
  status: 'proposed' | 'approved' | 'active' | 'struggling' | 'suppressed';
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
  observance: number;                  // personal, vs the house's
  reputations: Record<ReputationKey, number>;   // 0–100, portable, see §8
  identities: string[];                // derived from reputation mixes
  foundedHouseIds: string[];
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
| Reputations and identity mixes | 45 |
| Foundations: petition, charter, growth, daughter houses, failure | 70 |
| **Total** | **~440** |

---

## 15. Roadmap — round 1

**R1.0 — Engine generalization.** The five prerequisites in §13. No new content. *Done when the base game still plays identically and a province can be instantiated in a test.*

**R1.1 — Shared religious systems.** House generation, the horarium, cohesion and observance, poverty permissions, obedience and consultation, reassignment across dioceses, dual authority. *Done when a friar can be moved through three houses in three dioceses and each feels different.*

**R1.2 — The chapter engine.** Electorate construction, elector scoring, ballot simulation with majority rules and narrowing, confirmation, the ambition inversion, the ballot-by-ballot scene. **Test this more heavily than anything else in the expansion.** *Done when a provincial election run from the same seed produces the same ballots, and different seeds produce plausible, varied outcomes including upsets.*

**R1.3 — Dominicans.** Order definition, province data, creation additions, seven-year formation, study dispensation, preaching reputation, Veritas amplification, offices, content. *Built first because Dominican democracy stress-tests the chapter engine hardest.* *Done when a Dominican career runs from novitiate through an elected priorship.*

**R1.4 — Augustinians.** Order definition, province data, cohesion-modulated Piety, friendship slots, the restless-heart curve, annual vow renewals, education and mission tracks, content. *Done when the build test in §10 passes: the same character in both orders feels like two games by year ten.*

**R1.5 — Reputations.** The eleven reputation tracks, accrual and decay, identity mixes, the legibility term in elector scoring, and NPC behavior driven by reputation. *Done when two friars with identical stats but different reputations receive visibly different assignments and election results.* **Built.**

**R1.6 — Foundations.** Location browser with need scoring, the two-key approval model, the charter, vocations, house development, daughter houses, charter revision by successors, and failure. **This is the payoff phase and the reason to build the rest.** *Done when a player can found a house at forty, grow it, send out a daughter house, lose the superiorship, and return at seventy to find it changed.* **Built; see §9.8.**

**R1.7 — Integration.** E1 hooks, migration of base-game religious NPCs onto the new model, provincial-level content, the rare general-curia events.

**Round 1 is done when** a player can choose either order and a province, pass through novitiate and vows to ordination, serve in several dioceses under obedience, build a reputation the province can name in one phrase, live through chapters he can watch ballot by ballot, be elected to office, serve a term, return to the ranks, and — if he earns it — found a house that outlives him.

**If the schedule slips, cut elsewhere and keep R1.6.** The foundation layer is what makes this expansion worth building.

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

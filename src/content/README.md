# Content authoring guide

Everything in this directory is data. Types live in `src/types/events.ts`
(events) and `src/types/character.ts` (creation). A test validates every file;
run `npm test` after editing.

## Register

The register of a good novel about institutional life. Serious, specific,
unsentimental, never satirical and never pious. Catholic vocabulary,
titles, formation stages, and liturgical detail must be accurate. If unsure
of a detail, choose a vaguer true sentence over a specific false one.

Numbers are never shown to the player during seminary. Every choice must
have an `outcome` paragraph describing the consequence in prose.

## Events

```json
{
  "id": "y2_professor_lunch",          // unique, prefixed by year or pool
  "phase": "seminary",
  "yearGate": [2, 3],                  // seminary years it may fire in
  "pressure": ["belief_vs_safety"],    // see Pressure in types/events.ts
  "severity": "NOTABLE",               // ROUTINE | NOTABLE | MAJOR | CRITICAL
  "category": "formation",             // see EventCategory
  "baseWeight": 10,
  "requires": [ ...conditions ],       // optional hard gate
  "bias": [ { "when": condition, "multiplier": 2 } ],  // character-weighted draw
  "suppressYears": 3,
  "once": true,
  "beat": "candidacy",                 // optional structural beat
  "title": "...",
  "body": "120–220 words. May use {tokens}.",
  "flavorPrompt": "one line of guidance for the skinning layer",
  "choices": [ ... ]
}
```

Severity drives interrupts: ROUTINE events may be auto-resolved by the clock
using the `default` choice (or the first available one), so every ROUTINE
event needs a sensible default. MAJOR and CRITICAL always reach the player.

### Choices

```json
{
  "id": "speak",
  "label": "Say what you think, in front of the class",
  "outcome": "Prose consequence. May use {tokens}.",
  "requires": [ ...conditions ],   // greyed out when unmet
  "hidden": true,                  // removed entirely when unmet
  "default": true,                 // the auto-resolve choice
  "volume": "semi_public",         // records a position with the two fields below
  "positionTopic": "tlm",
  "positionValue": -60,            // -100 traditional .. +100 progressive
  "effects": [ ...effects ],
  "opensThread": "y2_remark",      // chains
  "resolvesThread": "y2_remark",
  "followUpId": "y2_professor_lunch_after"  // fires immediately after
}
```

Two to four choices. Real trade-offs: no choice should be strictly best.
Include at least one gated choice where it makes sense (the informed option
for high Knowledge, the aligned option for a strong alignment, a choice that
needs a relationship). Roughly one event in three should carry a position
with a volume.

### Effects

`{ "target": "...", "key": "...", "delta": n, "value": ... }`

| target | key | notes |
|---|---|---|
| `stat` | administration, charisma, theology, knowledge, piety | delta ±1..±4 typical |
| `pillar` | human, spiritual, intellectual, pastoral | delta ±1..±4; the annual emphasis gives up to 20 |
| `reputation` | chancery, brother_priests, parishioners, traditional_bloc, progressive_bloc, public, rome | delta |
| `relationship` | an NPC selector (below) | delta ±3..±20 |
| `flag` | any key; `value` true/false or `delta` to count | see flag conventions |
| `alignment` | (ignored) | delta; negative is traditional |
| `outspokenness` | (ignored) | delta |
| `honesty` | (ignored) | delta, for saying the hard true thing at cost |
| `credential` | e.g. `latin`, `spanish`, `STB` | adds |
| `trait` | short text | adds |
| `archetype` | pastoral, teaching, theological, administrative, missionary | delta to leaning |
| `concern` | text recorded on the formation record | permanent |
| `risk` | risk id; `value` label; `delta` severity 1–3 | latent scandal risk |
| `npc` | selector; `value` active/left/dead/dismissed | changes an NPC's status |
| `end` | left_seminary / dismissed; `value` closing summary | ends the run |

### Conditions

See `Condition` in `src/types/events.ts`. Common forms:

```json
{ "type": "stat", "key": "theology", "op": ">=", "value": 55 }
{ "type": "flag", "key": "motive:grief", "value": true }
{ "type": "relationship", "npcId": "@rector", "op": ">=", "value": 20 }
{ "type": "alignment", "op": "<=", "value": -30 }
{ "type": "pillar", "key": "spiritual", "op": "<=", "value": 2 }
{ "type": "thread", "key": "y2_remark", "open": true }
{ "type": "any", "inner": [ ... ] }   { "type": "not", "inner": ... }
```

### Selectors and tokens

Generated NPCs are referenced by selector, in conditions, effects, and text:

| selector | who |
|---|---|
| `@rector` | the seminary rector |
| `@spiritual_director` | the player's spiritual director |
| `@formation_advisor` | the priest who writes his annual evaluation |
| `@vocation_director` | the diocesan vocations director |
| `@professor_trad` / `@professor_prog` | two faculty the player can gravitate toward |
| `@bishop` | the diocesan bishop |
| `@mother` / `@father` / `@sibling` | family (may not exist; the event is skipped if a selector cannot resolve) |
| `@mentor_priest` | the priest who marked him (only some backgrounds) |
| `@home_pastor` | pastor of his home parish (only sons of the diocese) |
| `@closest_classmate` / `@rival_classmate` | highest / lowest relationship |
| `@random_classmate` | rolled once when the event fires |

In text: `{@rector}` gives "Msgr. Kearney", `{@closest_classmate}` gives
"Paul", `{@rector.full}` the full name, `{first_name}`, `{surname}`, `{name}`.

### Flag conventions

Set at character creation (all booleans):
`origin:<urban_ethnic|latino_immigrant|rural|suburban|convert|lapsed>`,
`tie:<son|school|seminary|transfer>`,
`path:<high_school|some_college|college|masters_1|masters_2|doctoral>`,
`field:<business|philosophy|history_law|stem|classics>`,
`career:<attorney|accountant|management|teacher|professor|physician|military|trades|journalism|social_work>`,
`motive:<certainty|conversion|priest|intellectual|grief|running>`,
`family:<supportive|opposed|widowed_mother|large|estranged|dependent>`,
`past:<relationship|drinking|debt|activism|breakdown|fathered_child>`,
`late_vocation` (entered at 30 or older), `degree`, `speaks_spanish`.

Events may set their own flags; prefix them with the event's year or pool
(`y3_`, `sem_`) and document any flag another file relies on in a comment
field named `_notes` at the top of the file.

### Sensitive material (DESIGN.md §11)

Abuse, scandal, celibacy, doubt, burnout, and drink are in scope and must be
written with care. The player is never a perpetrator of abuse. Leaving the
seminary is always available during a doubt event and always written with
respect: an `end` effect with a closing summary in `value`.

### The jobs sheet reads offers before they arrive

`systems/doors.ts` shows the player every offer of his phase he qualifies
for ("may come your way") and, for the rest, the first unmet requirement
in words. Write `requires` with the gating condition first, so the sheet
names the real obstacle. Flags are only explained when `FLAG_WORD` in
`doors.ts` knows them; add a phrase there for any new gating flag.

## Study away (`content/study/`, `events/study/`)

An offer whose commitment carries `away: <program id>` (programs in
`study/programs.json`: `rome_stl`, `cua_jcl`) does not run in the background:
the man leaves his parish, the phase becomes `study`, and he lives where he
studies until the weeks are up. Each week he points his free hours at the
activities in `study/activities.json` (studies and work on the side: the
hospital, Sunday supply, confessions, the college office, the Holy See or
the tribunal, pilgrims, the table); each has stats, reputation, an optional
`requires` (the sheet says what is missing), `onFirst` effects (flags and
traits only) and `credentialAfter`. Events for the phase live in
`events/study/away.json` with phase `"study"`, gated by the flags
`study:rome` / `study:washington`; tokens `{school}`, `{city}`, `{residence}`.
When the years end the commitment's `onComplete` (or the offer's `failure`)
applies and the board finds him a post at home.

### Jobs alongside the parish

A commitment's `weekly` effects apply every week it is held, so a job is
never inert: the vocations office builds chancery standing and the bishop's
regard, the spokesman's desk builds the town's, a chaplaincy builds piety
and the people's. Every parish commitment that keeps the parish carries one
(the validator does not require it, the test suite does). The bishop's
secretary is not a commitment but a posting (`away: bishops_secretary`,
program kind `post`): he moves into the residence and its own activities.

### The week in hours

The engine counts action points; the sheets multiply by `HOURS_PER_AP` (4)
and speak in hours. A parish week is 12 blocks, about 48 hours after the
daily Mass, the Office, meals and sleep. Content that sets `ap` or
`apPerWeek` speaks in blocks.

### Flags the seminary writes for the career

`events/seminary/career.json` writes flags the engine reads at ordination
and after: `noticed_by_bishop`, `bishop_wary`, `rector_recommends`,
`rector_doubts`, `seminary_leader` (formation standing, `systems/standing.ts`),
`known_pastoral` / `known_scholar` / `known_administrator` (the first
assignment matches them to a posting, `systems/assignment.ts`), and
`chancery_favor_owed` (for content). Any seminary event may write them; keep
them rare and earned.

### The diocese as a place

Each preset carries a `voice` (weather, Sunday, the presbyterate) shown on
the parish sheet, and `parish/ambient.json` has a pool per preset id that
the digest draws from twice as often as the general pool. No diocese rolls
a shortage below 3 (`stretched`): there is always a shortage.

### The player's dials

`state.settings` holds the work-week length (`light` 10, `standard` 12,
`long` 14, `punishing` 16 blocks; the seminary and study weeks shift by
−1/0/+1/+2 free hours) and the wear multiplier (0..2). Strain lives on the
game state and accrues in every phase from blocks past a standard week and
from sacrifices, at the wear rate.

## Offers (DESIGN.md §7.5)

Files under `src/content/offers/*.json`: `{ "_notes": "...", "offers": [ ... ] }`.
Types in `src/types/offers.ts`. Offers are evaluated against state every
week; an eligible offer arrives with roughly `weight` chances in 1,000 per
week, opens a window, and lapses as a decline.

```json
{
  "id": "sem_latin_tutor",
  "category": "seminary",              // academic | chancery | patronage | social | seminary
  "phase": ["seminary"],
  "yearGate": [2, 3],
  "title": "...",
  "body": "60–140 words: the offer as it is made, by whom, and what it would cost. {tokens} allowed.",
  "from": "@professor_trad",           // who offers; declining costs this relationship
  "requires": [ ...conditions ],       // hard gates: this is how a build earns the offer
  "weight": 40,                        // 1..200
  "bias": [ { "when": condition, "multiplier": 2 } ],
  "windowWeeks": 3,                    // 0 = decide now
  "once": true,
  "cluster": "academic",               // accepting raises siblings' weight
  "accept": {
    "effects": [ ...effects ],
    "outcome": "prose",
    "commitment": {                    // optional background commitment
      "label": "Tutoring Latin",
      "weeks": 30,
      "apPerWeek": 1,
      "onComplete": [ ...effects ],
      "completeOutcome": "prose"
    }
  },
  "decline": { "effects": [ ...effects ], "outcome": "prose" },
  "failure": {                         // optional: risk if accepted underqualified
    "chance": 0.5,
    "unless": [ ...conditions ],       // qualified players never fail
    "effects": [ ...effects ],
    "outcome": "prose"
  }
}
```

Rules from DESIGN.md §7.5: offers must be legible in hindsight (the
`requires` should name the thing the player did); roughly half should be
visibly bad fits; anything that takes the player away from formation or
parish life must cost something; declining always has a consequence
(`decline.effects` or `from`). Offers may not end the run.

## Parish events (DESIGN.md §8, §12)

Files under `src/content/events/parish/*.json`, same schema as seminary
events with `"phase": "parochial_vicar"` or `"pastor"` and **no `yearGate`**.
Gate on the career instead:

```json
{ "type": "years_ordained", "op": "<=", "value": 2 }
{ "type": "weeks_served", "op": "<=", "value": 8 }      // weeks into the current assignment
{ "type": "arc_weeks_left", "op": "<=", "value": 12 }   // weeks until the arc ends
{ "type": "role", "value": "parochial_vicar" }
{ "type": "parish", "key": "kind", "value": "immigrant_growing" }      // flagship_suburban | struggling_urban | immigrant_growing | rural | difficult
{ "type": "parish", "key": "terrain", "value": "urban" }               // urban | latino | rural | suburban
{ "type": "parish", "key": "school", "value": "at_risk" }              // open | at_risk | closing | none
{ "type": "parish", "key": "needsSpanish", "value": true }
{ "type": "parish", "key": "problem", "value": "roof" }                // see PROBLEM_LABEL in src/generation/parishes.ts
{ "type": "parish", "key": "generational", "value": "aging" }          // aging | mixed | young
{ "type": "parish", "key": "wealth", "value": 1 }                      // 1..5
{ "type": "season", "value": "holy_week" }
{ "type": "bishop_alignment", "op": "<=", "value": -20 }              // the current bishop's own alignment
```

Additional selectors in parish life:

| selector | who |
|---|---|
| `@pastor` | the pastor of the current parish (a major NPC: mentor, obstacle, or disaster) |
| `@secretary` / `@dre` / `@music_director` / `@maintenance` | parish staff, each with an alignment and an agenda |
| `@parishioner` | a random named parishioner, rolled when the event fires |
| `@brother_priest` | a random active priest of the diocese, never the pastor |
| `@bishop` | the diocesan bishop |
| `@vicar_general` / `@chancellor` / `@vicar_for_clergy` / `@vocation_director` | chancery officials |
| classmates and family | as before; classmates are now priests across the diocese |

Extra effects: `{ "target": "money", "key": "cash", "delta": -5000 }` moves parish
cash; `{ "target": "ap", "key": "next_week", "delta": -2 }` costs or grants AP
next week. Flags set by the parish loop: `role:parochial_vicar`,
`parish:kind:<kind>`, `parish:needs_spanish`, `home_terrain:<terrain>`
(from creation), `speaks_spanish`, `ordained`, `pref_*` (from Y7),
`affiliation:*` and `patron:*` (from offers), `late_vocation`.
Tokens: `{parish}` (the parish's name), `{diocese}`.

### Care and fires

The engine keeps a rolling 0..1 `care` score on the parish from the planned
week: visits, extra confessions, the groups, and an invested homily. Care
lifts attendance, attendance lifts collections, and at high care events in
the `finance`, `admin`, and `group` categories draw less often (up to 40%).
Authors need not gate on it; it is the reward for a tended parish.

### Levers on a parish

- `parish/problems.json`: one fix per live problem (weeks, hours a week,
  cost, outcome, effects). A vicar begins only with the pastor's leave. On
  completion the parish's `problem` becomes `none` and `fixed:<problem>` is
  flagged; content may read either.
- `parish/sacrifices.json`: what a man can cut from his own week for an
  hour (sleep, the day off, exercise, reading), each with a weekly cost and
  a strain. Strain (0..100) is readable by content as `{ "type": "strain",
  "op": ">=", "value": 50 }`; at 50 he is worn, at 80 the body takes an
  hour back.
- Effects `transfer` (key: parish kind; value: role, default the current
  one) move the man the next week: an offer that promises a parish must
  carry it. `building` (key: church | rectory | hall | school, delta)
  changes a building's condition.
- The church's `music` slot (organ, contemporary, chant, bilingual) is a
  decor slot like the others; its alignment drives reactions.

## Group events (DESIGN.md §10)

Files under `src/content/events/parish/groups*.json`. Same schema, phase
`parochial_vicar` (or `pastor`). An event about a specific group carries a
top-level `group` condition and refers to the group's leader as
`{@group_leader}`; when it fires, the engine binds `@group_leader` to a
random group of the parish that matches every `group` condition, and group
effects land on that group.

```json
{ "type": "group", "key": "type", "value": "youth" }            // see GroupType in src/types/groups.ts
{ "type": "group", "key": "vitality", "value": "dying" }        // thriving | steady | declining | dying
{ "type": "group", "key": "agenda", "value": "empire" }         // saintly | empire | political | tired | new | grieving
{ "type": "group", "key": "hostile", "value": true }
{ "type": "group", "key": "foundedByPlayer", "value": true }
{ "target": "group", "key": "vitality", "delta": -15 }
{ "target": "group", "key": "size", "delta": 4 }
{ "target": "group", "key": "hostile", "value": true }
{ "target": "group", "key": "dissolve" }
{ "target": "relationship", "key": "@group_leader", "delta": -10 }
```

Sustaining hours (the `groups` action) go to the groups the player has
singled out (`focus`) and are spread across all supported groups otherwise;
the sheet shows each group's expected weekly trend. Mean group vitality
feeds attendance.

Group types: young_adult, youth, pro_life, svdp (St. Vincent de Paul),
knights (Knights of Columbus), womens_guild, bible_study, adoration, choir,
rcia, marriage_prep, school_parents, ethnic_community, tlm_society,
social_justice, mens_group, grief_support, recovery.

## Summers (`seminary/summers.json`)

A summer sets a `summer:<id>` flag, moves pillars, stats, and reputation,
and goes in the career file. The first assignment reads the flags
(`systems/assignment.ts`: the hard-parish summer points at the difficult
parish, the chancery summer buys trust, Rome suits the flagship, the
mission suits a Spanish parish), and offers bias on them. The formation
record as a whole is read as *standing* (`systems/standing.ts`): the top of
the class is sent where he will be seen, a thin record somewhere quiet.

## Furnishings (`parish/decor.json`)

Every place a man can change (the church, his office, the rectory, his
seminary room, a chancery office) has slots, and each slot holds one
option. The renderer reads `art` to pick a layer; drop a PNG at
`src/art/<scene>/<layer>/<variant>.png` to replace the drawn one.

```json
{ "id": "rail_wood", "place": "church", "slot": "altar_rail", "label": "A wooden altar rail",
  "blurb": "...", "cost": 9000, "alignment": -45, "policy": "altar_rail", "art": "wood",
  "requires": [ ... ], "effects": [ ... ] }
```

- `cost` is parish cash for the church, nothing for personal rooms.
- `alignment` sizes the parish's reaction (−100 traditional .. +100
  progressive); `null` provokes none.
- `policy` names what the bishop governs: `ad_orientem`, `latin_mass`,
  `altar_rail`, `tabernacle`, `renovation`. Each bishop rolls a stance
  per topic (free, by permission, forbidden). By permission means a
  letter to the chancery and an answer some weeks later; the grant is
  recorded as the flag `permission:<topic>`, so events can read it.
- Church slots: sanctuary, altar_rail, orientation, confessionals, choir,
  statues, tabernacle, mass_form. Personal slots: wall, desk, corner.

Events can read and write furnishings, and read the bishop's temper:

```json
{ "type": "decor", "place": "church", "slot": "orientation", "value": "orient_orientem" }
{ "type": "bishop", "key": "management", "value": "micromanager" }   // delegator | micromanager | absentee | reformer
{ "type": "bishop", "key": "priority", "value": "liturgy" }          // one of his two priorities
{ "type": "bishop", "key": "cannotTolerate", "value": "freelancing" }
{ "type": "bishop", "key": "stance", "topic": "ad_orientem", "value": "forbidden" }
{ "target": "decor", "key": "church:orientation", "value": "orient_populum" }   // set outright: no cost, no computed reaction
{ "target": "permission", "key": "latin_mass", "value": "denied" }              // the bishop's word, given or taken back
```

Three more conditions and one effect close the last design gaps:

```json
{ "type": "position", "topic": "liturgy", "op": "<=", "value": -30 }   // a semi-public or public position on record (topic "any" for any); DESIGN §5.4
{ "type": "routine", "key": "study", "op": ">=", "value": 3 }          // hours a week on an action id, or an obligation key read as AP; DESIGN §2.3
{ "type": "figure" }                                                    // DESIGN §5.6
{ "target": "trait_known", "key": "@pastor" }                           // the player has seen the person's hidden trait; DESIGN §9.2
```

Flags the engine sets for content to read: `ordained_late` (32 or older), `ordained_young` (under 30), `passed_over`, `term_renewed`, `left_a_collapse` (a charismatic man's parish thins after he goes), `pref_*` (what he asked the chancery for; set at ordination and changeable on the parish sheet).

## The bishop's requests (`events/parish/bishop.json`)

The bishop leans on his pastors through requests: a letter, a word after
the deanery meeting, a diocesan grant with a purpose attached. Demands are
rare and belong to a particular temper (a micromanager, a reformer, a man
who cannot bear freelancing), carry a low `baseWeight`, and say plainly
that they are not requests. Every request must leave the pastor a way to
decline that costs something real and nothing that ends the run.

## Family (`events/parish/family.json`)

Family drama follows the family chosen at creation, through the flags
`family:<id>` and the family selectors (`@mother`, `@father`, `@sibling`
resolve only while that person is living). Keep these quiet: a
`baseWeight` of 4 or less and `suppressYears` of 4 or more, deaths and
the big turns `once`, so a career meets a handful and not a season of
them. The estranged man gets fewer, because he would.

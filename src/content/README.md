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

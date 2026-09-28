# Expansion E4 — The bishop's chair

*Written at build time from the owner's ask ("deepen the play of being a bishop: edicts, visits, directions to people, influence on seminaries") and an audit of the episcopal tier as V1.5 and E1 left it. Canonical details are close to current practice and flagged for verification (CLAUDE.md rule 12). The owner chose to build the foundation first (§3.1 and §3.2), then the rest in order.*

## 1. What was there

The see (V1.5, `engine/see.ts`, `content/sees.json`) is a small diocese from a pool of fourteen, or one of the game's own ten on a translation, held as a posting (`content/study/programs.json` `diocesan_bishop`): five dials the bishop's hours move (the priests, the people, Rome, the money, the shortage), six activities, sixteen scenes in `content/events/study/see.json`, a yearly letter, and the letter at seventy-five. The see had no people of its own: `state.world` stayed the home diocese, and the selectors that the see's scenes use for "one of his own priests" and his chancery resolved against the men at home. There were no acts a bishop takes on his own initiative, no seminary as a thing, and no visits as a mechanic. The pope's desk (E1 §10) is the game's one model of acts.

## 2. The design, in six systems

1. **The see as a place with people** (R1.0, built). The see's world is rolled by the diocese synthesizer from its city and region, or is its preset for a great see; the man is its bishop of record; home waits in the territory as a friar's other dioceses do; the selectors find his own priests and chancery.
2. **The desk: acts as data** (R1.1). A bishop's-desk sheet like the pope's, acts defined in JSON with hour costs, requirements, and effects. Pastoral letters on the axes Rome writes on: when a document arrives, the cascade asks the bishop his norm, and his reading becomes the diocese's norm his priests live under. Decrees: a merger or closing chosen by parish; the diocesan policies the base game reads (the older Mass and its faculties, ad orientem, the rail, the tabernacle, renovation); a synod; a capital appeal; a safeguarding review.
3. **Directions to people** (R1.2). Call a priest in from the list and give him a direction: a move, a rebuke, treatment, a sabbatical, study in Rome, a deanery, retirement, a monsignor petition. His answer depends on his rolled state and his regard, and the presbyterate hears. The inverse of the letters the man received as a priest, on the obedience-letter machinery.
4. **Visits** (R1.3). The canonical visitation of every parish on a cycle (can. 396, to verify): choose where, meet the pastor, find what the file did not say, and move the people and the presbyterate parish by parish. The ad limina and the seminary visit as scheduled visits.
5. **The seminary** (R1.4). Choose where his men are formed, set the formation emphasis, decide admissions man by man, delay or advance a candidate, send one to Rome, name the rector and the vocations director. Ordained men join his presbyterate carrying the marks of his choices.
6. **The presbyterate as people** (R1.5). Deaths, retirements, the council of priests and the college of consultors (to verify), a wing that writes to the nuncio, and morale aggregated from individuals rather than a dial.

**Decisions the owner holds.** Whether the same acts should exist for AI bishops, so a priest lives under a bishop's pastoral letters and directions (recommended: yes, later; the data is shared). Whether a great see reuses its preset world (built: yes). The friar-bishop gets all of it, since the see is generic.

## 3. As built

### 3.1 R1.0 The see as a place with people

`engine/seeWorld.ts`. When the man is named (`beginStudy`, kind `see`) or translated, `installSeeWorld` rolls the see: a great see through `generateDiocese` on its preset, a small one through `synthDiocese` on a `SynthSee` built from the see's new `synth` block in `content/sees.json` (its state, macro-region, approximate coordinates, size, Latino share, growth, climate: flagged as rough). The people and parishes are namespaced and tagged with the see (`namespaceDiocese`, E3 §3.1), so no id collides with home's and `inDiocese` tells them apart; the home diocese's own priests, laity, chancery, and bishop, untagged until now, are tagged as home's the first time (the nuncio, the Curia, and the College carry no diocese and keep none). The predecessor becomes bishop emeritus, retired, in the see; the man is the bishop of record: `hidden.bishop` is his own profile (`playerBishopProfile`: his alignment and outspokenness, a liturgical policy rolled around his reading with `rollLiturgicalPolicy`, and the rest of a bishop's temper drawn once), `visible.bishop` his name. `state.world` is the see; the world he left goes into `territory` under its preset id; `homeDioceseId` remembers where he was ordained; `SeeState.dioceseId` names the see's world. Idempotent, and a save from before the see had a world gets one from the seed on its next week (`studyWeekHook`).

**Home from afar.** `homeSuccession` (E1 §9 E) now runs the home diocese's year on its copy in the territory and puts it back, so the home see changes hands as news from home while the see stays his; the successor is namespaced and tagged as home's.

**The sheet.** The see's sheet lists the chancery by office and the bishop emeritus, and counts the parishes and priests of the world; the map tab is open to a bishop.

**Tests** (`tests/systems/seeWorld.test.ts`): a small see rolled as a world with the man in the chair and home in the territory; the selectors finding the see's priests and chancery and home's men tagged; a great see as its preset with the real map; the home see changing hands in the territory and never as his beat; a translation stashing the first see; idempotence, a save, and an old save migrated on its next week.

**Not yet.** The five dials still drive the year (`seeYear`); the see's world is a cast and a map, and its shortage, money, and tension are not yet the dials. R1.1 reads and writes them.

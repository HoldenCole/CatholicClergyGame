# Expansion E1 — Rome, the Curia, and the Bishop

*Draft specification, written at build time from `DESIGN.md` §16 (E1), §14 (post-V1: chancery tier, auxiliary and diocesan bishop, cardinal, papal conclave), §5.1 (the dormant `rome` constituency), §9.3 (succession), and an audit of what is already built. Decisions marked **Open** are the owner's. Canonical details are close to current practice and flagged for verification (CLAUDE.md rule 12).*

---

## 1. Vision

The diocesan game is about a man and his bishop. E1 adds the level above the bishop, and the level above that.

**Rome speaks, the bishop interprets, and the priest is the last interpreter standing in front of actual people.** A document leaves the Vatican in Latin and Italian; the bishop reads it through his own temper and writes a norm; the pastor has to say it on Sunday to families who will stop coming, or start. What he said stays on the public record (§5.4). A new pope may undo it, and the man who spent two years implementing something painful, and lost families over it, finds out what that cost was for.

Above the diocese sit three things a man can meet and, if he is very good or very unlucky, join: **the nuncio**, who decides who becomes a bishop; **the Curia**, where priests from every country work in offices across the river; and **the College of Cardinals**, which elects the next pope.

---

## 2. What is already built (audit)

| Area | State |
|---|---|
| Study in Rome | Built. `rome_stl` at the Gregorian, the friars' `rome_order`, the `curia` activity, 12 Rome scenes (`study/away.json`). |
| Bishop tier | Built. Terna flag from one scene, the nuncio's three offers (auxiliary, see, translation), a see with five dials and a bishop's week (`engine/see.ts`, `content/sees.json`), 16 see scenes, retirement at 75. |
| Chancery tier | Partial. Vicar general is a full posting (14 scenes); tribunal, worship, vocations, MC, dean as part-time offices; chancellor, vicar for clergy, judicial vicar are NPCs only. The `chancery` phase is never entered. |
| `rome` standing | Written by ~130 content references; read in code only by `generateSee()` and the episcopal gates. Not in promotion trust. Dormant, as §5.1 says. |
| The papacy | Absent. `succession.ts` keeps a `romeTemperament` number that drifts and silently re-rolls (7% a year); it biases the next diocesan bishop. No pope, no documents, no conclave, no interregnum, no nuncio as an actor, no cardinals. |
| Real history | The older Mass follows the real dates (Summorum Pontificum 2007, Traditionis Custodes 16 July 2021) in `systems/decor.ts`. The game starts in any year from 1950 to 2040 (default 2010). |

**Fixed with this draft:** an auxiliary whose years end came home to the board and could be made a vicar (now the flagship's pastor); the see and translation letters offered "not now" (now yes or no, `OfferDef.final`); a translation left the first see's letter open; the translation's cluster did not match. **Still open:** the home diocese stops changing while the man holds a see elsewhere.

---

## 3. The papacy

### 3.1 The Pope as a person

A `Papacy` record: name (a regnal name), birth year, election week, nationality, a **temperament** on the axes Rome already implies (liturgy, doctrine, governance, pastoral emphasis, decentralization), a health clock, and a style (writes much or little; speaks off the cuff or not). Two to four papacies in a career.

The see falls vacant by **death** (an age-weighted yearly chance) or **resignation** (rare, raised by age and ill health; can. 332 §2).

**Open (A): real history or rolled popes.** See §9.

### 3.2 Sede vacante and the conclave

- **The interregnum is a state.** From vacancy to election, the Curia's prefects lose their offices (the Camerlengo and the Major Penitentiary continue), **no bishops are named**, and documents stop. Diocesan bishops keep governing: parish appointments continue. *DESIGN §16 says "all appointments freeze"; canonically only papal acts do. This draft follows the canon and flags it.*
- **The conclave** begins 15–20 days after the vacancy. Cardinal electors (under 80 on the day the see fell vacant) vote until one man has two thirds. The ballots run on the same machinery as the chapter engine (`systems/ballot.ts`), seeded, deterministic, table-tested (CLAUDE.md rule 10).
- **Who is elected** is drawn from the College's temper, which is the sum of the popes who made its cardinals, pulled a little toward whatever the last papacy was not.
- The player hears it: the bells, the white smoke, the name, the balcony; and a scene for what it means in his parish on Sunday.

### 3.3 Rome's temperament

`romeTemperament` becomes the current pope's temperament plus the Curia's slower drift. It already biases diocesan successions; it now also biases the documents, the nuncio, and who is made bishop.

---

## 4. Documents and the implementation cascade

### 4.1 Documents as content

A document is data: kind (encyclical, apostolic exhortation, apostolic constitution, motu proprio, dicastery instruction or declaration, responsum ad dubium, an off-the-cuff remark), a generated Latin incipit, a topic, and **policy effects** on named axes that existing systems already read (the older Mass, communion practice, the translation of the Missal, parish mergers, safeguarding norms, marriage cases, synodality consultations, the permanent diaconate, preaching). Documents arrive by a yearly draw weighted by the pope's temperament and style. ~30 documents in round 1.

### 4.2 The cascade

1. **Rome issues.** A letter and a line in the Record; the calendar strip names it.
2. **The bishop interprets.** His temperament (already rolled) maps each document to a diocesan norm: *enthusiastic*, *faithful*, *minimal*, or *slow-walked*. The norm changes the diocese's policies (for example what `decor.ts` allows).
3. **The priest implements.** A scene in his parish, from the document's topic and the bishop's norm: what he says from the pulpit, what he changes, whom he consults. Choices write positions at a volume (§5.2), move the constituencies, and are kept on the public record.
4. **The world answers.** Families leave or come; the traditional and progressive blocs move; the bishop and the nuncio notice; `rome` moves for fidelity and against defiance.

### 4.3 Reversal

A later document can reverse a policy axis. When it does, every man who implemented the earlier norm gets a **reversal scene** that reads his record back to him: what he said, what it cost, who left. It should be able to fire twice in a long career (§5.3's logic, one level up).

### 4.4 Rome standing, awake

`rome` enters promotion trust for chancery and episcopal openings, the nuncio's list, and Curia offers. It is built by a Roman degree, curial work, fidelity in the cascade, and being known to a cardinal; it is lost by public defiance and by a record Rome reads badly.

---

## 5. The nuncio

The apostolic nuncio is an NPC and a power centre separate from the bishop: rolled, with his own temperament, rotating every few years.

- **He runs the terna.** When a see in the player's region falls vacant (death, the letter at 75, a transfer), the nuncio consults priests confidentially (the existing questionnaire scene becomes one of several), assembles three names, and sends them to Rome. A man can be **consulted about others** (a scene that tests honesty against friendship) before he is ever **on a list**.
- **He decides the episcopal offers**, which already exist; this draft makes them his, gated on his view of the man, `rome`, the public record, and the region's need, instead of fixed thresholds.
- He appears at installations, ordinations, and ad limina visits, and remembers.

---

## 6. The Curia

A **posting in Rome after the degree**: a priest lent by his bishop to a dicastery as an official, living in a priests' residence, working in an office by day and saying Mass in a Roman parish on Sunday. It reuses the posting machinery (`StudyState`, a city, a week of activities, dials, a book of what the years counted), like the auxiliary and the see.

- **Offices** (Praedicate Evangelium, 2022): the dicasteries for the Doctrine of the Faith, Bishops, Clergy, Divine Worship, Evangelization, Laity and Family, Legislative Texts; the Apostolic Signatura and the Rota; the Secretariat of State and its diplomatic service. **Open (C)** below decides how far up.
- **The ladder**, if it goes past a posting: official, head of office, undersecretary, secretary (normally made an archbishop), prefect (normally a cardinal).
- **The diplomatic service**: the Holy See's school for diplomats, a nunciature abroad as secretary, and eventually a nunciature of one's own. The man who sat on the other side of the terna.
- Titles as the Holy See gives them: chaplain of His Holiness ("Monsignor"; for diocesan priests limited since 2014 to those over 65, with exceptions for the diplomatic and curial service; flag for verification).

---

## 7. Cardinals and the conclave

- **An archbishop of a great see or a curial prefect may be created a cardinal** at a consistory: an offer he cannot refuse gracefully, a red hat, a titular church in Rome.
- **A cardinal under 80 is an elector.** At the next vacancy the conclave becomes a played sequence: the general congregations (who speaks, what the College wants), the ballots (read the room, cast a vote, be looked at), and the name.
- **Open (D):** whether the player can be elected.

---

## 8. Build order

| Round | Contents | Done when |
|---|---|---|
| **R1.0 The papacy** | Papacy records, death and resignation, the interregnum state (episcopal appointments freeze), a conclave from the gallery (letter, bells, name), `romeTemperament` from the pope, a Rome line on the calendar strip and the Profile. | A 40-year run lives through two to four popes, and nothing is named during a vacancy. |
| **R1.1 Documents and the cascade** | Document data and draw, the bishop's interpretation, policy axes wired into existing systems (the older Mass first), parish implementation scenes, the public record, `rome` moved by fidelity. ~30 documents, ~30 scenes. | A document changes what the player may do in his church, through his bishop, and the choice he makes is still on the record ten years later. |
| **R1.2 Reversal** | Reversal detection and scenes, a papacy that undoes its predecessor. ~10 scenes. | The man who implemented a painful norm meets its undoing and the record reads it back. |
| **R1.3 The nuncio** | Nuncio NPC, the terna process for sees in the region, being consulted about others, episcopal offers decided by him, `rome` in trust. ~15 scenes. | Two men with the same stats and different records get different letters. |
| **R1.4 The Curia** | The Curia posting from Rome, its week and dials, the ladder per Open (C), the diplomatic service. ~25 scenes. | A priest can work in a dicastery for five years and come home changed, or not come home. |
| **R1.5 Cardinals and the conclave, played** | Creation at a consistory, the elector's conclave on the ballot machinery, and the player electable. ~15 scenes. | A cardinal votes in a conclave he can read, and the name that comes out follows from what the room was. |
| **R1.6 The papacy, played** | Design first (§9 D), then the pope's week, his documents and their cascade, consistories, and the end. | A pope can be played until his death or renunciation, and the next conclave reads what he made of the College. |

Tunables are invented and flagged; the conclave and the terna are deterministic from the seed and table-tested.

---

### 8.1 As built (R1.0)

*Added at build time.*

- **The record** (`content/rome/history.json`): Pius XII through Francis, with their dates, where they came from, a line each, and a reading on the game's one axis (flagged for review). **The generated line** (`content/rome/pools.json`, `systems/rome/papacy.ts`): each pope from the seed and his place in the line, so a world lives through the same popes on every replay. His regnal name takes the next ordinal (Leo left out), where he came from is weighted toward the College's electors, his age at election is about seventy, and his reading follows the College (the line's last three popes, carried, leaning away from the last). His years are rolled at election: a yearly chance of death rising past seventy, and from eighty-five a chance he lays it down.
- **Every start year works** (`romeOn`): the game opens with the pope of its start date, or an open vacancy, walking the record and then the generated line; a 2040 start has only generated popes. Older saves are given the Rome of the week they are opened in.
- **The week** (`papacyWeek`, run in `engine/clock.ts` for every phase from the first week of seminary): the see falls vacant on the pope's day, with a letter from Rome and a line in the Record; the white smoke rises 16–23 days later, with "Habemus papam" and the name; the career record keeps both.
- **Sede vacante** freezes papal acts only (§9 B): the nuncio's letters (the `episcopal` cluster) are not eligible, and a diocesan see that falls vacant waits for a bishop. Parish moves go on.
- **Rome's temperament** now follows the reigning pope, closing a third of the gap each year with the Curia's small drift; the silent random re-roll is gone. At ordination it starts from the pope's reading.
- **On screen**: the pope's name (or "Sede vacante", in gold) on the calendar strip; the popes of his life on the Profile; the life summary names them.
- Tunables in `PAPACY` are invented and flagged.

## 9. Decisions (owner, 26 September 2026)

- **(A) Real papal history, then rolled popes.** The real record is data (`content/rome/history.json`) up to the last pope no longer living: Pius XII through Francis. From the vacancy of 21 April 2025 the popes are generated. A living pope is never named, and no generated pope takes the regnal name Leo (the reigning pope's; CLAUDE.md rule 13). A 2010 start lives under Benedict XVI and Francis, then diverges; a 2040 start has only generated popes.
- **(B) The interregnum freezes papal acts only**: no bishops named and no documents. Diocesan bishops keep governing and parish moves continue (canonical; DESIGN §16's "all appointments" is read this way).
- **(C) The Curia: a posting and the ladder** to secretary of a dicastery (R1.4). The diplomatic service is a later round.
- **(D) The player can be elected pope and keep playing.** This is a new playable tier with its own design, **R1.6 The papacy, played**, specified before it is built: what a pope's week is (audiences, the Curia, documents he writes and the cascade he starts, travel, consistories, the College he shapes for his successor), and how the life ends (death or renunciation).
- **(E) Home diocese while he is a bishop elsewhere**: let it change (the recommendation; not yet built).

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

**Fixed with this draft:** an auxiliary whose years end came home to the board and could be made a vicar (now the flagship's pastor); the see and translation letters offered "not now" (now yes or no, `OfferDef.final`); a translation left the first see's letter open; the translation's cluster did not match. **Built later (§9 E):** the home diocese goes on changing while the man holds a see elsewhere, or reigns.

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

### 8.2 As built (R1.1)

*Added at build time.*

- **Documents as data.** The record (`content/rome/documents.json`): 49 documents from *Humani Generis* (1950) to *Dilexit Nos* (2024), each with its kind, the day it takes effect in the parishes, its pope, and its gist; nine of them move a policy axis. Dates and gists are flagged for verification. **Policy axes** (`content/rome/axes.json`): the older Mass (free, by indult, by faculties, closed), the English of the Missal, communion for the divorced and remarried, blessings of couples in irregular situations, marriage nullity cases, the instituted lay ministries, synodality, and the care of creation, each ordered from its traditional to its progressive end, with what changes in a parish and, for the older Mass, the stance the bishop's reading sets and the floor the law leaves him.
- **Generated documents** (`content/rome/documentPools.json`, `systems/rome/documents.ts`): after the record, about one and a half a year, a week at a time from the seed. A pope moves an axis one step toward his own reading, more often the further from the centre he stands; the rest are teaching on a topic. Incipits are invented (an opener and a continuation) and checked against a list of real titles. Nothing is issued in a vacancy.
- **Every start year works** (`romeAtStart`): the law at the start of a life is where the record and the generated line left it (1975: the older Mass closed; 1990: by indult; 2010: free, by *Summorum Pontificum*; 2022: by faculties). Older saves are given the law of the week they are opened in.
- **The bishop's reading** (`systems/rome/policy.ts`): a pure function of the seed, the document, and the bishop, from the document's lean times his own; enthusiastic, faithful, minimal, or slow-walked. A new bishop reads the same document his own way. The reading is in the letter, in authored lines per axis and norm.
- **Wired into the older Mass.** `decor.ts` reads the axis instead of the 2021 date: the faculty gate, the routine's older Mass, the parish Mass form, and the bishop's stance (`effectiveStance`: his rolled stance, set by his reading where the axis says so, never looser than the law). Under *Summorum Pontificum* a faithful bishop leaves the parish's older Mass to the pastor; under *Traditionis Custodes* an enthusiastic one closes the faculty.
- **The cascade.** A document on an axis sets a parish scene due three to ten weeks on (beat `cascade`, drawn ahead of the ordinary pool, lapsing after half a year if he is away). 29 scenes (`content/events/rome/`), by axis, value, and the bishop's norm; each choice records what he did (the `document` effect: eager, faithful, minimal, defiant), moves `rome`, the chancery, the bishop, and the wings, and the public ones go on the record as positions. New conditions: `policy` and `document`; new tokens: `{pope}`, `{doc:<axis>}`, `{doc_kind:<axis>}`, `{reading:<axis>}`.
- **On screen**: a letter "From Rome" for each document on an axis (what it changes, and the bishop's reading), a line in the Record for every document, the career record, and a "From Rome" sheet on the Profile: each document of his life, how his bishop received it, and what he did with it.
- **Fixed on the way**: the chancery's chance of granting a traditional liturgical ask ran the wrong way with the bishop's leaning; a traditional bishop now warms to it.
- **Not yet**: when the man is himself a diocesan bishop, the reading is his to give and no scene asks him for it (R1.6's territory, or sooner). Reversal scenes that read his record back are R1.2.

### 8.3 As built (R1.2)

*Added at build time.*

- **Detection** (`systems/rome/reversal.ts`): a document reverses when it moves an axis against the latest document on that axis the man answered in his parish (one he never answered is not read back to him). The new document carries the mark: which document, what he did with it, and when. It happens as often as Rome changes its mind, so a long career can meet it twice or more, each time reading back the newer answer.
- **The record read back.** From the history, the choice he made in the parish scene: its words, the year, the parish, and what it cost and won (from the choice's authored effects: "It cost you the traditional families and some of the parish, and won you Rome, the chancery and the bishop."). It is a paragraph in the letter from Rome, so a man away from any parish still hears it, and tokens for the scenes: `{then_doc|then_year|then_parish|then_said|then_cost:<axis>}`. The validator requires a scene using them to carry a `reverses` condition on that axis.
- **Scenes** (`content/events/rome/reversal.json`, 11): the Mass he ended, the Mass he would not end (vindicated), the Mass he gave and must take back, the refusal remembered; the Missal again; the people he brought to communion and the people he kept in the pew; the blessing given and the door kept shut; the lay ministries' register; what the parish said. They are cascade scenes with a priority, drawn ahead of any ordinary cascade scene, and their answer is the answer to the new document, so the record grows.
- New `document` condition fields: `toward` (`tradition` | `reform`) and `reverses` (true, or the way he answered the earlier one).
- **On screen**: the Profile's "From Rome" sheet says which later document undid each one.

### 8.4 As built (R1.3)

*Added at build time.*

- **The nuncio** (`systems/rome/nuncio.ts`): a generated archbishop in Washington (never a real one), from Italy most often, then Poland, the Philippines, India, Nigeria and elsewhere, reading as the pope who sent him does with a man's own variance. He serves five to eight years; a new pope recalls him within a year half the time. He is an NPC (`@nuncio`), named on the Profile, and his arrival is a line in the Record and, often, a dinner with the clergy.
- **His reading of a man** (`nuncioView.ts`, 0..100, `{nuncio_view}` in prose): Rome's regard and the chancery's; what the man did with Rome's documents in his parish (faithful and eager count for him, defiance against him); what he has said in public against the nuncio's own reading, and whether he is loud; a canon law or Roman degree, the years as vicar general or auxiliary, a hard parish turned; his own bishop's letter; and whether he kept the nunciature's secrets. Two men with the same stats and different records read differently, and get different letters: a test holds it.
- **The terna.** About three sees of the region in five years fall vacant (from the pool of sees, never the home diocese). The nuncio consults: a man of eight years whom he reads well enough is asked, sub secreto, about another priest (a classmate or a brother priest; `@terna_subject`): friend, rival, stranger, his fidelity, the secretary's follow-up call. A man of sixteen years he reads highly (62 and up) may be put on the list himself: `terna_named`, and a scene that tells him so sideways (the old questionnaire scene among them). Some months later Rome names someone: sometimes the man he was asked about, sometimes a stranger, sometimes him. Nothing is named in a vacancy of the Holy See.
- **The offers are his.** A see comes only from a terna that named the man, as a guaranteed letter that names the see and reads his file back to him, and that see is the one he gets. The auxiliary and the translation need the nuncio's reading (55 and up) instead of fixed thresholds; the bishop's request for an auxiliary is a scene that puts the man's name forward, or lets him say no for good.
- **Rome in trust:** a chancery post comes likelier to a man Rome thinks well of (up to ×1.4) and rarer to one it does not (down to ×0.6).
- **Fixed on the way:** Rome's letters (the see, the auxiliary, the translation) now move a man at once instead of waiting on the diocesan bishop's letter, where a second post accepted in the meantime could displace a see; no post asks for his years while he is waiting on a letter of appointment; an auxiliary whose years end opens the flagship's letter instead of the board's.
- Scenes: 14 new (`content/events/rome/nuncio.json`) and the questionnaire converted, on beat `nuncio`. Tunables in `NUNCIO` and `VIEW` are invented and flagged.

### 8.5 As built (R1.4)

*Added at build time. The diplomatic service is left for a later round (§9 C).*

- **The letter** (`content/offers/rome.json`): the Secretariat of State asks the bishop for a priest of the diocese as an official for five years. It comes to a man of three years or more whom Rome regards (15 and up) and the nuncio reads well (45 and up), with Italian, a Roman degree, a desk at the Holy See as a student, or canon law; likeliest to the man who worked at the Holy See as a student. Rome's asks are always released. Declining is remembered in Rome.
- **The office** (`content/rome/dicasteries.json`, `systems/rome/curia.ts`): nine offices (Doctrine of the Faith, Bishops, Clergy, Divine Worship, Evangelization, Laity, Legislative Texts, the Signatura, the Secretariat of State), with their names by date (congregations and councils before Praedicate Evangelium, dicasteries after; the laity's in 2016). Where he goes follows his record: a canonist to the Signatura or Legislative Texts, a theologian to the Doctrine of the Faith. A prefect (a cardinal), a secretary (an archbishop), and a colleague down the corridor are generated for the office.
- **The week** (the posting machinery): the files, drafting for signature, the Thursday congresso, a Roman parish on Sunday, the city, lunches, audiences, the chapel, and Italian if he lacks it; four dials (the files, the superiors, Rome, the priest) and a book (files closed, letters drafted for another's signature, Sunday Masses, audiences, plenaries).
- **The ladder**: once a year the superiors look at him (the dials, the nuncio's reading, Rome's regard, a year's luck). Head of office after two years, undersecretary after four, secretary after six, each keeping him in Rome longer; a secretary is ordained an archbishop. The rungs above head of office are the pope's and wait out a vacancy.
- **Stay or go**: near the end of his years, superiors who value him ask him to stay three more; he may say yes, go home, or ask his bishop.
- **Home, changed or not**: his reading drawn a quarter of the way toward the pope's; a man who kept the Roman parish and the chapel comes home a priest still, a man who let them go comes home a clerk (piety down, administration up); a letter says which. He comes home to the flagship, like a Roman degree, and the nuncio counts the years. A secretary does not come home: his years end in a see, and the nuncio's letter follows.
- Scenes: 27 (`content/events/study/curia.json`): the badge, the protocol number, drafting over another man's name, the cordata, the journalist, the Roman pastor's funerals, the ad limina visit from the other side of the table, a call from home, the pope in the corridor, Ferragosto, lunch with the cardinal, the secretary's door, a file from home, the Curia in a vacancy; one or two for each office (a theologian's book, a friend on a terna, a petition to leave, one word of a translation, a missionary bishop, a movement's statutes, what a canon means, an appeal, the pope's desk); head of office, the Bollettino, the ordination in St. Peter's, and the ask to stay. New condition `papacy` (vacant); selectors `@curia_prefect`, `@curia_secretary`, `@curia_colleague`; tokens `{dicastery}`, `{dicastery_short}`, `{dicastery_work}`, `{curia_rank}`, `{curia_offer}`.

### 8.6 As built (R1.5)

*Added at build time. Elected pope ends the run for now (ending `elected_pope`); R1.6 makes the papacy playable (§9 D).*

- **The College** (`content/rome/college.json`, `systems/rome/college.ts`): about a hundred and twenty electors, generated when Rome first ticks from each pope of the line (created 58 to 76, reading 70% their creator's plus their own variance, a College rating, a region, a day of death rolled from the seed). They age out of the electorate at eighty and die in their time. The reigning pope holds a consistory every year and a half to two and a half and refills the electors toward 120 with men of his reading (the cap is Paul VI's and popes have exceeded it; flagged).
- **The man created**: at a consistory, an archbishop of a great see (two years in it) or a secretary of a dicastery (two years), under eighty, whom Rome regards (30 and up), not too far from the pope's reading, may be created, likelier as Rome regards him more. The biglietto comes by letter; a titular church in a Roman district; he is a cardinal until he dies and an elector until eighty.
- **The conclave** (`systems/rome/conclave.ts`, on `systems/ballot.ts`, extended with a threshold, runoff-only-at-threshold, and the leaders not voting in the runoff): the electors are the cardinals under eighty on the day the see fell vacant. Each weighs the papabili (the College's five highest-rated, a little rolled) by rating, nearness of reading, region, and an age near seventy-two. Two thirds; after the thirtieth ballot the two leaders go to a runoff in which they do not vote (Benedict XVI's 2007 rule; flagged). A College without the man elects from its own the same way; the successor is removed from the College.
- **Played, when he is an elector** (`systems/rome/conclaveFlow.ts`, `ui/ConclavePanel.tsx`): fifteen days after the vacancy (Universi Dominici Gregis; flagged), unless the record names the next pope (1978, 2013), the conclave opens. He may speak in the general congregations (continuity, reform, a pastor, governance: each moves the room a little and is weighed against his own gifts), casts his ballot, and, if the College reads him as papabile (his standing with the nuncio and Rome, his chair, his speech), lets himself be seen as willing or not (the College distrusts the man who wants it). The ballots are read out one by one. If the name is his, he accepts and chooses among three regnal names, or refuses and the College votes again without him. Another man's name closes it: proclaimed on the election day, and what he did is remembered (voted with the winner, heard his own name).
- **The pope and the College**: the next pope is the conclave's man, the College's, or a generated one where there is no College; a papacy waits on the played conclave when the man is an elector.
- Scenes: 12 (`content/events/rome/college.json`): the biglietto (at a see, in the Curia), the titular church, a consistory, the eve (a lunch, the lists, prayer, an emeritus who cannot vote), after (his man, not his man, his own name read), and eighty. New condition `college` (scene); tokens `{titular}`, `{college_electors}`.

## 9. Decisions (owner, 26 September 2026)

- **(A) Real papal history, then rolled popes.** The real record is data (`content/rome/history.json`) up to the last pope no longer living: Pius XII through Francis. From the vacancy of 21 April 2025 the popes are generated. A living pope is never named, and no generated pope takes the regnal name Leo (the reigning pope's; CLAUDE.md rule 13). A 2010 start lives under Benedict XVI and Francis, then diverges; a 2040 start has only generated popes.
- **(B) The interregnum freezes papal acts only**: no bishops named and no documents. Diocesan bishops keep governing and parish moves continue (canonical; DESIGN §16's "all appointments" is read this way).
- **(C) The Curia: a posting and the ladder** to secretary of a dicastery (R1.4). The diplomatic service is a later round.
- **(D) The player can be elected pope and keep playing.** This is a new playable tier with its own design, **R1.6 The papacy, played**, specified before it is built: what a pope's week is (audiences, the Curia, documents he writes and the cascade he starts, travel, consistories, the College he shapes for his successor), and how the life ends (death or renunciation).
- **(E) Home diocese while he is a bishop elsewhere**: let it change. *Built (`systems/homeFromAfar.ts`):* while he holds a see elsewhere or reigns as pope, the home see changes hands on its own schedule (the same retirement, death, and promotion rolls, the successor's reading drawn toward Rome's), but the new bishop is not his: nothing of his is reread (chancery standing, leave, circles), no succession scene is owed, and it is not counted among the bishops he served. It comes as a letter from home: who the man is, what he says his priorities are, how near his reading is to the man's, and either a brother bishop's invitation to the chrism Mass or, for a pope, the terna for the diocese that ordained him signed with the Saturday files. The new bishop's regard for him follows the gap between their readings (invented, flagged). A pope, who has no diocesan year, now also has Rome's temper follow him yearly and his classmates' years go on. A man lent to the Curia is still his diocese's priest and meets a new bishop as before.

---

## 10. R1.6 The papacy, played (design)

*Written before the build, as decision (D) asks. Everything here rides on machinery already built: the posting (a week of activities, dials, a book), the documents and their reading by bishops, the College and its consistories, the conclave engine. Tunables are invented and flagged; the canonical points are flagged for verification (CLAUDE.md rule 12).*

### 10.1 What a pontificate is, in the game

The man says *accepto* in the Sistine Chapel and does not come out as a priest of his diocese again. The pontificate is **the last posting**: the Apostolic Palace as a place, with a week of blocks he gives to the work, five dials that say how the reign is going, and a book of what it counted. It ends only by death or renunciation (can. 332 §2: freely made and duly manifested; flagged). There is no endWeek and no board.

- **The election**: the see or office he held is written to the record as served; he stops being a cardinal; he is the reigning pope in `rome.popes` (id `player`, his regnal name, his reading as his temperament). Two men are generated for him: a **Secretary of State** (a cardinal of the College, taken from it) and a **private secretary** (a monsignor he brings or is given).
- **What stops while he reigns**: the generated line of documents (he writes them), the automatic consistory (he calls them), the nuncio's scenes (he names nuncios now), the letter at seventy-five (a pope does not submit one), and offers. What goes on: the College's deaths and eightieth birthdays, the record's own documents on their dates, the world's calendar, and the home diocese (§9 E: its see changes hands and his classmates have their years); his old diocese's bishop reads what he writes.

### 10.2 The week (the posting machinery)

Sixteen blocks. Activities, each moving dials and adding to the book:

| Activity | Moves | The book |
|---|---|---|
| The Wednesday audience | the world, the Church | pilgrims (thousands) |
| The prefects' audiences (the *tabella*) | the Curia | |
| The bishops' files | the Curia, the Church | bishops named |
| Writing | (the document on the desk) | |
| The diocese of Rome: a parish on Sunday | the Church, the priest in him | Roman parishes visited |
| The chapel before dawn | the priest in him | |
| Confessions in St. Peter's | the priest in him, the Church | |
| The Secretariat's world files | the world | |
| The causes of the saints | the Church | saints canonized |
| Castel Gandolfo: rest | his strength, the priest in him | |

**Dials** (−100..100): *the Church* (divided … with you), *the Curia* (against you … your instrument), *the world* (not listening … listening), *the priest in you* (emptied out … a priest still), *your strength* (failing … strong). Strength falls a little every year with age and with every journey; rest restores it.

### 10.3 The desk: documents he writes

One document on the desk at a time. He chooses:

- **The kind**, which sets the writing it takes: an encyclical (90 blocks of writing), an apostolic exhortation (60), an apostolic letter (30), a motu proprio (15). Invented.
- **The subject**: one step along a policy axis in either direction (the same axes the generated popes move, from where the law stands now), or a teaching topic from the pools that moves no law.

The Latin incipit is generated (never a real document's). When the writing is done it is **promulgated** through the same `issueDocument` the whole Church already lives under: the law moves, and if it turns back a document he implemented as a priest, the reversal machinery reads his own record back to him (§4.3), now from the other side of the desk.

**Reception**: the College's electors read it as the bishops of the world would, each with the norm the cascade already rolls (welcomed, received, the minimum, slow-walked); his old diocese's bishop reads it too, by name. The Church dial moves by the share welcoming or receiving against the share resisting; the Curia dial by how the curial cardinals read it; an encyclical is heard by the world. Turning back a predecessor's document costs more of the Church than moving new ground. Invented weights.

### 10.4 Consistories he holds

Once a year at most, from his first anniversary, he may call a consistory. He is shown **sixteen men**, generated independently of his own reading (so the choice, not the roll, shapes the College): name, country, age, reading, residential or curial. He creates as many as bring the electors to 120, and may go past it by up to five, as popes have, at a cost with the Curia. Curial men please the Curia; the rest please the Church. Each man is a `Cardinal` created by him, and **the next conclave is his College's**.

### 10.5 Journeys

He plans an apostolic journey to a country (the College's origins), eight to fourteen weeks out; one planned at a time, three a year at most. The journey moves the world and the Church, costs strength (more with age), adds to the book, and brings its own scene (the tarmac, the Mass for a million, the press conference on the plane).

### 10.6 Scenes

About two dozen, beat `pope`, drawn about one week in eight in place of the ordinary pool, plus the journey's: the balcony and the first blessing, the apartment (the Palace or the guesthouse), the Secretary of State, the first audience, a letter from his old parish, his classmates, a head of state, cardinals who send *dubia*, a leak from the Curia, the Vatican's money, a bishop's report that cannot be left in a drawer (authored, serious; never a mechanic to optimize, CLAUDE.md), Holy Thursday in a prison, a canonization, a war and an appeal for peace, the physician, the old friend who asks a favour, the anniversary of the election, the question of laying it down. They move the dials through the existing `place` and `record` effects.

### 10.7 The end

- **Death**: each year a chance by age (the generated popes' own table), lowered by strength and raised by its lack. Ending `pope_died`.
- **Renunciation**: always on the desk, with a confirmation; he becomes pope emeritus. Ending `pope_renounced`.
- **The conclave after him** is run from the gallery on the College as he left it (`collegeElects`), and the shelf page says whom it elected, whether that man was one of his creations, how many of the electors he created, and whether the successor reads near him.

Done when: a pope can be played until his death or renunciation, and the next conclave reads what he made of the College.

### 10.8 As built (R1.6)

*Added at build time.*

- **Accepto** (`systems/rome/pontificate.ts`): the conclave's acceptance now begins the pontificate instead of ending the run (`elected_pope` stays for older saves). The see or office he held is closed on the record; the Secretary of State is the curial elector nearest his reading whom the College rates; a private secretary is generated. The posting is `papacy` (`content/study/programs.json`, city `holy_see`, kind `pope`), with ten activities (`content/study/activities.json`, `pope_*`), five dials, and a book of seven counts.
- **The week**: each week the Church, the Curia, and the world forget 4% of what they heard; strength drains a little every week (more past seventy) and can never exceed what his age allows (100 less 3 a year past sixty); rest restores it. Once a year the dials drift, a letter reads the year, and death is rolled (the generated popes' table, halved at full strength and raised half again at none). All invented, flagged.
- **The desk** (`systems/rome/papalDesk.ts`): four kinds (encyclical 90 blocks, apostolic exhortation 60, apostolic letter 30, motu proprio 15), a step either way on any axis a pope may move or one of three teaching topics, a generated incipit; promulgated through `issueDocument` with the cascade closed (no parish scene for a pope). Reception from the College's electors and its curial men by the cascade's own norms; a law moved again within a year costs the Church 4 per earlier move; turning back a predecessor's document costs 6. His old diocese's bishop's reading is named in the letter. The seed's generated documents skip his pontificate.
- **Consistories and journeys** (`systems/rome/papalActs.ts`): a consistory a year from the first anniversary, sixteen men offered whose readings are rolled independently of his, up to five over the cap at a cost with the Curia; created cardinals carry `createdBy: 'player'`. Journeys to any of the College's countries, prepared eight to fourteen weeks, three a year, each with a scene.
- **The end**: death, or renunciation from the desk (with a confirmation) or from the scene put to him when his strength fails (`pope:renounce`, taking effect the next week). Endings `pope_died` and `pope_renounced`; the shelf page carries the reign's line and the epilogue (`systems/rome/pontificateText.ts`): how many electors he made, whom the College elected, and how near that man reads to him.
- **UI**: the Holy See sheet (`ui/study/PopePanel.tsx`: the desk, the College, journeys, laying it down), the pontificate on The work sheet, a pope's briefing, the Profile line.
- **Scenes**: 28 (`content/events/rome/pope.json`, beat `pope`), about one week in eight plus the scheduled ones (the Loggia and the apartment in the first week, three for journeys, two for anniversaries, the question of laying it down). New conditions `papacy` `reigning` and `scene`; selectors `@secretary_of_state`, `@pope_secretary`; tokens `{pope_name}`, `{pope_journey}`, `{pope_draft}`, `{pope_years}`, `{pope_from}`, `{pope_age}`. The bishop's report is authored and category `scandal` (never sent to the LLM layer); the pope's confession is sealed (rule 7).
- **Fixed on the way**: rolled readings in the College, the nuncio, and the papacy could be a negative zero, which JSON does not keep; they are now normalized.


---

## 11. R1.7 The diplomatic service (design)

*Decision (C) left the diplomatic service for a later round; this is it, written before the build. It rides on the posting machinery like the Curia (§8.5). Canonical and institutional details are close to current practice and flagged for verification (CLAUDE.md rule 12): the Pontifical Ecclesiastical Academy takes young priests, usually under thirty-five, for two years of study (with a canon law degree for those who lack one) and, since 2020, a year of missionary service in a local church; its graduates serve in nunciatures as secretaries and counsellors, move every three years or so, and after about two decades may be named apostolic nuncio, a titular archbishop, until seventy-five. The Academy is named, as the Gregorian is; every person in it and every nunciature's staff is generated.*

### 11.1 The letter

The Secretariat of State asks the bishop for a young priest for the Academy: ordained two years or more, under thirty-eight (the Academy's own limit is lower; flagged), whom Rome regards (15+) and the nuncio reads well (50+), with a Roman degree, Italian, canon law, or a desk at the Holy See as a student. Rome's asks are always released. Declining is remembered (`refused_academy`), and the letter does not come twice.

### 11.2 The Academy (two years) and the missionary year

A posting in Rome (`diplomatic_academy`): the Academy's residence on a Roman square, a week of blocks (diplomatic history and international law, languages, drafting, protocol, canon law where he lacks it, the Academy's chapel, a Roman parish on Sunday), dials (the Academy's regard, languages, the priest in him), and a book. The third year is the missionary year, served in a mission diocese abroad; a scene marks it. When it ends he does not go home: the service begins.

### 11.3 The service

A posting that does not end on its own (`nunciature`): a nunciature in a country from data (`content/rome/nunciatures.json`: country, region, language, hardship, the Church there), his chief (a generated nuncio, `@nuncio_chief`), and a week of blocks: the reports to Rome, the local bishops, the government's offices, the embassies' circuit, the nunciature's chapel and a parish, languages, rest. Dials: *the reports* (unread … read on the Third Loggia), *the local Church* (a stranger … trusted), *the government* (a door that stays shut … a door that opens), *the priest in you*. A book: dispatches sent, countries served, ternas prepared, bishops ordained there.

- **Rotation**: about every three years (rolled 150–190 weeks) the Secretariat moves him: a scene in which he takes the next country, or asks to go home to his diocese. A new country resets the local dials; the reports and the priest carry on.
- **The ladder**: secretary second class on arrival; first class after three years; counsellor after seven; and from fourteen years, once a year, the Secretariat may put his name to the pope for a nunciature of his own (the reports, the chief's regard, Rome, a year's luck). The pope's acts wait out a vacancy.
- **Nuncio**: ordained titular archbishop in Rome; a country of his own (weighted to the harder ones first); the chief is now himself, so the week gains the nuncio's work: the ternas (the other side of the terna: three names for a vacant see, chosen and sent), credentials presented, the bishops' conference, the crisis. A yearly terna scene.
- **The way home**: at any rotation he may ask to go home. The Secretariat lets him go; he comes home to the flagship like a Curia man, his reading drawn a little toward Rome's, and the priest in him decides whether he comes home a priest or a clerk. A nuncio does not go home to a parish; his letter at seventy-five ends it (retirement).
- **The red hat**: a nuncio of eight years whom Rome regards may be created a cardinal at a consistory, as an archbishop of a great see or a curial secretary may (§7), and so reach the conclave.

### 11.4 Scenes

About twenty-five, beat `diplomacy`: the Academy (the first dinner, the language that will not come, the professor who was a nuncio, the Secretariat's visitor, the missionary year), the nunciature (the chief's temper, a coup, a hostage, a bishop who writes to Rome behind the nuncio's back, a journalist, the national day, an ambassador's dinner, a report softened or not, a local priest who needs protecting, a letter from home), rotation (the new country, or home), and the nuncio's (credentials, the terna, a papal visit prepared, a government that expels him, the letter at seventy-five). Rotation and the terna are scheduled scenes; the rest are drawn now and then.

### 11.5 As built (R1.7)

*Added at build time.*

- **The letter** (`content/offers/rome.json`, `rome_diplomatic_academy`): as §11.1, with the nuncio's floor at 50 (a strong young priest's reading tops out near 54, so 55 would almost never be met) and, after the browser QA, the age limit at 40: the conditions are met mostly while a man is away on his Roman degree, when no letter can come, and he is 38 or 39 when he is home. Cluster `curia`, so the two Roman letters raise each other. It does not come to a man already promised to the Academy (`academy:recruited`).
- **From the Gregorian** (`rome_academy_from_rome`): the Academy in fact recruits priests already studying in Rome, and this is that path. While he is on a Roman degree (flag `study:rome`), 38 or younger, with Rome's reading at 10 or better and Italian, French, or knowledge 55, the president asks him to coffee (weight 6, window 4 weeks, cluster `curia`; doubled for a man who has worked at the Holy See, down for an outspoken one). Accepting sets `academy:recruited` and Rome +4 and changes nothing else yet: he finishes the degree. At `endStudy`, a recruited man who completed it goes straight into the Academy (`rome_diplomatic_academy`, recorded as accepted) instead of home, with no homecoming letter or assignment; one who failed it gets a kind letter and comes home as usual. Declining writes `refused_academy` and Rome −3, which also closes the letter home. Invented and flagged; the weight and floors are tunables.
- **The Academy** (`diplomatic_academy`, city `academy`, 156 weeks): seven activities (history and law, languages with French to be had, drafting, canon law at the Gregorian toward the JCL for a man without one, the chapel, a Roman parish, the receptions), three dials, a book. The missionary year is a scheduled scene at the end of the second year (the villages or the bishop's chancery). When the Academy ends, the offer is completed once and the service begins (`systems/rome/diplomacy.ts`, `beginService`).
- **The service** (`nunciature`, city `nunciature`): a secretary of nunciature, second class, in a country from `content/rome/nunciatures.json` (30 countries, hardship 1–3, a line about the Church there; real countries, generated people), under a generated nuncio (`@nuncio_chief`). Seven activities, the nuncio's ternas among them once the nunciature is his. A new country starts the local Church and the government colder the harder it is (−10 a step), and gets a new chief; the young and new nuncios draw the harder posts; a language he has makes a country likelier.
- **Rotation**: every 150–190 weeks (200–300 for a nuncio); the scene is put to him six weeks ahead with the next country named, and it is CRITICAL so that it reaches him even when the clock is skipping: this is the moment he may ask to go home.
- **The ladder**: first secretary at three years, counsellor at seven, and from fourteen the pope's nunciature, each on the Secretariat's yearly score (the reports, the local Church, the chief's regard, Rome, a year's luck; invented). The nuncio is ordained titular archbishop and counts as a bishop elsewhere for the home diocese (§9 E). A nuncio of eight years whom Rome regards (30+) may be created a cardinal.
- **The end**: going home at a rotation (the board and a flagship choice, like the Curia; his reading drawn 30% toward Rome's; the priest or the clerk by the priesthood dial); a nuncio's service, or any man's at seventy-five, ends in retirement, with the letter's scene.
- **Home, while he serves**: a priest in the service stays incardinated in his home diocese, but the Secretariat moves him, so from his first nunciature he is afar in decision E's sense (`afar` returns `service`). A new bishop at home comes as news and a letter (the door open if he is ever home in the summer), never as the succession scene, which assumes a priest at home and has none to fit. Before this a diplomat's home successions were logged with no scene, which the whole-career test caught.
- **Scenes**: 23 (`content/events/study/diplomacy.json`): the Academy's five and the missionary year; the nunciature's ten (the chief's temper, a coup, a letter behind the nuncio's back, a report softened, a journalist, the pope's day, a priest who needs protecting, a letter from home, chargé d'affaires, and more); rotation for a secretary and for a nuncio; the nuncio's credentials, a papal visit, the conference, expulsion; the terna; the letter at seventy-five. New condition `diplomacy` (scene, rank, hardship); tokens `{country}`, `{country_next}`, `{country_church}`, `{diplomat_rank}`, `{nunciature}`.

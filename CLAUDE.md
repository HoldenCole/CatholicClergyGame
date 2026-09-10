# CLAUDE.md

Instructions for working in this repository. `DESIGN.md` is the source of truth for game design; this file governs how the code gets written.

---

## What this is

A single-player, text-driven career and life simulation of a Catholic diocesan priest. Vite + React 18 + TypeScript, Zustand, Tailwind, Vitest. No backend. Saves are exportable JSON.

Personal project, no users but the owner. Favor depth and correctness over breadth, performance, or polish.

---

## Non-negotiable rules

**1. Authored content owns all state changes.**
Every stat change, reputation shift, relationship change, and flag comes from typed JSON in `/src/content`. The LLM layer never decides an outcome. It receives an already-resolved result and writes prose about it. If you find yourself parsing model output to determine what happened in the game, stop — the design is wrong.

**2. No `Math.random()` in game logic. Ever.**
All randomness goes through `engine/rng.ts`, which wraps `seedrandom` with a seed stored in the save file. This makes bugs reproducible and the promotion engine testable. A `Math.random()` call in `/src/engine`, `/src/systems`, or `/src/generation` is a bug even if the feature works.

**3. Content is data, not code.**
Events, dioceses, parishes, name pools, and group definitions are JSON conforming to the types in `/src/types`. Never hardcode an event in a component. Never write a `switch` on event ID. If an event needs behavior the schema cannot express, extend the schema and say so — do not special-case it.

**4. Generation over selection.**
NPCs, classmates, and parishes are built from independent attribute rolls, never picked from a list of premade characters. Alignment and stat profiles must roll independently of each other. If two runs produce recognizably the same person, the generator is broken.

**5. The five preset dioceses are data files in the same schema a custom diocese would use.**
No preset-only code paths.

**6. The diocese preview reads from the generated world, never from the preset.**
The world generates first; the preview renders the rolled state. There must be an explicit `visible` / `hidden` split in the diocese type, and the preview component may only read `visible` fields. If a preview shows something the design says is hidden, that is a bug regardless of how useful it looks.

**7. Opportunities are offers evaluated against state, not scripted grants.**
The offer engine checks requirements, opens a window, and expires. Never hardcode "at year 5, offer Rome." Declining must always write a consequence. Multi-year commitments run in the background and must survive save/load mid-commitment — test this specifically.

---

## Working style

- **Ask before inventing systems.** If a task requires a mechanic not in `DESIGN.md`, propose it and wait. Do not silently invent scoring formulas, resource types, or stat interactions.
- **Build in the phase order in `DESIGN.md` §14.** Do not start Phase 3 systems while Phase 1 is incomplete.
- **Write the types first**, then the engine, then the content, then the UI. UI last, always.
- **Small commits, one system each.** Do not bundle a refactor with a feature.
- **When a file passes ~300 lines, split it.**
- Prefer plain functions and plain objects. No classes unless there is a real reason. No dependency injection frameworks. No state machine libraries.

---

## Testing

Vitest. Test the systems, not the UI.

Required test coverage:

- `systems/promotion` — the scoring function, with fixed seeds and table-driven cases. This is the heart of the game and the easiest thing to get subtly wrong.
- `systems/stats` — decay math, the logarithmic curve above 70, and the cost of each obligation quality level.
- `engine/events` — condition evaluation, bias weighting, suppression windows, and chain resolution.
- `generation/*` — run each generator 1,000 times against fixed seeds and assert distribution properties (no attribute collapses to one value; alignment and stats are uncorrelated).
- `engine/save` — round-trip a full late-game state and assert deep equality.

A seeded run must be byte-identical when replayed from the same seed and the same choice sequence. There should be a test that asserts this.

---

## The LLM skinning layer

Lives in `/src/llm`. Rules:

- Called at **arc start**, never on user click. The player never waits on a model.
- Output is cached into the save file. A replayed week shows the same prose.
- Every call receives: the resolved outcome, the parish record, relevant NPC records, the year, and the liturgical season. It returns prose only.
- If the call fails, fall back to the authored `body` text. **The game must be fully playable with the LLM layer disabled**, and there should be a setting for exactly that.
- Never send the model the full save state. Send a narrow, explicitly constructed context object.

---

## Tone and content

The subject matter is treated seriously. Not satire, not reverence — the register is that of a good novel about institutional life.

- Write about Catholic practice, structures, and vocabulary **accurately**. Get titles, canonical processes, liturgical seasons, and formation stages right. If unsure of a detail, flag it rather than guessing.
- Sensitive material (abuse and scandal, celibacy, doubt, burnout, alcohol) is authored content only, per `DESIGN.md` §11. **Never route it through the LLM layer**, and never write it as a mechanic to be optimized.
- The player character is never a perpetrator of abuse.
- Leaving the priesthood is always available and always written with respect.

---

## UI conventions

- Tailwind only. No component libraries.
- **Numbers are hidden during character creation and seminary emphasis choices.** The player sees prose consequences. A stat inspector is available on demand, elsewhere.
- Every screen must be usable at 1280×800.
- No animation that cannot be skipped.
- The weekly digest is the most-read screen in the game. Make it scannable.

---

## Commands

```
npm run dev      # dev server
npm run test     # vitest
npm run check    # tsc --noEmit + eslint
npm run build    # production build
```

Run `npm run check` before declaring any task complete.

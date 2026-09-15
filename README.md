# Vocation

A single-player, text-driven career and life simulation of a Catholic
diocesan priest. `DESIGN.md` is the design; `CLAUDE.md` governs how the code
is written.

## Play it

**https://holdencole.github.io/CatholicClergyGame/**

That link is the game. Bookmark it; it is the same address after every
update, and the game keeps your saves in the browser you play it in.

- **Saves.** The run autosaves as the weeks pass, so closing the tab loses
  nothing: the title screen offers *Continue*. The *Saves & settings* sheet
  keeps a shelf of up to eight saves you name yourself, and can save over or
  delete any of them. Beginning a new man sets the last run aside as a named
  save first, so starting over never quietly ends the game you were playing.
  All of it lives in that browser on that device, so clearing the browser's
  data clears it, and a save made on the phone is not on the laptop.
- **Save files.** The Save sheet also downloads the run as plain JSON and
  loads one back, which is how a save moves between browsers or is kept for
  good. Worth doing before anything you would hate to lose.
- **Elsewhere.** A self-contained copy of the build is published as a
  claude.ai artifact for playtesting, and `npm run playtest` writes the same
  thing to `dist-playtest/vocation.html`, one file that opens anywhere.
  Those are separate pages, so their saves are their own.

The Pages site is built by `.github/workflows/pages.yml` on every push to
`main`, and can be deployed by hand from the Actions tab for any branch.

## Running it

```
npm install
npm run dev      # dev server
npm run test     # vitest
npm run check    # tsc --noEmit + eslint
npm run build    # production build
```

No backend. Saves are plain JSON, kept in the browser and exportable to a file.

## Where things live

```
src/engine      clock, RNG, save/load, event engine, seminary and parish flows, career, offers, store
src/systems     stats, reputation, formation, creation, week resolution, groups, promotion, succession, projects
src/generation  names, NPCs, classmates, formators, family, dioceses, bishops, chanceries, parishes
src/content     events, offers, creation questions, presets, name pools, obligations, actions (all JSON)
src/llm         the optional prose layer (off by default)
src/ui          the table: the room (src/ui/scenes, drawn in src/ui/scenes/art) and the desk of paper sheets
tests           systems, engine, generation, content validators
```

## The rules that matter

- Authored content owns every state change; the prose layer only skins.
- No `Math.random()` in game logic. ESLint enforces it under engine, systems, and generation.
- The diocese preview reads only the visible half of a diocese.
- A seeded run with the same choices is byte-identical, and there is a test for it.

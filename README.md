# Vocation

A single-player, text-driven career and life simulation of a Catholic
diocesan priest. `DESIGN.md` is the design; `CLAUDE.md` governs how the code
is written.

## Playing it

- **Playtest build:** https://claude.ai/code/artifact/8d6d0e01-4bf5-4e5e-97e4-d1d3108fed36
  A self-contained page of the current build. Saves autosave to the browser;
  use Copy JSON and Load a file to carry a run elsewhere (the Download
  button does nothing on that host).
- **GitHub Pages:** https://holdencole.github.io/CatholicClergyGame/
  Served by `.github/workflows/pages.yml` once Pages is enabled in the
  repository settings with "GitHub Actions" as the source. It redeploys on
  every push to `main`, or by hand from the Actions tab for any branch.
- **Locally:** `npm run playtest` writes `dist-playtest/vocation.html`, one
  file that opens anywhere.

## Running it

```
npm install
npm run dev      # dev server
npm run test     # vitest
npm run check    # tsc --noEmit + eslint
npm run build    # production build
```

No backend. Saves are plain JSON, autosaved to the browser and exportable.

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

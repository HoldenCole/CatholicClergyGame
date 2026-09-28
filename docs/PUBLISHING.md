# Publishing

Where the game is published, and how each place is kept current. Every merge to `main` runs `.github/workflows/pages.yml`; nothing is published by hand.

## The three places

1. **GitHub Pages, the live game.** https://holdencole.github.io/CatholicClergyGame/ — the app as `npm run build` makes it, redeployed on every merge. Pages allows a site of about a gigabyte and files of a hundred megabytes; the game is under ten. This is the home.
2. **The single-file page.** https://holdencole.github.io/CatholicClergyGame/playtest/vocation.html — the whole game in one HTML file (`npm run playtest`, `scripts/playtest.mjs`), built by the same workflow. It also opens from the disk: save the file and double-click it.
3. **The archive.** Every build's single file is kept as an asset on the rolling GitHub release tagged `playtest` (https://github.com/HoldenCole/CatholicClergyGame/releases/tag/playtest): `vocation-<date>-<sha>.html` per build, and `vocation.html` always the latest (https://github.com/HoldenCole/CatholicClergyGame/releases/download/playtest/vocation.html). Release assets do not grow the repository and may be up to two gigabytes each, so old builds stay playable for good.

The claude.ai artifact that used to carry the page is now a launcher that points at these. Its host refuses pages past a size it does not state (about 8.5 MiB in practice, and a packed page was refused smaller), which is why the page no longer lives there.

## Saves

Saves live in the browser's storage for the page's own origin. Moving from one place to another (the artifact, Pages, a file on the disk) does not carry them: export a save as JSON from the Saves sheet before moving, and import it after; or use the repository shelf (Saves → the repository), which keeps saves in a branch of a repository of your own under your own token and reads them from any origin.

## Deploying by hand

Settings → Actions → "Deploy to GitHub Pages" → Run workflow deploys any branch to Pages; the archive step runs only for pushes to `main`.

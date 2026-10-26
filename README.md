# Three Days

A daughter returns to Istanbul after her father's death. She has three days of leave, an incomplete notebook and neighbours who remember different men.

A short Ink game in an illustrated PixiJS room. Human Framework 3.2.0 supplies the people. The choices concern the living: an uncertain account, a promise, privacy and help. Worship is never a score. Bereavement and estrangement feature throughout; violence is not shown.

[Play](https://days.adamwhite.work) · [Design](docs/design.md)

Use Node 26.12.0 and pnpm 12.14.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check:lane
pnpm build
pnpm exec playwright install chromium webkit
pnpm e2e
```

After changing `src/story.ink`, run `pnpm story` and commit the Ink source and compiled JSON. The build rejects a stale compiled story.

`?lab=1` adds export and replay checks to Menu. Export includes the original seed, ordered input log, final Ink and HF state, and final hash. Recording can be turned off in Menu. Feedback sends only when submitted.

Code is MIT. Religious source records remain in the HF repository; this game supplies no religious rulings.

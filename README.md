# Three Days

A daughter returns to Istanbul after her father's death. She has three days of leave, an incomplete notebook and neighbours who remember different men.

A short Ink game in an illustrated PixiJS room. Human Framework 4.0.0 supplies the people; the shared continuity bridge uses the pure portable API from HF 4.3. The choices concern the living: an uncertain account, a promise, privacy and help. Worship is never a score. Bereavement and estrangement feature throughout; violence is not shown.

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

Menu offers playtest export and download to everyone. Replay checks sit in the initially collapsed Debug item beside Lab privacy. Export includes the original seed, ordered input log, final Ink state, the HF 4 run archive and final hash. Replay re-runs both the Ink story and HF, and HF checks its own archive. Saves and exports from the earlier HF 3.2 build are refused with a start-fresh message. Recording can be turned off in Menu. Feedback sends only when submitted.

When shared continuity is on, a fresh play admits Hacer, Burak and Selin from the shared shelf and saves their ending states there when they can leave safely. The play records the opening inputs and claim receipts so replay does not consult the shelf. Continuity and play recording are separate choices; turning continuity off keeps the play local.

If someone is still continuing in another game, their shared history stays there while the other available people can continue in Days. The play names anyone who could not join from the shelf.

Older saved plays that attempted a delivery or an estate record lack the new agreement facts and require a fresh play.

Code is MIT. Religious source records remain in the HF repository; this game supplies no religious rulings.

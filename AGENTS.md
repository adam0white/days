# days: project instructions

Read README.md and docs/design.md. HF owns actor state and choices; the host owns the world and consequences. Keep seeded behavior and complete current-export replay. Refuse unsupported saves with a start-fresh explanation.

Current goal (owner, 2026-11-05): adopt current published HF 4.x, update dependencies and active dated follow-ups, and deliver a playable game. Done means a signed combined PR, exact-head hosted Codex review with no findings, green CI, normal deployment and a matching clean release.json. The owner accepts game feel separately. No multiplayer or account transfer.

Use managed isolated worktrees. Run check:lane before commits. Use Node 26.12.0 and pnpm 12.16.1. Install with pnpm install --frozen-lockfile. Commit the lockfile after dependency changes. Keep no hoisting, strict peers, explicit native build permissions and a 1440-minute release-age delay; only @adam0white/* bypasses that delay. Public files identify a human playtester only with those words.

Stack: TypeScript 7.0.2, Vite 8.3.5, Vitest 5.1.0, Biome 2.6.5, Wrangler 4.157.0, HF 4.17.0.

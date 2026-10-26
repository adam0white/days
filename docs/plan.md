# Build plan

1. Commit janazah sourcing and decisions to HF research with caveats intact. Read the committed file before authoring religious text.
2. Scaffold strict TypeScript, pnpm, Vite, Biome, Vitest, Playwright and exact HF pin. Sign the baseline. Separate worktrees own engine and room files.
3. Engine: createGame(seed), choose(game, choiceId), view(game), exportRun(game), replay(run), hashGame(game). State is JSON. View has day, title, text[], choices[{id,label}], outcome (playing/won/lost), people[], mood and progress. Unit controls prove a complete win, complete loss, seed variation, rejected invalid input and exact replay. Write and run failing tests first.
4. Room: mountRoom(element) returns update(view) and destroy(). Pixi graphics never mutate game. Narration and choices are DOM, main.ts owns events and menu.
5. Integrate lab client, first-visit notice, recording, Feedback, diagnostic export and restart. Test both outcomes and menu across Chromium/WebKit at 360×690 and 1280×800. Check browser console and layout.
6. Independent review; fix verified findings. Signed push main, exact CI, build from clean commit, Wrangler deploy and live manifest/browser check. Then HF central listing in delivery lane and board readiness row.
7. Remove own worktrees and merged branches, close owned browser/server PIDs and record final worktree lists in report.

Review focus: mutated Ink lookahead; hidden worship scoring; malformed exported input; actor choices without consequences; mobile text/choice overflow; feedback receipt failures.

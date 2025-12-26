# Advent of Code Tracker

A web app for tracking and sharing Advent of Code solutions, built with:
- **[LiveStore](https://docs.livestore.dev/)** - Local-first sync engine with SQLite
- **[SolidJS](https://www.solidjs.com/)** - Reactive UI framework
- **[Bun](https://bun.sh/)** - Fast JavaScript runtime & package manager
- **[Vite](https://vitejs.dev/)** - Build tool

## Features

- 📥 Store puzzle inputs for each day
- 💻 Write and save solutions (SQL initially, more languages later)
- ▶️ Execute SQL solutions against puzzle inputs in an isolated SQLite instance
- 🔄 Automatic sync across tabs/devices via LiveStore
- 📋 List all saved inputs for quick navigation
- 🎨 AoC-themed dark UI
- ✅ Test inputs with expected outputs - see if your solution matches

## SQL Solution Format

Your SQL solutions should:
1. Read from `input_data` table (one row per line of input, column named `line`)
2. Write results to `output` table with columns `progress` (REAL) and `result` (TEXT)

Example solution:
```sql
-- Count lines in input
INSERT INTO output (progress, result)
SELECT 1.0, COUNT(*) FROM input_data;
```

Use `progress < 1.0` for debug output that shows intermediate results:

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Build for production
bun run build

# Preview production build
bun run preview
```


## Bugs to fix

- [x] ignore playwright-report dir and remove all contained files from git
- [x] hard forbid !important in css in biome, and fix the warnings about it.
- [x] The name aoc-livestore was a temporary measure. Find all public references to aoc-livestore and replace it with aoc-sqlite (e.g. the filename `aoc-livestore-export.json` and the suggested github token name)
- [x] make the text boxes shrinkable to a min height of 1.5 text lines
  - [x] looks a bit shit. The gap at the bottom below the text is somehow shorter than the gap at the top.
  - [x] if you click to add a test input, it deletes the main input, and the only way to get the main input back is to delete all test inputs - add a playwright test for this and fix the bug
- [x] main should not be highlighted like the rest of the tabs, because we don't automatically run it and can't check the answer
- [x] whenever I switch day, from part 1 to part 2, or between the different test inputs, clear the "RESULT" section until I next click Run again.
- [x] reset to part 1 when changing to a new day that you've not seen before
- [x] AoC doesn't want us to share our inputs. Don't include the main input when exporting to gist. - add a test for this and fix the bug
- [x] add a chevron to each block title, to expand/collapse the section. Save this state across refreshes, and default the export/saved inputs to closed. 
- [x] when adding or editing an input, automatically rerun the solution against that input (debounced) and update the tab title
- [x] transpose the solutions/expected outputs in the export json, so that we have a single "inputs" array, with the two outputs nested inside each object in the inputs array.
- [ ] save the output from each (day, solution part, test input) so that we can quickly re-color the tabs when we browse around the app (make sure the cache is invalidated if input or solution code changes)
- [ ] it is possible to get stuck in "Running...". Make it possible to cancel the job.
- [x] tabs should not flash after rerunning tests
  - [x] add a tooltip explaining what the color of the input tabs means
- [x] put some default text in the solution pane. Something like `insert into output (progress, result)\nselect 1, 42`. Only include the text in the state/gist if it differs from the default.
- [ ] fix cleanup so that the sqlite.close() in the finally block doesn't explode


## Future Plans

- [x] Execute SQL solutions against puzzle inputs in SQLite
- [x] Display solution results below the editor
- [ ] Share solutions with others via sync
- [ ] Import/export functionality

## Deployment

The app is configured for GitHub Pages deployment. Push to `main` to trigger automatic deployment via the GitHub Actions workflow in `.github/workflows/deploy.yml`.

To enable GitHub Pages:
1. Go to your repo Settings → Pages
2. Set Source to "GitHub Actions"

## Project Structure

```
src/
├── index.tsx          # Entry point
├── App.tsx            # Main app component
├── index.css          # Global styles
├── components/
│   ├── DaySelector.tsx    # Year/day picker
│   ├── InputPanel.tsx     # Puzzle input editor
│   ├── SolutionPanel.tsx  # Solution code editor
│   └── InputList.tsx      # Saved inputs table
├── livestore/
│   ├── schema.ts      # LiveStore schema (tables, events, materializers)
│   ├── store.ts       # Store initialization
│   └── queries.ts     # Reactive queries
└── livestore.worker.ts # Web worker for LiveStore
```

## License

MIT

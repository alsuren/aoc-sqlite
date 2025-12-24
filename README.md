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

- [x] when deciding which years to render, we should include the current year if we are in November or December of that year.
- [x] year, day and part should be stored in the url
- [x] inputs and solutions should automatically be saved and persisted across refreshes (use a debounce to save when the user stops typing).
- [x] it should be possible to add more than one test input (in "saved inputs")
- [x] add an ability to add test inputs and expected outputs (test outputs will be different for each part of each day, but inputs may be shared)

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

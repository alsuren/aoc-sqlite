# Advent of Code Tracker

A web app for tracking and sharing Advent of Code solutions, built with:
- **[LiveStore](https://docs.livestore.dev/)** - Local-first sync engine with SQLite
- **[SolidJS](https://www.solidjs.com/)** - Reactive UI framework
- **[Bun](https://bun.sh/)** - Fast JavaScript runtime & package manager
- **[Vite](https://vitejs.dev/)** - Build tool

## Features

- 📥 Store puzzle inputs for each day
- 💻 Write and save solutions (SQL initially, more languages later)
- 🔄 Automatic sync across tabs/devices via LiveStore
- 📋 List all saved inputs for quick navigation
- 🎨 AoC-themed dark UI

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

## Future Plans

- [ ] Execute SQL solutions against puzzle inputs in SQLite
- [ ] Display solution results below the editor
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

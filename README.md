# Advent of Code - SQLite Browser Runner

Run your Advent of Code solutions written in SQLite directly in the browser, with progress tracking and persistence.

## Features

- 🚀 Run SQLite solutions entirely in the browser using WASM
- 💾 Optional OPFS persistence (or in-memory fallback)
- 📊 Progress tracking for long-running queries
- 🔄 Automatic re-execution until completion
- 💿 Database download and reset capabilities
- 🧪 Automated testing with Playwright

## Getting Started

### For Writing Solutions

**Recommended workflow:**

1. **Fork this repository** to your own GitHub account
2. **Create a git worktree** for your solutions branch:
   ```bash
   git worktree add ../aoc-solutions
   cd ../aoc-solutions
   ```
3. **Work on your solutions without AI assistance** - While the scaffolding in this repo is almost entirely vibe-coded, Advent of Code is meant to be solved by you! The satisfaction of solving these puzzles yourself is the whole point.
4. Keep your solutions in a separate branch/worktree to avoid accidentally committing them to your public fork

### SQL File Format

Each solution file should follow this format:

```sql
-- Your solution logic here
-- Create tables, do calculations, etc.

-- The final SELECT must return these two columns:
SELECT progress, result;
-- progress: REAL between 0.0 and 1.0 (e.g., 0.5 = 50% complete)
-- result: TEXT or INTEGER with your answer
```

The application will automatically re-run your SQL file until `progress >= 1.0`, allowing you to implement iterative solutions.

### File Structure

Place your SQL solutions in the following structure:
```
/[year]/[day]/[part].sql
```

For example:
- `/2023/01/1.sql` - Year 2023, Day 1, Part 1
- `/2023/01/2.sql` - Year 2023, Day 1, Part 2
- `/2023/25/2.sql` - Year 2023, Day 25, Part 2

Days are zero-padded (01-25), but parts are not (1-2).

## Usage

### Via URL Parameters

Navigate to:
```
http://localhost:8000/?year=2023&day=1&part=1
```

Or use the clickable interface to select year, day, and part.

### Controls

- **Run** - Execute the SQL file
- **Stop** - Stop execution (if running)
- **Reset Database** - Clear all data and start fresh
- **Download Database** - Save your database file (with all results)

## Development

```bash
# Install dependencies
make install

# Run tests (uses port 8001)
make test

# Start development server with hot-reload (port 8000)
make serve
# Then open http://localhost:8000
# File changes automatically reload the page!
```

**Working on solutions and framework simultaneously:**
```bash
# Terminal 1 (solutions worktree):
cd ../aoc-solutions
make serve  # Runs on http://localhost:8000

# Terminal 2 (framework worktree):
cd ../aoc-sqlite
make test   # Tests run on http://localhost:8001 (no conflict!)
```

## Testing

The test suite uses year 1970 for fixtures to avoid confusion with actual AoC years.

```bash
# Run all tests
make test

# Run tests with UI for debugging
make test-ui

# Clean up test artifacts
make clean
```

## Why SQLite?

SQLite is a powerful database that supports:
- Recursive CTEs for complex iterations
- JSON functions for data manipulation
- Window functions for analytics
- Full-text search
- And much more!

Many Advent of Code puzzles can be elegantly solved using SQL, making this a fun challenge to think differently about problem-solving.

## Contributing

This is the application framework. Your puzzle solutions should live in your own fork/branch.

If you want to contribute to the application itself, please open an issue or PR.

## License

MIT

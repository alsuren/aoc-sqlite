# Advent of Code SQLite Browser App - Implementation Plan

## Overview
Build a vanilla JavaScript application that runs Advent of Code solutions written in SQLite directly in the browser, with optional OPFS persistence and progress tracking.

## Project Structure
```
/
├── index.html          # Main HTML file
├── src/                # Application source code
│   ├── app.js          # Core application logic
│   ├── sql-runner.js   # SQLite WASM integration
│   ├── ui.js           # UI rendering and interactions
│   ├── db-manager.js   # Database state management (OPFS/in-memory)
│   └── styles.css      # Basic styling
├── sqlite/             # Vendored SQLite WASM files
│   ├── sqlite3.js
│   ├── sqlite3.wasm
│   └── sqlite3-opfs-async-proxy.js (if using OPFS)
├── tests/              # Automated tests
│   ├── smoke.spec.js   # Basic smoke tests
│   └── fixtures/       # Test SQL files
│       ├── 2025/01/1.sql  # Simple instant test
│       ├── 2025/01/2.sql  # Progressive test
│       └── 2025/02/1.sql  # Error case test
├── Makefile            # Build and test automation
├── package.json        # Node.js dependencies (Playwright, etc.)
├── playwright.config.js # Playwright configuration
└── [year]/[day]/[part].sql  # Solution files (user-provided)
```

## Implementation Phases

### Phase 1: Project Setup & SQLite WASM Integration & Test Infrastructure
- [ ] Create `package.json` with Playwright and dev server dependencies
- [ ] Create `Makefile` with targets: `test`, `serve`, `install`, `clean`
- [ ] Create `playwright.config.js` for test configuration
- [ ] Set up `tests/smoke.spec.js` with initial placeholder tests
- [ ] Create test fixture SQL files in `tests/fixtures/`
- [ ] Create basic `index.html` with minimal structure
- [ ] Download and vendor official SQLite WASM build from sqlite.org
- [ ] Create `sql-runner.js` to initialize SQLite WASM
- [ ] Implement OPFS-based persistence with fallback to in-memory
- [ ] Write smoke tests for SQLite initialization:
  - Test SQLite loads without errors
  - Test simple query execution (`SELECT 1 + 1`)
  - Test that in-memory mode works
- [ ] Verify `make test` runs successfully

### Phase 2: URL Parameter Parsing & Navigation
- [ ] Create `app.js` with URL query parameter parsing (`?year=$y&day=$d&part=$p`)
- [ ] Implement navigation state management
- [ ] Create UI components in `ui.js`:
  - Year selector (showing clickable list of years)
  - Day selector (1-25 for selected year)
  - Part selector (1-2 for selected day)
- [ ] Add URL updating when user clicks navigation elements
- [ ] Handle zero-padding for day numbers in URLs (e.g., `/2025/01/1.sql`)
- [ ] Add tests for navigation and URL parameter parsing
- [ ] Run `make test` to verify

### Phase 3: SQL File Loading & Execution
- [ ] Implement SQL file fetching from `/$y/$d/$p.sql` path
- [ ] Handle fetch errors gracefully (file not found, network errors)
- [ ] Parse and execute SQL statements
- [ ] Capture and display SQL notices/errors in UI
- [ ] Extract `(progress, result)` from the last SELECT statement result
- [ ] Display progress and result in the UI
- [ ] Add tests using fixture SQL files:
  - Test successful SQL file loading and execution
  - Test error handling for missing files
  - Test progress/result extraction
- [ ] Run `make test` to verify

### Phase 4: Progress Loop & Re-execution
- [ ] Implement progress checking logic:
  - If `progress < 1.0`: automatically re-run the SQL file
  - If `progress == 1.0`: stop execution and save result
- [ ] Add visual feedback for running queries (loading spinner, progress bar)
- [ ] Implement frame-wait between re-runs (using requestAnimationFrame)
- [ ] Add manual "Run" and "Stop" buttons for user control
- [ ] Add test with progressive fixture (0.0 → 0.5 → 1.0)
- [ ] Run `make test` to verify loop behavior

### Phase 5: Results Table & Persistence
- [ ] Create `results` table schema: `(year, day, part, progress, result, timestamp)`
- [ ] Implement result recording when `progress == 1.0`
- [ ] Display saved results in the UI (history/results view)
- [ ] Allow navigation to previously completed puzzles
- [ ] Show completion status indicators in navigation
- [ ] Add tests for result persistence
- [ ] Run `make test` to verify

### Phase 6: Database Management Controls
- [ ] Add "Reset Database" button to clear all SQLite state
- [ ] Implement confirmation dialog before reset
- [ ] Add "Download Database" button to save `.sqlite` file
- [ ] Maintain file handle for easy re-saving when progress is made
- [ ] Add "Import Database" button to restore from file (optional)
- [ ] Show current database size/statistics
- [ ] Add tests for reset and download functionality
- [ ] Run `make test` to verify

### Phase 7: UI Polish & Error Handling
- [ ] Create `styles.css` with clean, minimal design
- [ ] Add responsive layout for mobile devices
- [ ] Implement comprehensive error handling:
  - Missing SQL files
  - Malformed SQL
  - Invalid progress values
  - SQLite errors
- [ ] Add helpful error messages and recovery suggestions
- [ ] Implement console logging for debugging

### Phase 8: GitHub Pages Deployment
- [ ] Create `.github/workflows/ci.yml` for running tests on push/PR
- [ ] Create `.github/workflows/deploy.yml` for automated deployment (after tests pass)
- [ ] Configure GitHub Pages settings
- [ ] Test deployment and ensure all paths work correctly
- [ ] Create README.md with usage instructions
- [ ] Add example SQL file structure documentation
- [ ] Document `make test` workflow for contributors

## Technical Decisions

### SQLite WASM Build
- Use official build from https://sqlite.org/download.html
- Vendor files locally to avoid CDN dependencies
- Use OPFS for persistence with graceful fallback to in-memory

### SQL Execution Model
- Run all SQL on main thread (simpler, acceptable for AoC workloads)
- Execute entire `.sql` file on each iteration (stateless approach)
- Each SQL file should be self-contained (setup + solution)

### Progress Protocol
- SQL files must return a single row: `SELECT progress, result`
- `progress`: REAL between 0.0 and 1.0 (0.5 = 50% complete)
- `result`: TEXT/INTEGER with the puzzle answer
- Loop continues while `progress < 1.0`

### Results Table
```sql
CREATE TABLE IF NOT EXISTS results (
  year INTEGER NOT NULL,
  day INTEGER NOT NULL,
  part INTEGER NOT NULL,
  progress REAL NOT NULL,
  result TEXT,
  timestamp INTEGER NOT NULL,
  PRIMARY KEY (year, day, part)
);
```

## Testing Strategy

### Automated Testing with Playwright
**Primary workflow: `make test`**
- Sets up Playwright with Chromium (headless by default)
- Starts local dev server automatically
- Runs smoke tests covering core functionality:
  1. SQLite initialization and basic queries
  2. In-memory database operations
  3. Navigation and URL parameter parsing
  4. SQL file loading and execution
  5. Progress loop behavior
  6. Results table persistence
  7. Database reset functionality
  8. Download functionality (file creation)

**Test Fixtures:**
- `tests/fixtures/2025/01/1.sql` - Simple instant query (returns `1.0, "42"`)
- `tests/fixtures/2025/01/2.sql` - Progressive query (uses counter, increments progress)
- `tests/fixtures/2025/02/1.sql` - Error case (syntax error or no result row)

**Makefile Targets:**
- `make install` - Install npm dependencies (Playwright)
- `make test` - Run automated tests
- `make test-ui` - Run tests with Playwright UI for debugging
- `make serve` - Start development server manually
- `make clean` - Clean up generated files

### Manual Testing
- OPFS persistence testing requires manual verification (Chromium headless doesn't support OPFS)
- Use `make serve` to run local server for manual testing
- Test OPFS in real browser: create data, close tab, reopen, verify persistence

### CI Integration
- GitHub Actions will run `make test` on every push
- Deploy workflow runs after tests pass

## Open Questions / Considerations
- Should there be a rate limit on re-execution to prevent browser freezing? - no, as long as we wait for at least one frame before starting the next run, we should be fine
- Should we add a max iterations limit as a safety mechanism? - no. We could potentially guard against progress not going up though (might need to split into progress_done and progress_todo at this point though)
- Do we need to handle multi-statement SQL files specially? - I honestly don't know if sqlite can ingest multi-statement expressions gracefully. I know that workerd carries some patches to make this possible, but it might be possible to just dump the whole file in in one go?
- Should we show intermediate progress in the UI during long-running queries? - no.
- Should the results table persist the SQL file content for reproducibility? - no.

## Success Criteria
- ✅ Can navigate via URL parameters or clickable interface
- ✅ Can fetch and execute SQL files
- ✅ Progress loop works correctly
- ✅ Results are persisted to database when complete
- ✅ Can reset and download database
- ✅ Deploys successfully to GitHub Pages
- ✅ Works in modern browsers (Chrome, Firefox, Safari)

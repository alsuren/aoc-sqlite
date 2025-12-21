// Main application logic
import { initSQLite, executeSQL, saveResult, getDB } from './sql-runner.js';
import { handleResetDatabase, handleDownloadDatabase } from './db-manager.js';
import * as ui from './ui.js';

let isRunning = false;
let shouldStop = false;

/**
 * Parse URL parameters
 */
function parseURLParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        year: params.get('year') ? parseInt(params.get('year')) : null,
        day: params.get('day') ? parseInt(params.get('day')) : null,
        part: params.get('part') ? parseInt(params.get('part')) : null
    };
}

/**
 * Load and execute SQL file
 */
async function loadAndExecuteSQL(year, day, part) {
    // Zero-pad day if needed
    const dayStr = day.toString().padStart(2, '0');
    const sqlUrl = `/puzzles/${year}/${dayStr}/${part}.sql`;
    const inputUrl = `/puzzles/${year}/${dayStr}/${part}-test-input.txt`;

    ui.appendOutput(`Loading ${sqlUrl}...`);

    try {
        // Load SQL file
        const sqlResponse = await fetch(sqlUrl);
        if (!sqlResponse.ok) {
            throw new Error(`Failed to load ${sqlUrl}: ${sqlResponse.statusText}`);
        }
        const sql = await sqlResponse.text();

        // Load input file and populate input_data table
        ui.appendOutput(`Loading ${inputUrl}...`);
        const inputResponse = await fetch(inputUrl);
        if (inputResponse.ok) {
            const inputText = await inputResponse.text();
            const lines = inputText.split('\n').filter(line => line.length > 0);
            
            // Clear and populate input_data table
            const db = getDB();
            db.exec('DELETE FROM input_data');
            for (const line of lines) {
                // Escape single quotes in the line
                const escapedLine = line.replace(/'/g, "''");
                db.exec(`INSERT INTO input_data (line) VALUES ('${escapedLine}')`);
            }
        }

        ui.appendOutput(`Executing SQL...`);

        const result = await executeSQL(sql);

        if (!result.success) {
            ui.showError(result.error);
            return { success: false, error: result.error };
        }

        // Log debug rows if present
        if (result.debugRows && result.debugRows.length > 0) {
            for (const debugRow of result.debugRows) {
                ui.appendOutput(`Debug: Progress: ${Math.round(debugRow.progress * 100)}%, Result: ${debugRow.result}`);
            }
        }

        // Extract progress and result from last row
        const lastRow = result.lastRow;
        if (!lastRow || typeof lastRow.progress === 'undefined') {
            // No final result yet (still in progress)
            return { success: true, progress: 0, result: null };
        }

        const progress = parseFloat(lastRow.progress);
        const resultValue = lastRow.result;

        ui.updateProgress(progress);
        ui.updateResult(resultValue);
        ui.appendOutput(`Progress: ${Math.round(progress * 100)}%, Result: ${resultValue}`);

        return { success: true, progress, result: resultValue };
    } catch (error) {
        ui.showError(error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Run puzzle with progress loop
 */
async function runPuzzle(year, day, part) {
    if (isRunning) {
        return;
    }

    isRunning = true;
    shouldStop = false;

    document.getElementById('run-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;

    ui.clearOutput();
    ui.clearError();
    ui.updateProgress(0);
    ui.updateResult('-');

    let iterations = 0;
    const maxIterations = 1000; // Safety limit

    while (!shouldStop && iterations < maxIterations) {
        iterations++;

        const result = await loadAndExecuteSQL(year, day, part);

        if (!result.success) {
            break;
        }

        if (result.progress >= 1.0) {
            // Completed!
            ui.appendOutput('✓ Completed!');
            await saveResult(year, day, part, result.progress, result.result);
            ui.markCompletedPuzzles();
            break;
        }

        // Wait for next frame before continuing
        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    if (iterations >= maxIterations) {
        ui.showError('Maximum iterations reached (safety limit)');
    }

    isRunning = false;
    document.getElementById('run-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
}

/**
 * Stop the running puzzle
 */
function stopPuzzle() {
    shouldStop = true;
    ui.appendOutput('Stopping...');
}

/**
 * Initialize the app
 */
async function init() {
    ui.appendOutput('Initializing SQLite...');

    const initResult = await initSQLite();

    if (!initResult.success) {
        ui.showError(`Failed to initialize SQLite: ${initResult.error}`);
        return;
    }

    ui.appendOutput(`SQLite initialized (${initResult.mode} mode)`);

    const params = parseURLParams();

    // Auto-redirect to part 1 if year and day are specified but part is missing
    if (params.year && params.day && !params.part) {
        window.location.href = `?year=${params.year}&day=${params.day}&part=1`;
        return;
    }

    // Always render navigation to allow quick jumping between puzzles
    ui.renderYearSelector();
    if (params.year) {
        ui.renderDaySelector(params.year);
    }
    if (params.year && params.day) {
        ui.renderPartSelector(params.year, params.day);
        ui.updatePuzzleLink(params.year, params.day);
    }

    // Set up control buttons
    document.getElementById('stop-btn').onclick = stopPuzzle;
    document.getElementById('reset-db-btn').onclick = async () => {
        const result = await handleResetDatabase();
        if (result.success) {
            ui.clearOutput();
            ui.appendOutput(`Database reset (${result.mode} mode)`);
        }
    };
    document.getElementById('download-db-btn').onclick = () => {
        const result = handleDownloadDatabase();
        if (result.success) {
            ui.appendOutput('Database downloaded');
        } else {
            ui.showError(result.error);
        }
    };

    ui.markCompletedPuzzles();

    // If all parameters are present, set up run button and auto-start
    if (params.year && params.day && params.part) {
        ui.appendOutput(`Ready to run: Year ${params.year}, Day ${params.day}, Part ${params.part}`);

        // Set up run button handler
        document.getElementById('run-btn').onclick = () => runPuzzle(params.year, params.day, params.part);

        // Auto-run the puzzle
        runPuzzle(params.year, params.day, params.part);
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
    window.app = {
        parseURLParams,
        loadAndExecuteSQL,
        runPuzzle,
        stopPuzzle
    };
}

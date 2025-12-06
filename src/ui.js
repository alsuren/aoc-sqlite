// UI management - handles rendering and user interactions
import { getCompletedResults } from './sql-runner.js';

/**
 * Update progress display
 */
export function updateProgress(progress) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    if (progressBar && progressText) {
        progressBar.value = progress;
        progressText.textContent = `${Math.round(progress * 100)}%`;
    }
}

/**
 * Update result display
 */
export function updateResult(result) {
    const resultText = document.getElementById('result-text');
    if (resultText) {
        resultText.textContent = result || '-';
    }
}

/**
 * Append to output log
 */
export function appendOutput(text) {
    const outputText = document.getElementById('output-text');
    if (outputText) {
        outputText.textContent += text + '\n';
    }
}

/**
 * Clear output log
 */
export function clearOutput() {
    const outputText = document.getElementById('output-text');
    if (outputText) {
        outputText.textContent = '';
    }
}

/**
 * Show error message
 */
export function showError(error) {
    const errorText = document.getElementById('error-text');
    if (errorText) {
        errorText.textContent = error;
    }
}

/**
 * Clear error message
 */
export function clearError() {
    const errorText = document.getElementById('error-text');
    if (errorText) {
        errorText.textContent = '';
    }
}

/**
 * Render year selector
 */
export function renderYearSelector(years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
    const container = document.getElementById('year-selector');
    if (!container) return;

    container.innerHTML = '<h3>Select Year:</h3>';
    years.forEach(year => {
        const link = document.createElement('a');
        link.href = `?year=${year}`;
        link.className = 'year-link';
        link.textContent = year;
        container.appendChild(link);
    });
}

/**
 * Render day selector
 */
export function renderDaySelector(year) {
    const container = document.getElementById('day-selector');
    if (!container) return;

    container.innerHTML = `<h3>Select Day (${year}):</h3>`;
    for (let day = 1; day <= 25; day++) {
        const link = document.createElement('a');
        link.href = `?year=${year}&day=${day}`;
        link.className = 'day-link';
        link.textContent = day;
        container.appendChild(link);
    }
}

/**
 * Render part selector
 */
export function renderPartSelector(year, day) {
    const container = document.getElementById('part-selector');
    if (!container) return;

    container.innerHTML = `<h3>Select Part (${year}-${day}):</h3>`;
    for (let part = 1; part <= 2; part++) {
        const link = document.createElement('a');
        link.href = `?year=${year}&day=${day}&part=${part}`;
        link.className = 'part-link';
        link.textContent = `Part ${part}`;
        container.appendChild(link);
    }
}

/**
 * Mark completed puzzles in the UI
 */
export function markCompletedPuzzles() {
    const completed = getCompletedResults();
    const completedSet = new Set(completed.map(r => `${r.year}-${r.day}-${r.part}`));

    // Mark links as completed
    document.querySelectorAll('.year-link, .day-link, .part-link').forEach(link => {
        const url = new URL(link.href);
        const year = url.searchParams.get('year');
        const day = url.searchParams.get('day');
        const part = url.searchParams.get('part');

        if (part && completedSet.has(`${year}-${day}-${part}`)) {
            link.classList.add('completed');
        }
    });
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
    window.ui = {
        updateProgress,
        updateResult,
        appendOutput,
        clearOutput,
        showError,
        clearError,
        renderYearSelector,
        renderDaySelector,
        renderPartSelector,
        markCompletedPuzzles
    };
}

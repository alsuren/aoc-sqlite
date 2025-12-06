// Database management - handles reset, download, and state management
import { resetDatabase, exportDatabase } from './sql-runner.js';

/**
 * Reset the database (with confirmation)
 */
export async function handleResetDatabase() {
    if (!confirm('Are you sure you want to reset the database? This will delete all progress.')) {
        return { cancelled: true };
    }

    const result = await resetDatabase();

    if (result.success) {
        console.log('Database reset successfully');
        return { success: true, mode: result.mode };
    } else {
        console.error('Database reset failed:', result.error);
        return { success: false, error: result.error };
    }
}

/**
 * Download the database file
 */
export function handleDownloadDatabase() {
    const data = exportDatabase();

    if (!data) {
        console.error('Failed to export database');
        return { success: false, error: 'Failed to export database' };
    }

    // Create a blob and download it
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aoc-results-${Date.now()}.db`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Database downloaded');
    return { success: true };
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
    window.dbManager = {
        handleResetDatabase,
        handleDownloadDatabase
    };
}

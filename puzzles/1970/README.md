# Test Fixtures

This directory contains test fixtures for the automated test suite.

Year 1970 is used to avoid confusion with actual Advent of Code years (2015-present).


## Purpose

These fixtures are used by the automated test suite in `tests/smoke.spec.js` to verify:
- SQL file loading and execution
- Progress tracking and re-execution loop
- Error handling
- Results persistence

## Test Protocol

All SQL files should return a single row with two columns:
- `progress` (REAL): A value between 0.0 and 1.0 indicating completion status
- `result` (TEXT/INTEGER): The answer or intermediate result

The application will continue re-running the SQL file until `progress >= 1.0`.

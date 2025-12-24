import {
  Events,
  makeSchema,
  Schema,
  SessionIdSymbol,
  State,
} from '@livestore/livestore'

// Schema for Advent of Code puzzle inputs and solutions
export const tables = {
  // Store puzzle inputs by year/day/name (supports multiple inputs per day)
  inputs: State.SQLite.table({
    name: 'inputs',
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // Format: "2024-01-main" for year 2024, day 1, name "main"
      year: State.SQLite.integer({ default: 2024 }),
      day: State.SQLite.integer({ default: 1 }),
      name: State.SQLite.text({ default: 'main' }), // "main" for puzzle input, custom names for test inputs
      input: State.SQLite.text({ default: '' }),
      createdAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
      updatedAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
    },
  }),
  // Store expected outputs for test inputs (per input + part combination)
  expectedOutputs: State.SQLite.table({
    name: 'expectedOutputs',
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // Format: "2024-01-test1-1" for input "2024-01-test1", part 1
      inputId: State.SQLite.text({ default: '' }), // Reference to inputs.id
      part: State.SQLite.integer({ default: 1 }), // 1 or 2
      expectedOutput: State.SQLite.text({ default: '' }),
      createdAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
      updatedAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
    },
  }),
  // Store solutions (code snippets) for each puzzle
  solutions: State.SQLite.table({
    name: 'solutions',
    columns: {
      id: State.SQLite.text({ primaryKey: true }), // Format: "2024-01-1" for year 2024, day 1, part 1
      year: State.SQLite.integer({ default: 2024 }),
      day: State.SQLite.integer({ default: 1 }),
      part: State.SQLite.integer({ default: 1 }), // 1 or 2
      code: State.SQLite.text({ default: '' }),
      language: State.SQLite.text({ default: 'sql' }), // For future: sql, python, etc.
      result: State.SQLite.text({ nullable: true }), // Cached result from execution
      createdAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
      updatedAt: State.SQLite.integer({
        nullable: true,
        schema: Schema.DateFromNumber,
      }),
    },
  }),
  // Client-only UI state
  uiState: State.SQLite.clientDocument({
    name: 'uiState',
    schema: Schema.Struct({
      selectedYear: Schema.Number,
      selectedDay: Schema.Number,
      selectedPart: Schema.Literal(1, 2),
      selectedInputName: Schema.String,
    }),
    default: {
      id: SessionIdSymbol,
      value: {
        selectedYear: 2024,
        selectedDay: 1,
        selectedPart: 1,
        selectedInputName: 'main',
      },
    },
  }),
}

// Events describe data changes
export const events = {
  // Input events
  inputCreated: Events.synced({
    name: 'v1.InputCreated',
    schema: Schema.Struct({
      id: Schema.String,
      year: Schema.Number,
      day: Schema.Number,
      name: Schema.String,
      input: Schema.String,
      createdAt: Schema.Date,
    }),
  }),
  inputDeleted: Events.synced({
    name: 'v1.InputDeleted',
    schema: Schema.Struct({
      id: Schema.String,
    }),
  }),
  inputUpdated: Events.synced({
    name: 'v1.InputUpdated',
    schema: Schema.Struct({
      id: Schema.String,
      input: Schema.String,
      updatedAt: Schema.Date,
    }),
  }),
  // Expected output events
  expectedOutputSet: Events.synced({
    name: 'v1.ExpectedOutputSet',
    schema: Schema.Struct({
      id: Schema.String,
      inputId: Schema.String,
      part: Schema.Literal(1, 2),
      expectedOutput: Schema.String,
      updatedAt: Schema.Date,
    }),
  }),
  expectedOutputDeleted: Events.synced({
    name: 'v1.ExpectedOutputDeleted',
    schema: Schema.Struct({
      id: Schema.String,
    }),
  }),
  // Solution events
  solutionCreated: Events.synced({
    name: 'v1.SolutionCreated',
    schema: Schema.Struct({
      id: Schema.String,
      year: Schema.Number,
      day: Schema.Number,
      part: Schema.Literal(1, 2),
      code: Schema.String,
      language: Schema.String,
      createdAt: Schema.Date,
    }),
  }),
  solutionUpdated: Events.synced({
    name: 'v1.SolutionUpdated',
    schema: Schema.Struct({
      id: Schema.String,
      code: Schema.String,
      updatedAt: Schema.Date,
    }),
  }),
  solutionResultSet: Events.synced({
    name: 'v1.SolutionResultSet',
    schema: Schema.Struct({
      id: Schema.String,
      result: Schema.String,
    }),
  }),
  // UI state
  uiStateSet: tables.uiState.set,
}

// Materializers map events to state
const materializers = State.SQLite.materializers(events, {
  'v1.InputCreated': ({ id, year, day, name, input, createdAt }) =>
    tables.inputs.insert({ id, year, day, name, input, createdAt }),
  'v1.InputUpdated': ({ id, input, updatedAt }) =>
    tables.inputs.update({ input, updatedAt }).where({ id }),
  'v1.InputDeleted': ({ id }) => tables.inputs.delete().where({ id }),
  'v1.ExpectedOutputSet': ({ id, inputId, part, expectedOutput, updatedAt }) =>
    tables.expectedOutputs
      .insert({
        id,
        inputId,
        part,
        expectedOutput,
        updatedAt,
      })
      .onConflict('id', 'replace'),
  'v1.ExpectedOutputDeleted': ({ id }) =>
    tables.expectedOutputs.delete().where({ id }),
  'v1.SolutionCreated': ({ id, year, day, part, code, language, createdAt }) =>
    tables.solutions.insert({ id, year, day, part, code, language, createdAt }),
  'v1.SolutionUpdated': ({ id, code, updatedAt }) =>
    tables.solutions.update({ code, updatedAt }).where({ id }),
  'v1.SolutionResultSet': ({ id, result }) =>
    tables.solutions.update({ result }).where({ id }),
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })

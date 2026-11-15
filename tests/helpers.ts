import initSqlJs, { type Database } from 'sql.js';
import { prepareReadOnlyQuery } from '../src/sql-guard';
import type { QueryResult } from '../src/sql-types';

const SQL = await initSqlJs();

export function openDatabase(schema: string): Database {
  const db = new SQL.Database();
  db.run(schema);
  return db;
}

/** Roda a consulta do mesmo jeito que o worker do site: mesma regra de leitura, mesmo limite de 100 linhas. */
export function run(db: Database, sql: string): QueryResult {
  const statement = db.prepare(prepareReadOnlyQuery(sql));
  const result: QueryResult = { columns: statement.getColumnNames(), values: [] };
  try {
    while (result.values.length < 100 && statement.step()) result.values.push(statement.get() as QueryResult['values'][number]);
  } finally {
    statement.free();
  }
  return result;
}

/** Todas as combinações possíveis de escolhas de uma máscara. */
export function combinations(fields: { slot: string; choices: string[] }[]): Record<string, string>[] {
  return fields.reduce<Record<string, string>[]>(
    (all, field) => all.flatMap(partial => field.choices.map(choice => ({ ...partial, [field.slot]: choice }))),
    [{}]
  );
}

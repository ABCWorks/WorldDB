import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { storySql } from './story-data';
import { practiceSql } from './lesson-data';
import { prepareReadOnlyQuery } from './sql-guard';

type QueryMessage = { id: number; sql: string };
type Result = { columns: string[]; values: (string | number | null)[][] };

// O nome do worker escolhe a base: a do mistério ou a de treino da documentação, sempre em memória e só leitura.
const ready = initSqlJs({ locateFile: () => wasmUrl }).then(SQL => {
  const db = new SQL.Database();
  db.run(self.name === 'practice' ? practiceSql : storySql);
  return db;
});

self.onmessage = async (event: MessageEvent<QueryMessage>) => {
  const { id, sql } = event.data;
  try {
    const db = await ready;
    const trimmed = prepareReadOnlyQuery(sql);
    const statement = db.prepare(trimmed);
    const result: Result = { columns: statement.getColumnNames(), values: [] };
    try {
      while (result.values.length < 100 && statement.step()) {
        result.values.push(statement.get().map(value => value instanceof Uint8Array ? '[dados binários]' : value));
      }
    } finally {
      statement.free();
    }
    self.postMessage({ id, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível executar a consulta.';
    self.postMessage({ id, error: message });
  }
};

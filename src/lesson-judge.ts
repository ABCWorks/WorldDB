import type { Expected } from './lesson-data';
import type { QueryResult } from './sql-types';

export type Verdict =
  | { ok: true }
  | { ok: false; reason: 'columns' | 'empty' | 'more' | 'fewer' | 'different' | 'order' };

// Compara pelo conteúdo das linhas, não pelo nome das colunas: assim aliases (r.nome AS robo)
// e colunas em outra ordem continuam valendo, mas colunas a mais ou a menos não.
const rowKey = (row: unknown[]) => JSON.stringify(row.map(String).sort());

export function judgeResult(result: QueryResult, expected: Expected, ordered: boolean): Verdict {
  if (result.columns.length !== expected.columns.length) return { ok: false, reason: 'columns' };
  if (!result.values.length) return { ok: false, reason: 'empty' };
  const got = result.values.map(rowKey);
  const want = expected.rows.map(rowKey);
  if (got.length > want.length) return { ok: false, reason: 'more' };
  if (got.length < want.length) return { ok: false, reason: 'fewer' };
  if ([...got].sort().join('|') !== [...want].sort().join('|')) return { ok: false, reason: 'different' };
  if (ordered && got.join('|') !== want.join('|')) return { ok: false, reason: 'order' };
  return { ok: true };
}

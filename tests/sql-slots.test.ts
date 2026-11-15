import { describe, expect, it } from 'vitest';
import { createSqlSlot, fillSqlSlots, findSqlSlots, resolveSqlSlots } from '../src/sql-slots';

const source = `SELECT ${createSqlSlot('coluna 1')}, ${createSqlSlot('coluna 2')} FROM t WHERE x = ${createSqlSlot('início')};`;

describe('espaços das máscaras', () => {
  it('encontra os espaços com rótulo, valor e posição', () => {
    const slots = findSqlSlots(source);
    expect(slots.map(slot => slot.label)).toEqual(['coluna 1', 'coluna 2', 'início']);
    expect(slots.every(slot => slot.value === '')).toBe(true);
    expect(source.slice(slots[0].from, slots[0].to)).toBe(createSqlSlot('coluna 1'));
  });

  it('preenche pelo rótulo e resolve para SQL comum', () => {
    const filled = fillSqlSlots(source, { 'coluna 1': 'id', 'início': "'08:40'" });
    expect(findSqlSlots(filled).map(slot => slot.value)).toEqual(['id', '', "'08:40'"]);
    expect(resolveSqlSlots(filled)).toBe("SELECT id,  FROM t WHERE x = '08:40';");
  });

  it('um espaço continua sendo comentário válido para o SQLite', () => {
    expect(createSqlSlot('fim', "'09:00'")).toMatch(/^\/\*.*\*\/$/);
  });
});

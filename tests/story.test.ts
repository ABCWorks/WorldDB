import { describe, expect, it } from 'vitest';
import { relations, storySql, tableGuide } from '../src/story-data';
import { expectedRows, matchingDiscovery, moments } from '../src/story-moments';
import { fillSqlSlots, findSqlSlots, resolveSqlSlots } from '../src/sql-slots';
import { combinations, openDatabase, run } from './helpers';

// Garante que o jogo pode ser vencido: se um registro, uma máscara ou uma resposta esperada mudar
// sem o resto acompanhar, estes testes falham antes de o site ir ao ar.

const db = openDatabase(storySql);
const solves = (sql: string, index: number) => {
  try { return !!matchingDiscovery(run(db, sql), index); } catch { return false; }
};

describe('momentos do Jardim', () => {
  it('são seis, com uma resposta esperada para cada', () => {
    expect(moments).toHaveLength(6);
    expect(expectedRows).toHaveLength(moments.length);
  });

  moments.forEach((moment, index) => {
    describe(`${index + 1}. ${moment.title}`, () => {
      it('a solução de referência fecha a pista', () => {
        expect(solves(moment.solution, index)).toBe(true);
      });

      it('o modelo inicial não entrega a resposta', () => {
        expect(solves(resolveSqlSlots(moment.starter), index)).toBe(false);
        if (moment.free) expect(solves(moment.free, index)).toBe(false);
      });

      it('a solução não fecha a pista de outro momento', () => {
        moments.forEach((_, other) => {
          if (other !== index) expect(solves(moment.solution, other)).toBe(false);
        });
      });

      it('preenche a lacuna e o caderno com o resultado', () => {
        const rows = run(db, moment.solution).values;
        for (const text of [moment.filled(rows), moment.journal(rows)]) {
          expect(text).not.toMatch(/undefined|>\?<|><\/b>/);
        }
      });

      it('só usa tabelas e colunas que existem no mapa', () => {
        for (const name of [...moment.bank.tables, moment.bank.start]) expect(tableGuide.map(table => table.name)).toContain(name);
        const start = tableGuide.find(table => table.name === moment.bank.start)!;
        for (const column of moment.bank.focus) expect(start.columns).toContain(column);
      });

      if (moment.guide) {
        const guide = moment.guide;

        it('a máscara tem um espaço para cada campo', () => {
          expect(findSqlSlots(moment.starter).map(slot => slot.label)).toEqual(guide.fields.map(field => field.slot));
        });

        it('alguma combinação de escolhas resolve, e nem toda combinação resolve', () => {
          const all = combinations(guide.fields);
          const winning = all.filter(values => solves(resolveSqlSlots(fillSqlSlots(moment.starter, values)), index));
          expect(winning.length).toBeGreaterThan(0);
          expect(winning.length).toBeLessThanOrEqual(2);
          expect(winning.length).toBeLessThan(all.length);
        });
      }
    });
  });
});

describe('validação das pistas', () => {
  it('aceita aliases, colunas extras e outra ordem de linhas', () => {
    expect(solves('SELECT nome AS quem, id, papel FROM personagens ORDER BY nome DESC', 0)).toBe(true);
  });

  it('recusa linhas a mais ou a menos', () => {
    expect(solves('SELECT id, nome FROM personagens LIMIT 4', 0)).toBe(false);
    expect(solves('SELECT personagem_id, horario FROM visitas', 1)).toBe(false);
  });
});

describe('base do Jardim', () => {
  it('é somente leitura', () => {
    expect(() => db.run("INSERT INTO locais VALUES (9, 'Intruso', 'x')")).toThrow();
  });

  it('o guia de tabelas bate com o esquema e com a contagem de registros', () => {
    const real = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0].values.map(row => row[0]);
    expect(tableGuide.map(table => table.name).sort()).toEqual(real);
    for (const table of tableGuide) {
      const info = db.exec(`PRAGMA table_info(${table.name})`)[0].values;
      expect(info.map(row => row[1])).toEqual(table.columns);
      expect(table.types).toHaveLength(table.columns.length);
      expect(db.exec(`SELECT COUNT(*) FROM ${table.name}`)[0].values[0][0]).toBe(table.rows);
    }
  });

  it('as relações do diagrama são as chaves estrangeiras reais', () => {
    const real = tableGuide.flatMap(table => (db.exec(`PRAGMA foreign_key_list(${table.name})`)[0]?.values ?? [])
      .map(row => `${table.name}.${row[3]} -> ${row[2]}`));
    expect(relations.map(link => `${link.from}.${link.column} -> ${link.to}`).sort()).toEqual(real.sort());
  });
});

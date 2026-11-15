import { describe, expect, it } from 'vitest';
import { lesson2Examples, lesson2Exercises, practice2Sql } from '../src/lesson-02-data';
import { judgeResult } from '../src/lesson-judge';
import { combinations, openDatabase, run } from './helpers';

const db = openDatabase(practice2Sql);

describe('Documentação 02: exemplos', () => {
  for (const [name, example] of Object.entries(lesson2Examples)) {
    it(`${name} devolve o que a aula mostra`, () => {
      const result = run(db, example.sql);
      expect(result.columns).toEqual(example.expected.columns);
      expect(judgeResult(result, example.expected, !('unordered' in example && example.unordered))).toEqual({ ok: true });
    });
  }
});

describe('Documentação 02: exercícios', () => {
  for (const exercise of lesson2Exercises) {
    describe(exercise.id, () => {
      it('a resposta de referência é aceita', () => {
        expect(judgeResult(run(db, exercise.sql), exercise.expected, exercise.ordered)).toEqual({ ok: true });
      });

      it('o modelo inicial não entrega a resposta', () => {
        let solved = false;
        try { solved = judgeResult(run(db, exercise.starter), exercise.expected, exercise.ordered).ok; } catch { /* Incompleto de propósito. */ }
        expect(solved).toBe(false);
      });

      it('a segunda dica contém a resposta', () => {
        expect(exercise.sql.replace(/\s+/g, ' ')).toContain(exercise.hints[1].replace(/^.*?: /, '').replace(/;$/, '').trim());
      });
    });
  }
});

describe('Documentação 02: base de treino', () => {
  it('é somente leitura', () => {
    expect(() => db.run('DELETE FROM robos')).toThrow();
  });

  it('não menciona o mistério do Jardim', () => {
    for (const word of ['personagens', 'visitas', 'movimentacoes', 'Adão', 'Eva', 'Cobra', 'Pardal', 'fruta']) expect(practice2Sql).not.toContain(word);
  });
});

describe('correção dos exercícios', () => {
  const expected = { columns: ['nome', 'bateria'], rows: [['Zuca', 15], ['Nina', 40]] };
  const verdict = (sql: string, ordered = true) => judgeResult(run(db, sql), expected, ordered);

  it('aceita aliases e colunas em outra ordem', () => {
    expect(verdict('SELECT bateria AS carga, nome AS quem FROM robos ORDER BY bateria LIMIT 2')).toEqual({ ok: true });
  });

  it('explica o que faltou', () => {
    expect(verdict('SELECT * FROM robos ORDER BY bateria LIMIT 2')).toEqual({ ok: false, reason: 'columns' });
    expect(verdict('SELECT nome, bateria FROM robos WHERE bateria > 100')).toEqual({ ok: false, reason: 'empty' });
    expect(verdict('SELECT nome, bateria FROM robos')).toEqual({ ok: false, reason: 'more' });
    expect(verdict('SELECT nome, bateria FROM robos ORDER BY bateria LIMIT 1')).toEqual({ ok: false, reason: 'fewer' });
    expect(verdict('SELECT nome, bateria FROM robos ORDER BY bateria DESC LIMIT 2')).toEqual({ ok: false, reason: 'different' });
    expect(verdict('SELECT nome, bateria FROM robos WHERE bateria <= 40 ORDER BY bateria DESC')).toEqual({ ok: false, reason: 'order' });
    expect(verdict('SELECT nome, bateria FROM robos WHERE bateria <= 40 ORDER BY bateria DESC', false)).toEqual({ ok: true });
  });
});

describe('combinations', () => {
  it('gera o produto das escolhas', () => {
    expect(combinations([{ slot: 'a', choices: ['1', '2'] }, { slot: 'b', choices: ['x'] }])).toEqual([{ a: '1', b: 'x' }, { a: '2', b: 'x' }]);
  });
});

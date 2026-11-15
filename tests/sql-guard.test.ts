import { describe, expect, it } from 'vitest';
import { prepareReadOnlyQuery } from '../src/sql-guard';

describe('prepareReadOnlyQuery', () => {
  it('aceita SELECT e WITH, tirando o ponto e vírgula final', () => {
    expect(prepareReadOnlyQuery('  SELECT 1;  ')).toBe('SELECT 1');
    expect(prepareReadOnlyQuery('with t as (select 1) select * from t')).toBe('with t as (select 1) select * from t');
  });

  it('ignora comentários de ajuda nas pontas', () => {
    expect(prepareReadOnlyQuery('-- bilhete\nSELECT nome FROM robos\n-- outro bilhete')).toBe('SELECT nome FROM robos');
  });

  it('recusa escrita e mais de uma instrução', () => {
    for (const sql of ['DELETE FROM robos', 'DROP TABLE robos', 'PRAGMA query_only = OFF', 'SELECT 1; SELECT 2', 'SELECT 1; DROP TABLE robos;']) {
      expect(() => prepareReadOnlyQuery(sql)).toThrow('Use uma única consulta de leitura');
    }
  });

  it('aceita ponto e vírgula dentro de texto ou comentário', () => {
    expect(prepareReadOnlyQuery("SELECT * FROM robos WHERE nome = 'a;b';")).toBe("SELECT * FROM robos WHERE nome = 'a;b'");
    expect(prepareReadOnlyQuery("SELECT 'it''s; fine'")).toBe("SELECT 'it''s; fine'");
    expect(prepareReadOnlyQuery('SELECT 1 -- um; dois\nFROM robos')).toBe('SELECT 1 -- um; dois\nFROM robos');
  });

  it('não se deixa enganar por aspas dentro de comentário', () => {
    expect(() => prepareReadOnlyQuery("SELECT 1 -- it's\n; DROP TABLE robos; --'")).toThrow();
  });

  it('recusa consultas longas demais', () => {
    expect(() => prepareReadOnlyQuery(`SELECT '${'x'.repeat(2500)}'`)).toThrow('Consulta muito longa');
  });
});

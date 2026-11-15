import type { Exercise, LessonQuery } from './lesson-data';

// Base de treino da Documentação 02. Os robôs são os mesmos da 01, agora com salas e turnos,
// para treinar filtros combinados e junções sem mostrar nada do mistério do Jardim.
export const practice2Sql = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE robos (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    tarefa TEXT NOT NULL,
    bateria INTEGER NOT NULL,
    cor TEXT NOT NULL
  );
  CREATE TABLE salas (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    andar INTEGER NOT NULL
  );
  CREATE TABLE turnos (
    id INTEGER PRIMARY KEY,
    robo_id INTEGER NOT NULL REFERENCES robos(id),
    sala_id INTEGER NOT NULL REFERENCES salas(id),
    horario TEXT NOT NULL
  );

  INSERT INTO robos VALUES
    (1, 'Bip', 'varre bits caídos', 72, 'azul'),
    (2, 'Zuca', 'conta estrelas', 15, 'amarelo'),
    (3, 'Tico', 'serve café quente', 98, 'verde'),
    (4, 'Nina', 'dobra mapas', 40, 'azul'),
    (5, 'Dudu', 'canta no backup', 63, 'laranja');

  INSERT INTO salas VALUES
    (1, 'Arquivo', 0),
    (2, 'Cafeteria', 1),
    (3, 'Observatório', 2);

  INSERT INTO turnos VALUES
    (1, 1, 1, '07:30'),
    (2, 3, 2, '08:00'),
    (3, 2, 3, '08:20'),
    (4, 4, 1, '08:45'),
    (5, 5, 1, '09:10'),
    (6, 3, 2, '09:30'),
    (7, 1, 3, '10:15');

  PRAGMA query_only = ON;
`;

// Cada exemplo mostrado na aula, com o resultado que o SQLite precisa devolver (tests/lesson-02.test.ts confere).
export const lesson2Examples = {
  robos: {
    sql: 'SELECT id, nome, bateria, cor FROM robos;',
    expected: { columns: ['id', 'nome', 'bateria', 'cor'], rows: [[1, 'Bip', 72, 'azul'], [2, 'Zuca', 15, 'amarelo'], [3, 'Tico', 98, 'verde'], [4, 'Nina', 40, 'azul'], [5, 'Dudu', 63, 'laranja']] },
    unordered: true
  },
  salas: {
    sql: 'SELECT * FROM salas;',
    expected: { columns: ['id', 'nome', 'andar'], rows: [[1, 'Arquivo', 0], [2, 'Cafeteria', 1], [3, 'Observatório', 2]] },
    unordered: true
  },
  turnos: {
    sql: 'SELECT * FROM turnos;',
    expected: { columns: ['id', 'robo_id', 'sala_id', 'horario'], rows: [[1, 1, 1, '07:30'], [2, 3, 2, '08:00'], [3, 2, 3, '08:20'], [4, 4, 1, '08:45'], [5, 5, 1, '09:10'], [6, 3, 2, '09:30'], [7, 1, 3, '10:15']] },
    unordered: true
  },
  and: {
    sql: "SELECT nome, bateria\nFROM robos\nWHERE cor = 'azul'\n  AND bateria > 50;",
    expected: { columns: ['nome', 'bateria'], rows: [['Bip', 72]] }
  },
  between: {
    sql: "SELECT robo_id, horario\nFROM turnos\nWHERE horario BETWEEN '08:00' AND '09:00';",
    expected: { columns: ['robo_id', 'horario'], rows: [[3, '08:00'], [2, '08:20'], [4, '08:45']] },
    unordered: true
  },
  limit: {
    sql: 'SELECT nome, bateria\nFROM robos\nORDER BY bateria DESC\nLIMIT 1;',
    expected: { columns: ['nome', 'bateria'], rows: [['Tico', 98]] }
  },
  join: {
    sql: 'SELECT robos.nome, turnos.horario\nFROM turnos\nJOIN robos ON turnos.robo_id = robos.id;',
    expected: { columns: ['nome', 'horario'], rows: [['Bip', '07:30'], ['Tico', '08:00'], ['Zuca', '08:20'], ['Nina', '08:45'], ['Dudu', '09:10'], ['Tico', '09:30'], ['Bip', '10:15']] },
    unordered: true
  },
  joinAll: {
    sql: "SELECT r.nome, s.nome, t.horario\nFROM turnos t\nJOIN robos r ON t.robo_id = r.id\nJOIN salas s ON t.sala_id = s.id\nWHERE s.nome = 'Arquivo';",
    expected: { columns: ['nome', 'nome', 'horario'], rows: [['Bip', 'Arquivo', '07:30'], ['Nina', 'Arquivo', '08:45'], ['Dudu', 'Arquivo', '09:10']] },
    unordered: true
  }
} satisfies Record<string, LessonQuery>;

export const lesson2Exercises: Exercise[] = [
  {
    id: 'dois-filtros',
    task: 'Mostre <b>nome</b> e <b>bateria</b> dos robôs <b>azuis</b> com bateria <b>abaixo de 50</b>.',
    starter: "SELECT nome, bateria\nFROM robos\nWHERE cor = 'azul'\n  AND ",
    sql: "SELECT nome, bateria FROM robos WHERE cor = 'azul' AND bateria < 50;",
    expected: { columns: ['nome', 'bateria'], rows: [['Nina', 40]] },
    ordered: false,
    hints: ['Depois do AND vem a segunda condição. “Abaixo de” é o sinal <.', 'Complete assim: AND bateria < 50;'],
    success: 'Duas condições, uma robô: Nina precisa de tomada.',
    tokens: ['bateria', '<', '>', '50', ';']
  },
  {
    id: 'intervalo',
    task: 'Mostre <b>robo_id</b> e <b>horario</b> dos turnos que começaram entre <b>09:00</b> e <b>10:00</b>.',
    starter: 'SELECT robo_id, horario\nFROM turnos\nWHERE horario BETWEEN ',
    sql: "SELECT robo_id, horario FROM turnos WHERE horario BETWEEN '09:00' AND '10:00';",
    expected: { columns: ['robo_id', 'horario'], rows: [[5, '09:10'], [3, '09:30']] },
    ordered: false,
    hints: ['BETWEEN pede dois valores com AND no meio. Horários são textos: vão entre aspas simples.', "Complete assim: BETWEEN '09:00' AND '10:00';"],
    success: 'Só os turnos dentro do intervalo, com as pontas incluídas.',
    tokens: ["'09:00'", 'AND', "'10:00'", ';']
  },
  {
    id: 'primeiros',
    task: 'Mostre <b>nome</b> e <b>bateria</b> dos <b>dois</b> robôs com menos bateria, do mais vazio para o mais cheio.',
    starter: 'SELECT nome, bateria\nFROM robos\n',
    sql: 'SELECT nome, bateria FROM robos ORDER BY bateria ASC LIMIT 2;',
    expected: { columns: ['nome', 'bateria'], rows: [['Zuca', 15], ['Nina', 40]] },
    ordered: true,
    hints: ['Primeiro ordene por bateria, do menor para o maior. Depois limite a quantidade de linhas.', 'ORDER BY bateria ASC LIMIT 2;'],
    success: 'Os dois que vão primeiro para a tomada.',
    tokens: ['ORDER BY', 'bateria', 'ASC', 'DESC', 'LIMIT', '2', ';']
  },
  {
    id: 'juntar',
    task: 'Mostre o <b>nome da sala</b> e o <b>horario</b> de cada turno, juntando <code>turnos</code> com <code>salas</code>.',
    starter: 'SELECT salas.nome, turnos.horario\nFROM turnos\nJOIN salas ON ',
    sql: 'SELECT salas.nome, turnos.horario FROM turnos JOIN salas ON turnos.sala_id = salas.id;',
    expected: { columns: ['nome', 'horario'], rows: [['Arquivo', '07:30'], ['Cafeteria', '08:00'], ['Observatório', '08:20'], ['Arquivo', '08:45'], ['Arquivo', '09:10'], ['Cafeteria', '09:30'], ['Observatório', '10:15']] },
    ordered: false,
    hints: ['Depois do ON vai o par de colunas que liga as tabelas: a que termina em _id e o id da outra.', 'Complete assim: ON turnos.sala_id = salas.id;'],
    success: 'Cada número de sala virou um nome.',
    tokens: ['turnos.sala_id', '=', 'salas.id', ';']
  },
  {
    id: 'tres-tabelas',
    task: 'Quem trabalhou no <b>Observatório</b>, e a que horas? Mostre nome do robô, nome da sala e horário.',
    starter: 'SELECT r.nome, s.nome, t.horario\nFROM turnos t\nJOIN robos r ON t.robo_id = r.id\n-- falta juntar salas s e filtrar pelo nome da sala',
    sql: "SELECT r.nome, s.nome, t.horario FROM turnos t JOIN robos r ON t.robo_id = r.id JOIN salas s ON t.sala_id = s.id WHERE s.nome = 'Observatório';",
    expected: { columns: ['nome', 'nome', 'horario'], rows: [['Zuca', 'Observatório', '08:20'], ['Bip', 'Observatório', '10:15']] },
    ordered: false,
    hints: ['Acrescente JOIN salas s ON t.sala_id = s.id. O filtro WHERE vem depois de todos os JOINs.', "JOIN salas s ON t.sala_id = s.id WHERE s.nome = 'Observatório';"],
    success: 'Três tabelas, uma resposta só. É exatamente isso que fecha o caso no Jardim.',
    tokens: ['JOIN salas s', 'ON', 't.sala_id = s.id', 'WHERE', 's.nome', '=', "'Observatório'", ';']
  }
];

import { escapeHtml } from './html';
import { createSqlSlot, type SqlAssist } from './sql-slots';
import type { Cell, QueryResult } from './sql-types';

// Conteúdo de "O caso da fruta desaparecida": os seis momentos, o que cada um espera e como conferir.
// Não toca o DOM nem o editor, então tests/story.test.ts roda tudo contra o SQLite de verdade.

export type Discovery = { rows: Cell[][]; columns?: string[] };
export type Line = { speaker: string; text: string };
export type Moment = {
  skill: string; scene: string; title: string;
  tag: string; revealTag: string;
  narration: string; lines: Line[];
  after: { narration: string; line: Line };
  question: string; task: string; lesson: string; hints: string[];
  /** Consulta com espaços a preencher; quando há guide, o editor fica travado nos espaços. */
  starter: string; tokens: string[];
  guide?: SqlAssist;
  /** Modelo para quem prefere escrever a consulta inteira em vez de preencher a máscara. */
  free?: string;
  /** Uma resposta válida, conferida pelos testes contra expectedRows. */
  solution: string;
  blank: string; filled: (rows: Cell[][]) => string; journal: (rows: Cell[][]) => string;
  success: string;
  highlight?: { cells: string[]; label: string };
  dim?: { cells: string[]; note: string };
  bank: { tables: string[]; start: string; focus: string[]; note: string };
  nextLabel: string;
};

// A validação olha as células de cada linha, aceitando aliases, colunas extras e outra ordem.
export const expectedRows: string[][][] = [
  [['#1', 'Deus'], ['#2', 'Cobra'], ['#3', 'Adão'], ['#4', 'Eva'], ['#5', 'Pardal']],
  [['#3', '08:35'], ['#2', '08:42'], ['#4', '08:56'], ['#5', '08:58']],
  [['#2', '08:42']],
  [['#5', '08:58']],
  [['fita azul', '09:05']],
  [['Eva', 'fruta dourada', 'Clareira', '08:57', 'Guardou a fruta para a torta surpresa da festa.']]
];

export const isId = (cell: Cell) => /^#\d+$/.test(String(cell));
export const isTime = (cell: Cell) => /^\d\d:\d\d$/.test(String(cell));
export const idOf = (row: Cell[]) => String(row.find(isId) ?? '');
export const timeOf = (row: Cell[]) => String(row.find(isTime) ?? '');
const blank = (size = '____') => `<span class="play-blank">${size}</span>`;
const clue = (value: unknown) => `<b class="play-clue">${escapeHtml(value)}</b>`;
export const code = (value: string) => `<code>${value}</code>`;
export const characterName = (id: string) => expectedRows[0].find(row => row[0] === id)?.[1] ?? '?';
const who = (id: string) => `${id} · ${characterName(id)}`;
export const rowValue = (row: Cell[], wanted: string) => String(row.find(cell => String(cell) === wanted) ?? '');

export function afterAdam(rows: Cell[][]): Cell[] {
  const sorted = [...rows].sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
  return sorted[sorted.findIndex(row => idOf(row) === '#3') + 1] ?? sorted[0];
}

const visitsBank = ['personagens', 'locais', 'visitas'];

export const moments: Moment[] = [
  {
    skill: 'SELECT', scene: 'garden-missing', title: 'O livro de convidados',
    tag: '08:30 · Portão', revealTag: '✦ Livro aberto',
    narration: 'Falta pouco para a festa no Jardim. Adão confere a mesa, a cesta e… a fruta dourada não está em lugar nenhum.',
    lines: [
      { speaker: 'Adão', text: '“A festa começa logo e a fruta sumiu. Até meu chapéu está nervoso.”' },
      { speaker: 'Adão', text: '“Antes de desconfiar de alguém, preciso saber quem está no Jardim. O livro de convidados deve ajudar.”' }
    ],
    after: { narration: 'O livro se abre página por página: cinco nomes, cada um com um ID que começa com #.', line: { speaker: 'Adão', text: '“Cinco nomes no livro. Agora vamos ver quem andou pelo Pomar.”' } },
    question: 'Quem está no Jardim hoje?',
    task: `Mostre ${code('id')} e ${code('nome')} de todos os personagens.`,
    lesson: 'SELECT escolhe as colunas; FROM indica de qual tabela elas vêm.',
    hints: ['Comece pela tabela personagens. Procure as colunas id e nome.', 'Uma forma é SELECT id, nome FROM personagens;'],
    starter: `SELECT ${createSqlSlot('coluna 1')}, ${createSqlSlot('coluna 2')}\nFROM personagens;`,
    tokens: ['id', ',', 'nome', 'FROM', ';'],
    solution: 'SELECT id, nome FROM personagens;',
    guide: {
      label: 'Escolha um valor para',
      fields: [
        { slot: 'coluna 1', choices: ['id', 'nome', 'papel', 'apelido'] },
        { slot: 'coluna 2', choices: ['id', 'nome', 'papel', 'apelido'] }
      ]
    },
    blank: `No livro de convidados há ${blank('__')} nomes.`,
    filled: rows => `No livro de convidados há ${clue(rows.length)} nomes.`,
    journal: rows => `Convidados no livro: ${clue(rows.length)}`,
    success: 'Pista encontrada! Cinco convidados no livro, cada um com seu ID.',
    bank: { tables: ['personagens'], start: 'personagens', focus: ['id', 'nome'], note: `Cada linha é um convidado. ${code('id')} e ${code('nome')} já estão aqui.` },
    nextLabel: 'Ir para o Pomar →'
  },
  {
    skill: 'WHERE', scene: 'garden-trail', title: 'Rastros no Pomar',
    tag: '08:35 · Pomar', revealTag: '✦ Rastro revelado',
    narration: 'Adão chega ao Pomar com a cesta da festa. O galho onde a fruta dourada estava pendurada… está vazio.',
    lines: [
      { speaker: 'Adão', text: '“Ontem tinha uma fruta aqui. Hoje tem um cabinho e muita saudade.”' },
      { speaker: 'Adão', text: '“Pegadas! Alguém passou por aqui depois de mim. O livro de visitas do Jardim deve saber quem foi.”' }
    ],
    after: { narration: 'As pegadas brilham no caminho. Entre elas, um rastro sinuoso, como se alguém tivesse passado… deslizando.', line: { speaker: 'Adão', text: '“#2 às 08:42, só sete minutos depois de mim! Mas quem é #2? A tabela de personagens deve saber.”' } },
    question: 'Quem passou pelo Pomar hoje de manhã?',
    task: `Mostre ${code('personagem_id')} e ${code('horario')} das visitas ao Pomar.`,
    lesson: 'WHERE guarda só as linhas que atendem à condição. No mapa, o Pomar tem id 1.',
    hints: ['A tabela visitas guarda personagem_id, local_id e horario.', 'Filtre com WHERE local_id = 1 depois de FROM visitas.'],
    starter: `SELECT personagem_id, horario\nFROM visitas\nWHERE ${createSqlSlot('coluna')} = ${createSqlSlot('valor')};`,
    tokens: ['local_id', '=', '1', 'horario', ';'],
    solution: 'SELECT personagem_id, horario FROM visitas WHERE local_id = 1;',
    guide: {
      label: 'Escolha um valor para',
      fields: [
        { slot: 'coluna', choices: ['personagem_id', 'local_id', 'horario'] },
        { slot: 'valor', choices: ['1', '2', '3'] }
      ]
    },
    blank: `Depois de Adão, o primeiro a passar pelo Pomar foi ${blank()} às ${blank('__:__')}.`,
    filled: rows => { const row = afterAdam(rows); return `Depois de Adão, o primeiro a passar pelo Pomar foi ${clue(idOf(row))} às ${clue(timeOf(row))}.`; },
    journal: rows => { const row = afterAdam(rows); return `Depois de Adão: ${clue(idOf(row))} às ${clue(timeOf(row))}`; },
    success: 'Pista encontrada! 4 passagens pelo Pomar, e uma delas chegou logo depois de Adão.',
    highlight: { cells: ['#2', '08:42'], label: 'PISTA · logo depois de Adão' },
    dim: { cells: ['#3'], note: 'o próprio Adão' },
    bank: { tables: visitsBank, start: 'visitas', focus: ['local_id'], note: `${code('local_id = 1')} aponta para o Pomar em ${code('locais')}.` },
    nextLabel: 'Descobrir quem é #2 →'
  },
  {
    skill: 'WHERE + AND', scene: 'garden-trail', title: 'Cobra, cedo demais?',
    tag: '08:40 – 08:45 · Pomar', revealTag: '✦ Horário confirmado',
    narration: 'O #2 tem nome e chapéu: é a Cobra. Ela chega ao Pomar ajeitando um chapéu verde enorme.',
    lines: [
      { speaker: 'Cobra', text: '“Eu estava lá, sim. Mas fui buscar meu chapéu, não sobremesa!”' },
      { speaker: 'Adão', text: '“Então vamos conferir: quem mais passou pelo Pomar entre 08:40 e 08:45?”' }
    ],
    after: { narration: 'Por alguns minutos, Cobra esteve sozinha no Pomar. Suspeito… ou só coincidência?', line: { speaker: 'Cobra', text: '“Passei cedo, mas isso só prova que estive por ali. Continuem investigando.”' } },
    question: 'Quem esteve no Pomar entre 08:40 e 08:45?',
    task: `Encontre ${code('personagem_id')} e ${code('horario')} de quem passou pelo Pomar entre 08:40 e 08:45.`,
    lesson: 'AND combina condições. BETWEEN inclui os dois horários nas pontas.',
    hints: ['Use visitas e combine local_id = 1 com um intervalo em horario.', "Depois de WHERE local_id = 1, acrescente AND horario BETWEEN '08:40' AND '08:45'."],
    starter: `SELECT personagem_id, horario\nFROM visitas\nWHERE local_id = 1\n  AND ${createSqlSlot('coluna')} BETWEEN ${createSqlSlot('início')} AND ${createSqlSlot('fim')};`,
    tokens: ['horario', 'BETWEEN', "'08:40'", 'AND', "'08:45'"],
    solution: "SELECT personagem_id, horario FROM visitas WHERE local_id = 1 AND horario BETWEEN '08:40' AND '08:45';",
    guide: {
      label: 'Escolha um valor para',
      fields: [
        { slot: 'coluna', choices: ['personagem_id', 'local_id', 'horario'] },
        { slot: 'início', choices: ["'08:35'", "'08:40'", "'08:45'", "'08:58'"] },
        { slot: 'fim', choices: ["'08:35'", "'08:40'", "'08:45'", "'08:58'"] }
      ]
    },
    blank: `Entre 08:40 e 08:45, só ${blank()} passou pelo Pomar.`,
    filled: rows => `Entre 08:40 e 08:45, só ${clue(who(idOf(rows[0])))} passou pelo Pomar.`,
    journal: rows => `Entre 08:40 e 08:45: ${clue(who(idOf(rows[0])))}`,
    success: 'Pista encontrada! Só uma passagem nesse intervalo.',
    highlight: { cells: ['#2'], label: 'PISTA · sozinha no Pomar' },
    bank: { tables: visitsBank, start: 'visitas', focus: ['local_id', 'horario'], note: `${code('horario')} é texto no formato HH:MM, então BETWEEN compara na ordem certa.` },
    nextLabel: 'Quem foi o último? →'
  },
  {
    skill: 'ORDER BY', scene: 'garden-trail', title: 'O último rastro',
    tag: 'Fim da manhã · Pomar', revealTag: '✦ Último rastro',
    narration: 'Um farfalhar no alto: Pardal pousa num galho baixo, meio ofegante.',
    lines: [{ speaker: 'Pardal', text: '“Piu! Fui o último por ali? Isso parece ruim fora de contexto.”' }],
    after: { narration: 'Pardal abre as asas. Presa nas penas, uma pontinha de algo azul.', line: { speaker: 'Pardal', text: '“Fui o último a passar. Eu levava uma coisa azul. Podemos conferir?”' } },
    question: 'Quem foi o último a passar pelo Pomar?',
    task: `Mostre ${code('personagem_id')} e ${code('horario')} da visita mais recente ao Pomar.`,
    lesson: 'ORDER BY horario DESC põe o mais recente primeiro; LIMIT 1 mostra só uma linha.',
    hints: ['O mais recente é o horário mais tarde: ordene por horario do maior para o menor.', 'Use WHERE local_id = 1 ORDER BY horario DESC LIMIT 1.'],
    starter: `SELECT personagem_id, horario\nFROM visitas\nWHERE local_id = 1\nORDER BY ${createSqlSlot('coluna')} ${createSqlSlot('direção')}\nLIMIT ${createSqlSlot('quantas linhas')};`,
    free: 'SELECT personagem_id, horario\nFROM visitas\nWHERE local_id = 1\n-- ordene do mais recente e fique com uma linha',
    tokens: ['ORDER BY', 'horario', 'DESC', 'LIMIT', '1'],
    guide: {
      label: 'Escolha um valor para',
      fields: [
        { slot: 'coluna', choices: ['personagem_id', 'local_id', 'horario'] },
        { slot: 'direção', choices: ['ASC', 'DESC'] },
        { slot: 'quantas linhas', choices: ['1', '2', '4'] }
      ]
    },
    solution: 'SELECT personagem_id, horario FROM visitas WHERE local_id = 1 ORDER BY horario DESC LIMIT 1;',
    blank: `O último rastro no Pomar é de ${blank()} às ${blank('__:__')}.`,
    filled: rows => `O último rastro no Pomar é de ${clue(who(idOf(rows[0])))} às ${clue(timeOf(rows[0]))}.`,
    journal: rows => `Último rastro: ${clue(who(idOf(rows[0])))} às ${clue(timeOf(rows[0]))}`,
    success: 'Pista encontrada! O rastro mais recente do Pomar.',
    highlight: { cells: ['#5'], label: 'PISTA · o último' },
    bank: { tables: visitsBank, start: 'visitas', focus: ['horario'], note: `${code('DESC')} inverte a ordem: o horário mais tarde fica no topo.` },
    nextLabel: 'Conferir o que Pardal levou →'
  },
  {
    skill: 'JOIN', scene: 'garden-missing', title: 'Penas, fita e suspeitas',
    tag: '09:05 · Pomar', revealTag: '✦ Objeto identificado',
    narration: 'No livro de movimentações, cada objeto aparece só como um número. Para saber o que Pardal levou, é preciso traduzir.',
    lines: [{ speaker: 'Pardal', text: '“Todo mundo olha para minhas asas. Era decoração, piu.”' }],
    after: { narration: 'Era só enfeite: a fita azul foi parar na mesa da festa. Mas e a fruta?', line: { speaker: 'Pardal', text: '“Era uma fita azul. Isso explica meu voo, mas ainda precisamos seguir a fruta.”' } },
    question: 'O que Pardal levou às 09:05?',
    task: `Junte ${code('movimentacoes')} a ${code('objetos')} e mostre ${code('nome')} e ${code('horario')} do que #5 levou às 09:05.`,
    lesson: 'JOIN liga movimentacoes.objeto_id a objetos.id. Assim um número vira o nome do objeto.',
    hints: ["Selecione objetos.nome e movimentacoes.horario. Filtre personagem_id = '#5' e horario = '09:05'.", 'Ligue com JOIN objetos ON movimentacoes.objeto_id = objetos.id.'],
    starter: `SELECT objetos.nome, movimentacoes.horario\nFROM movimentacoes\nJOIN objetos ON movimentacoes.${createSqlSlot('chave em movimentacoes')} = objetos.${createSqlSlot('chave em objetos')}\nWHERE movimentacoes.personagem_id = '#5'\n  AND movimentacoes.horario = ${createSqlSlot('horário')};`,
    free: 'SELECT objetos.nome, movimentacoes.horario\nFROM movimentacoes\nJOIN objetos ON \n-- que colunas ligam as duas tabelas?',
    tokens: ['movimentacoes.objeto_id', '=', 'objetos.id', 'WHERE', "'#5'", 'AND', "'09:05'"],
    guide: {
      label: 'Escolha um valor para',
      fields: [
        { slot: 'chave em movimentacoes', choices: ['personagem_id', 'objeto_id', 'destino_id'] },
        { slot: 'chave em objetos', choices: ['id', 'nome', 'detalhe'] },
        { slot: 'horário', choices: ["'08:49'", "'08:58'", "'09:05'"] }
      ]
    },
    solution: "SELECT objetos.nome, movimentacoes.horario FROM movimentacoes JOIN objetos ON movimentacoes.objeto_id = objetos.id WHERE movimentacoes.personagem_id = '#5' AND movimentacoes.horario = '09:05';",
    blank: `Às 09:05, Pardal carregou ${blank('______')}.`,
    filled: rows => `Às 09:05, Pardal carregou ${clue(rowValue(rows[0], 'fita azul'))}.`,
    journal: rows => `Pardal carregou: ${clue(rowValue(rows[0], 'fita azul'))}`,
    success: 'Pista encontrada! O número virou nome de objeto.',
    highlight: { cells: ['fita azul'], label: 'PISTA' },
    bank: { tables: ['personagens', 'objetos', 'movimentacoes'], start: 'movimentacoes', focus: ['objeto_id'], note: `${code('objeto_id')} = ${code('objetos.id')} traduz o número em nome.` },
    nextLabel: 'Seguir a fruta →'
  },
  {
    skill: 'JOIN + pistas', scene: 'garden-missing', title: 'O caminho da fruta',
    tag: 'Hora de fechar o caso', revealTag: '✦ Caso resolvido',
    narration: 'Todas as pistas levam ao livro de movimentações. Só falta ler a linha certa, com nomes em vez de números.',
    lines: [{ speaker: 'Adão', text: '“Se acharmos quem moveu a fruta, para onde e por quê, o caso fecha.”' }],
    after: { narration: 'Na Clareira, a toalha xadrez já cobre a mesa. Ao lado da cesta, um cheirinho de torta.', line: { speaker: 'Adão', text: '“Então era uma surpresa para a festa! Corram: ainda dá tempo de pôr a mesa.”' } },
    question: 'Quem levou a fruta dourada, e para onde?',
    task: `Cruze ${code('movimentacoes')}, ${code('personagens')}, ${code('objetos')} e ${code('locais')}. Mostre nome da pessoa, objeto, destino, ${code('horario')} e ${code('observacao')} da fruta dourada.`,
    lesson: 'Cada JOIN traduz um ID: personagem_id → personagens.id, objeto_id → objetos.id, destino_id → locais.id.',
    hints: ['Comece em movimentacoes. Junte personagens, objetos e locais usando os pares de IDs do mapa.', "Selecione p.nome, o.nome, l.nome, m.horario, m.observacao; filtre WHERE o.nome = 'fruta dourada'."],
    starter: `SELECT p.nome, o.nome, l.nome, m.horario, m.observacao\nFROM movimentacoes m\nJOIN personagens p ON m.${createSqlSlot('chave de personagens')} = p.id\nJOIN objetos o ON m.${createSqlSlot('chave de objetos')} = o.id\nJOIN locais l ON m.${createSqlSlot('chave do destino')} = l.id\nWHERE o.nome = ${createSqlSlot('objeto')};`,
    free: 'SELECT p.nome, o.nome, l.nome, m.horario, m.observacao\nFROM movimentacoes m\n-- três JOINs: personagens p, objetos o, locais l',
    tokens: ['JOIN', 'ON', 'm.personagem_id = p.id', 'm.objeto_id = o.id', 'm.destino_id = l.id', 'WHERE', "'fruta dourada'"],
    guide: {
      label: 'Escolha um valor para',
      fields: [
        { slot: 'chave de personagens', choices: ['personagem_id', 'objeto_id', 'origem_id', 'destino_id'] },
        { slot: 'chave de objetos', choices: ['personagem_id', 'objeto_id', 'origem_id', 'destino_id'] },
        { slot: 'chave do destino', choices: ['personagem_id', 'objeto_id', 'origem_id', 'destino_id'] },
        { slot: 'objeto', choices: ["'fruta dourada'", "'cesta listrada'", "'fita azul'"] }
      ]
    },
    solution: "SELECT p.nome, o.nome, l.nome, m.horario, m.observacao FROM movimentacoes m JOIN personagens p ON m.personagem_id = p.id JOIN objetos o ON m.objeto_id = o.id JOIN locais l ON m.destino_id = l.id WHERE o.nome = 'fruta dourada';",
    blank: `Às ${blank('__:__')}, ${blank()} levou a fruta para ${blank('______')}.`,
    filled: rows => `Às ${clue(rowValue(rows[0], '08:57'))}, ${clue(rowValue(rows[0], 'Eva'))} levou a ${clue(rowValue(rows[0], 'fruta dourada'))} para a ${clue(rowValue(rows[0], 'Clareira'))}.`,
    journal: rows => `A fruta: ${clue(rowValue(rows[0], 'Eva'))} → ${clue(rowValue(rows[0], 'Clareira'))} às ${clue(rowValue(rows[0], '08:57'))}`,
    success: 'Caso resolvido! Os IDs viraram uma história inteira.',
    highlight: { cells: ['Eva'], label: 'PISTA · caso resolvido' },
    bank: { tables: ['personagens', 'objetos', 'locais', 'movimentacoes'], start: 'movimentacoes', focus: ['personagem_id', 'objeto_id', 'destino_id'], note: 'Cada JOIN traduz um ID em nome. Três chaves, três JOINs.' },
    nextLabel: 'Ver a conclusão →'
  }
];

export function matchingDiscovery(result: QueryResult, index: number): Discovery | null {
  const rows = result.values.map(row => row.map(String));
  const expected = expectedRows[index];
  if (rows.length !== expected.length) return null;
  if (!expected.every(required => rows.filter(row => required.every(value => row.includes(value))).length === 1)) return null;
  return { rows: result.values, columns: result.columns };
}

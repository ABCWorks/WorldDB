import { createSqlClient, type Cell, type QueryResult } from './sql-client';
import { destroySqlEditors, editorMarkup, escapeHtml, getSqlEditor, highlightSql, insertToken, mountSqlEditor, setEditorStatus } from './sql-ui';
import { lessonExamples, lessonExercises, missionColumns, type Exercise } from './lesson-data';
import './lesson.css';

// Documentação 01: um prólogo curto que ensina só o necessário para a primeira missão do Jardim.
// Os exemplos e exercícios rodam numa base de treino própria (worker "practice"), sem tocar o jogo.

type ExampleKey = keyof typeof lessonExamples;
type Feedback = { tone: 'success' | 'hint' | 'error' | 'busy'; html: string };
type Saved = { step: number; reached: number; solved: string[]; finished: boolean };
type Table = { columns: string[]; values: Cell[][] };

const storageKey = 'worlddb-lesson-01-v1';
const lessonPath = '/aprender/01';
const database = createSqlClient('practice');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const practiceColumns = lessonExamples.table.expected.columns;
const robots = lessonExamples.table.expected.rows.map(([id, nome, tarefa, bateria, cor]) => ({ id: Number(id), nome: String(nome), tarefa: String(tarefa), bateria: Number(bateria), cor: String(cor) }));
const robotColor = new Map(robots.map(robot => [robot.nome, robot.cor]));
const paint: Record<string, string> = { azul: '#8bcbd9', amarelo: '#ffd45a', verde: '#9dd275', laranja: '#ef9b6b' };

const steps = [
  { short: 'Tabelas', title: 'O mundo como banco de dados' },
  { short: '1ª consulta', title: 'Primeira consulta' },
  { short: 'Colunas', title: 'Escolher colunas' },
  { short: 'Filtro', title: 'Filtrar registros' },
  { short: 'Ordem', title: 'Organizar a resposta' },
  { short: 'Missão', title: 'Preparação para a missão' }
];

const pieces = [
  { token: 'SELECT', target: 'query', text: '“Selecione”, ou “me mostre”. É assim que todo pedido de leitura começa.' },
  { token: '*', target: 'cols', text: 'O asterisco quer dizer “todas as colunas”. Um curinga preguiçoso e muito útil.' },
  { token: 'FROM', target: 'table', text: '“De onde”. Avisa ao banco que o nome de uma tabela vem logo depois.' },
  { token: 'robos', target: 'table', text: 'O nome da tabela, escrito igualzinho: sem acento e sem espaço.' },
  { token: ';', target: 'rows', text: 'O ponto e vírgula fecha o pedido, como o ponto final de uma frase. Pronto: o banco responde.' }
];

let saved = readSaved();
let root: HTMLElement | undefined;
let controller: AbortController | undefined;
const examples = new Map<ExampleKey, QueryResult | Error>();
let examplesRequested = false;
const view = { piece: 0, whereMode: 'text' as 'text' | 'number', order: 'none' as 'none' | 'asc' | 'desc' };
const drafts = new Map<string, string>();
const hintLevel = new Map<string, number>();
const feedback = new Map<string, Feedback>();
// A entrada animada só acontece ao trocar de passo, não a cada clique dentro dele.
let entering = false;

function readSaved(): Saved {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null') as Saved | null;
    if (value && Number.isInteger(value.step) && Array.isArray(value.solved)) {
      const step = Math.min(Math.max(value.step, 0), steps.length - 1);
      return { step, reached: Math.max(step, Number(value.reached) || 0), solved: value.solved.filter(id => typeof id === 'string'), finished: !!value.finished };
    }
  } catch { /* Armazenamento opcional. */ }
  return { step: 0, reached: 0, solved: [], finished: false };
}

function save(): void {
  try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* A aula funciona sem armazenamento. */ }
}

const code = (value: string) => `<code>${escapeHtml(value)}</code>`;

/* ---------- Ilustrações ---------- */

function botShapes(color: string): string {
  return `<path d="M0 -14V-21" stroke="#34364a" stroke-width="2"/><circle cx="0" cy="-23" r="3" fill="#ef9b6b" stroke="#34364a" stroke-width="1.5"/><rect x="-13" y="-14" width="26" height="22" rx="7" fill="${paint[color] ?? '#ded6c8'}" stroke="#34364a" stroke-width="2"/><circle cx="-5" cy="-4" r="2.4" fill="#34364a"/><circle cx="5" cy="-4" r="2.4" fill="#34364a"/><path d="M-5 2q5 4 10 0" fill="none" stroke="#34364a" stroke-width="1.8" stroke-linecap="round"/>`;
}

function robotIcon(name: string, size = 22): string {
  return `<svg class="lesson-bot" viewBox="-16 -28 32 40" width="${size}" height="${Math.round(size * 1.25)}" aria-hidden="true">${botShapes(robotColor.get(name) ?? '')}</svg>`;
}

const bot = (x: number, y: number, color: string, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">${botShapes(color)}</g>`;

// Figura 1: a anatomia de uma tabela (coluna, linha e id).
function tableFigure(): string {
  const cols = [{ name: 'id', x: 14, w: 48 }, { name: 'nome', x: 62, w: 104 }, { name: 'cor', x: 166, w: 96 }];
  const rows = robots.slice(0, 3).map((robot, i) => {
    const y = 74 + i * 32;
    return `${i ? `<line x1="14" y1="${y}" x2="262" y2="${y}" class="fg-sep"/>` : ''}<text x="30" y="${y + 21}" class="fg-mono">${robot.id}</text>${bot(80, y + 21, robot.cor, .55)}<text x="93" y="${y + 21}" class="fg-cell">${robot.nome}</text><circle cx="180" cy="${y + 16}" r="6" fill="${paint[robot.cor]}" stroke="#34364a" stroke-width="1.5"/><text x="192" y="${y + 21}" class="fg-cell">${robot.cor}</text>`;
  }).join('');
  return `<figure class="lesson-figure">
    <svg viewBox="0 0 360 262" role="img" aria-labelledby="fig1-title"><title id="fig1-title">Uma tabela: cada coluna é uma característica, cada linha é um robô e o id é o crachá de cada um.</title>
      <defs><clipPath id="fig1-clip"><rect x="14" y="44" width="248" height="148" rx="10"/></clipPath></defs>
      <rect x="17" y="47" width="248" height="148" rx="10" fill="#34364a"/>
      <g clip-path="url(#fig1-clip)"><rect x="14" y="44" width="248" height="148" fill="#fffdf6"/><rect x="14" y="44" width="248" height="30" fill="#f8e9cb"/>
        <rect x="62" y="44" width="104" height="148" class="fg-col"/><rect x="14" y="106" width="248" height="32" class="fg-row"/>
        ${cols.map(col => `<text x="${col.x + 12}" y="64" class="fg-mono fg-head">${col.name}</text>`).join('')}
        <line x1="62" y1="44" x2="62" y2="192" class="fg-sep"/><line x1="166" y1="44" x2="166" y2="192" class="fg-sep"/>
        ${rows}<line x1="14" y1="170" x2="262" y2="170" class="fg-sep"/><text x="30" y="186" class="fg-mono fg-muted">…</text>
      </g>
      <line x1="14" y1="74" x2="262" y2="74" stroke="#34364a" stroke-width="2"/>
      <rect x="14" y="44" width="248" height="148" rx="10" fill="none" stroke="#34364a" stroke-width="2"/>
      <rect x="14" y="8" width="132" height="24" rx="12" fill="#c5e9f1" stroke="#34364a" stroke-width="1.5"/><text x="80" y="24.5" class="fg-label" text-anchor="middle">id = crachá único</text>
      <path d="M36 32v10" class="fg-arrow"/>
      <rect x="196" y="8" width="118" height="24" rx="12" fill="#ffcf62" stroke="#34364a" stroke-width="1.5"/><text x="255" y="24.5" class="fg-label" text-anchor="middle">tabela robos</text>
      <path d="M114 194v14" class="fg-arrow"/><rect x="22" y="210" width="184" height="26" rx="9" fill="#fff5dc" stroke="#c99c73" stroke-width="1.5" stroke-dasharray="4 3"/><text x="114" y="227.5" class="fg-label" text-anchor="middle">coluna = uma característica</text>
      <path d="M264 122h18" class="fg-arrow"/>${bot(318, 116, 'amarelo', 1.15)}<text x="318" y="148" class="fg-label" text-anchor="middle">linha =</text><text x="318" y="164" class="fg-label" text-anchor="middle">um robô</text>
    </svg>
  </figure>`;
}

// Figura 2: o SELECT pega só as colunas pedidas.
function columnsFigure(): string {
  const cols = [{ name: 'id', w: 44 }, { name: 'nome', w: 70 }, { name: 'tarefa', w: 86 }, { name: 'bateria', w: 76 }, { name: 'cor', w: 56 }];
  const picked = ['nome', 'tarefa'];
  const tone = (name: string, i: number) => picked.includes(name) ? (name === 'nome' ? '#ef9b6b' : '#8bcbd9') : i % 2 ? '#e4ddd0' : '#ebe5d9';
  let x = 14;
  const top = cols.map(col => {
    const cx = x; x += col.w;
    const on = picked.includes(col.name);
    const bars = [0, 1, 2, 3].map(r => `<rect x="${cx + 6}" y="${58 + r * 17}" width="${col.w - 12}" height="10" rx="5" fill="${tone(col.name, r)}"/>`).join('');
    return `<rect x="${cx}" y="20" width="${col.w}" height="110" class="${on ? 'fg-picked' : 'fg-left'}"/><text x="${cx + col.w / 2}" y="40" text-anchor="middle" class="fg-mono ${on ? '' : 'fg-muted'}">${col.name}</text>${bars}`;
  }).join('');
  const result = picked.map((name, i) => {
    const cx = 102 + (i ? 70 : 0), w = i ? 86 : 70;
    const bars = [0, 1, 2, 3].map(r => `<rect x="${cx + 6}" y="${204 + r * 12}" width="${w - 12}" height="8" rx="4" fill="${tone(name, r)}"/>`).join('');
    return `<text x="${cx + w / 2}" y="194" text-anchor="middle" class="fg-mono">${name}</text>${bars}`;
  }).join('');
  return `<figure class="lesson-figure">
    <svg viewBox="0 0 360 262" role="img" aria-labelledby="fig2-title"><title id="fig2-title">Das cinco colunas da tabela, só nome e tarefa seguem para o resultado.</title>
      <rect x="14" y="20" width="332" height="110" rx="10" fill="#fffdf6"/>${top}<line x1="14" y1="48" x2="346" y2="48" stroke="#34364a" stroke-width="2"/><rect x="14" y="20" width="332" height="110" rx="10" fill="none" stroke="#34364a" stroke-width="2"/>
      <path d="M140 134 C140 150 160 150 160 166" class="fg-arrow is-hot"/><path d="M224 134 C224 150 200 150 200 166" class="fg-arrow is-hot"/>
      <rect x="206" y="142" width="144" height="22" rx="11" fill="#34364a"/><text x="278" y="157" text-anchor="middle" class="fg-mono fg-inverse">SELECT nome, tarefa</text>
      <rect x="105" y="179" width="156" height="72" rx="9" fill="#34364a"/><rect x="102" y="176" width="156" height="72" rx="9" fill="#fffdf6" stroke="#34364a" stroke-width="2"/>${result}<line x1="102" y1="200" x2="258" y2="200" stroke="#34364a" stroke-width="1.5"/>
      <text x="16" y="200" class="fg-label">resultado</text><text x="16" y="216" class="fg-small">só o que</text><text x="16" y="230" class="fg-small">foi pedido</text>
    </svg>
  </figure>`;
}

// Figura 3: a lupa do WHERE; as linhas que passam no filtro ganham destaque.
function filterFigure(passing: string[], label: string): string {
  const rows = robots.map((robot, i) => {
    const y = 48 + i * 42;
    const pass = passing.includes(robot.nome);
    return `<g class="${pass ? 'fg-pass' : 'fg-fail'}"><rect x="20" y="${y}" width="264" height="34" rx="9"/>${bot(42, y + 23, robot.cor, .62)}<text x="60" y="${y + 22}" class="fg-cell">${robot.nome}</text><text x="118" y="${y + 22}" class="fg-mono fg-small">id ${robot.id} · ${robot.cor}</text><text x="270" y="${y + 22}" text-anchor="end" class="fg-verdict">${pass ? '✓ passa' : '✕'}</text></g>`;
  }).join('');
  return `<figure class="lesson-figure">
    <svg viewBox="0 0 360 272" role="img" aria-labelledby="fig3-title"><title id="fig3-title">A lupa do filtro: ${passing.join(' e ')} ${passing.length === 1 ? 'passa' : 'passam'} pela condição ${escapeHtml(label)}.</title>
      <rect x="20" y="8" width="210" height="26" rx="13" fill="#34364a"/><text x="125" y="25.5" text-anchor="middle" class="fg-mono fg-inverse">${escapeHtml(label)}</text>
      ${rows}
      <g class="fg-lens"><circle cx="318" cy="${48 + robots.findIndex(robot => passing.includes(robot.nome)) * 42 + 17}" r="26"/><path d="M336 ${48 + robots.findIndex(robot => passing.includes(robot.nome)) * 42 + 36}l14 16"/></g>
    </svg>
  </figure>`;
}

/* ---------- Tabelas de resultado ---------- */

type GridOptions = { label: string; highlightRows?: (row: Cell[]) => boolean; dimOthers?: boolean; highlightCols?: string[]; waiting?: boolean };

function cell(column: string, value: Cell): string {
  if (value === null) return '<span class="play-null">NULL</span>';
  if (column === 'nome' && robotColor.has(String(value))) return `<span class="lesson-name">${robotIcon(String(value))}${escapeHtml(value)}</span>`;
  if (column === 'cor' && paint[String(value)]) return `<span class="lesson-color"><i style="background:${paint[String(value)]}"></i>${escapeHtml(value)}</span>`;
  return escapeHtml(value);
}

function grid(table: Table, options: GridOptions): string {
  const head = table.columns.map(column => `<th scope="col" class="${options.highlightCols?.includes(column) ? 'is-hl' : ''}">${escapeHtml(column)}</th>`).join('');
  const body = table.values.map(row => {
    const hit = options.highlightRows?.(row);
    const state = hit ? 'is-hl' : options.dimOthers ? 'is-out' : '';
    return `<tr class="${state}">${row.map((value, i) => `<td class="${options.highlightCols?.includes(table.columns[i]) ? 'is-hl' : ''}">${cell(table.columns[i], value)}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="lesson-grid-wrap ${options.waiting ? 'is-waiting' : ''}"><table class="lesson-grid" aria-label="${escapeHtml(options.label)}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function answer(key: ExampleKey, options: Omit<GridOptions, 'label'> & { label?: string; title?: string }): string {
  const result = examples.get(key);
  const title = options.title ?? 'O banco responde';
  if (!result) return `<div class="lesson-answer"><span class="section-eyebrow">${title}</span><p class="lesson-loading"><span class="play-spinner" aria-hidden="true"></span> A base de treino está acordando…</p></div>`;
  if (result instanceof Error) return `<div class="lesson-answer"><p class="lesson-feedback is-error">Não consegui rodar este exemplo: ${escapeHtml(result.message)}</p></div>`;
  const count = `${result.values.length} ${result.values.length === 1 ? 'linha' : 'linhas'}`;
  return `<div class="lesson-answer"><span class="section-eyebrow">${title} · ${count}</span>${grid(result, { ...options, label: options.label ?? `Resultado de ${lessonExamples[key].sql}` })}</div>`;
}

function queryBlock(sql: string, caption = 'consulta'): string {
  return `<figure class="lesson-query"><figcaption>${caption}</figcaption><pre><code>${highlightSql(sql)}</code></pre></figure>`;
}

/* ---------- Passos ---------- */

function switchGroup(label: string, act: string, current: string, options: [string, string][]): string {
  return `<div class="lesson-switch" role="group" aria-label="${label}">${options.map(([value, text]) => `<button type="button" data-act="${act}" data-value="${value}" aria-pressed="${value === current}">${text}</button>`).join('')}</div>`;
}

function stepContent(index: number): { text: string; visual: string; exercise?: Exercise } {
  if (index === 0) return {
    text: `<p>E se o mundo fosse um banco de dados? Então tudo estaria guardado em <b>tabelas</b>: coleções de registros do mesmo tipo, como fichas numa gaveta.</p>
      <p>Para treinar, o WorldDB emprestou a tabela ${code('robos')}, com os ajudantes da sala dos servidores. Nenhum deles sabe nada sobre o Jardim. Juram.</p>
      <ul class="lesson-terms">
        <li><b>Coluna</b> é uma característica: ${code('nome')}, ${code('tarefa')}, ${code('bateria')}…</li>
        <li><b>Linha</b> é um registro completo. Aqui, cada linha é um robô.</li>
        <li><b>id</b> é o crachá: um número que nunca se repete. Se dois robôs se chamassem Bip, o id ainda saberia quem é quem.</li>
      </ul>
      ${queryBlock(lessonExamples.table.sql, 'o pedido que trouxe esta tabela')}
      <p class="lesson-aside">Não precisa entender essa frase ainda: no próximo passo, a gente desmonta peça por peça.</p>`,
    visual: `${tableFigure()}${answer('table', {})}`
  };
  if (index === 1) {
    const current = view.piece ? pieces[view.piece - 1] : null;
    const chips = pieces.map((piece, i) => {
      const shown = i < view.piece;
      return `<button type="button" class="lesson-piece ${shown ? 'is-shown' : ''} ${i === view.piece - 1 ? 'is-current' : ''} ${piece.token === ';' ? 'is-glued' : ''}" data-act="piece" data-piece="${i + 1}" ${shown ? `aria-pressed="${i === view.piece - 1}"` : 'disabled aria-label="Peça ainda escondida"'}>${shown ? escapeHtml(piece.token) : '?'}</button>`;
    }).join('');
    const target = current?.target ?? '';
    return {
      text: `<p>Uma consulta é um pedido educado ao banco, escrito em SQL. A mais simples de todas cabe numa linha. Vamos montá-la uma peça de cada vez:</p>
        <div class="lesson-pieces" role="group" aria-label="Peças da consulta">${chips}</div>
        <p class="lesson-piece-note" aria-live="polite">${current ? `<b>${code(current.token)}</b> ${current.text}` : 'Aperte o botão para revelar a primeira peça.'}</p>
        <button type="button" class="outline-button lesson-reveal" data-act="next-piece">${view.piece < pieces.length ? `Mostrar a próxima peça (${view.piece + 1} de ${pieces.length})` : 'Montar de novo'}</button>
        <p class="lesson-aside">Maiúsculas ou minúsculas? ${code('SELECT')} e ${code('select')} funcionam igual. Escrevemos as palavras do SQL em maiúsculas só para elas saltarem aos olhos.</p>`,
      visual: `<span class="lesson-table-tag ${target === 'table' ? 'is-hl' : ''}">tabela robos</span>${answer('table', { highlightCols: target === 'cols' ? [...practiceColumns] : [], highlightRows: target === 'rows' ? () => true : undefined, waiting: view.piece < pieces.length, title: view.piece < pieces.length ? 'A resposta chega quando o pedido fecha' : 'O banco responde' })}`
    };
  }
  if (index === 2) return {
    text: `<p>Nem sempre você quer a ficha inteira. Troque o ${code('*')} pelos nomes das colunas que interessam, separados por vírgula.</p>
      ${queryBlock(lessonExamples.columns.sql)}
      <p>Só as colunas pedidas voltam, na ordem em que você escreveu. As outras continuam guardadas: não somem, só não vieram passear.</p>`,
    visual: `${columnsFigure()}${answer('columns', { highlightCols: ['nome', 'tarefa'] })}`,
    exercise: lessonExercises[0]
  };
  if (index === 3) {
    const key: ExampleKey = view.whereMode === 'text' ? 'whereText' : 'whereNumber';
    const passing = lessonExamples[key].expected.rows.map(row => String(row[0]));
    const condition = view.whereMode === 'text' ? "WHERE cor = 'azul'" : 'WHERE id = 3';
    return {
      text: `<p>${code('WHERE')} é o filtro: só passam as linhas em que a condição é verdadeira. O sinal ${code('=')} pergunta “é igual a?”.</p>
        ${switchGroup('Tipo de valor no filtro', 'where', view.whereMode, [['text', 'Com texto'], ['number', 'Com número']])}
        ${queryBlock(lessonExamples[key].sql)}
        ${view.whereMode === 'text'
          ? `<p><b>Textos</b> vão entre aspas simples: ${code("'azul'")}. Sem as aspas, o banco acha que ${code('azul')} é o nome de uma coluna e fica procurando por ela.</p>`
          : `<p><b>Números</b> vão sem aspas: ${code('3')}. O ${code('id')} é ótimo para filtrar, porque aponta para um único registro.</p>`}
        <p class="lesson-aside">A ordem das peças importa: primeiro ${code('FROM')} (de onde), depois ${code('WHERE')} (o que passa).</p>`,
      visual: `${filterFigure(passing, condition)}${answer(key, {})}`,
      exercise: lessonExercises[1]
    };
  }
  if (index === 4) {
    const key: ExampleKey = view.order === 'asc' ? 'orderAsc' : view.order === 'desc' ? 'orderDesc' : 'orderNone';
    return {
      text: `<p>${code('ORDER BY')} arruma as linhas pela coluna que você escolher.</p>
        <ul class="lesson-terms"><li>${code('ASC')}: crescente, do menor para o maior. É o padrão, então pode até ficar de fora.</li><li>${code('DESC')}: decrescente, do maior para o menor.</li></ul>
        ${switchGroup('Ordem do resultado', 'order', view.order, [['none', 'Sem ORDER BY'], ['asc', 'ASC ↑'], ['desc', 'DESC ↓']])}
        ${queryBlock(lessonExamples[key].sql)}
        <p class="lesson-warning"><b>Sem ${code('ORDER BY')}, a ordem não é garantida.</b> Hoje o banco devolveu assim; com mais dados, pode vir diferente. Se a ordem importa, peça.</p>`,
      visual: raceFigure(key),
      exercise: lessonExercises[2]
    };
  }
  return {
    text: `<p>Hora de trocar os robôs pelo Jardim do Éden. A primeira pista mora na tabela ${code('personagens')}, e estas são as colunas que você vai encontrar lá.</p>
      <p>Os registros? Esses ficam guardados. Quem aparece nessa tabela é justamente a sua primeira descoberta.</p>
      <h3 class="lesson-subhead">Um bilhete antes de entrar</h3>
      <p>No jogo, o editor às vezes já vem com linhas que começam com ${code('--')}. São comentários: bilhetinhos para você. O banco pula essas linhas.</p>
      ${queryBlock(lessonExamples.comment.sql)}
      <p>Para rodar a consulta, use o botão <b>Executar consulta</b> ou <kbd>Ctrl</kbd> + <kbd>Enter</kbd>. Travou? Sempre tem o <b>Preciso de uma dica</b>.</p>`,
    visual: `<figure class="lesson-mission" aria-labelledby="mission-title"><span class="section-eyebrow">Sua primeira missão usa</span><h3 id="mission-title"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" fill="#9dd275" stroke="#34364a" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 20 14 10" stroke="#34364a" stroke-width="1.8" stroke-linecap="round"/></svg> tabela personagens</h3><ul>${missionColumns.map(column => `<li><code>${column.name}</code><span>${column.meaning}</span><small>${column.type}</small></li>`).join('')}</ul><figcaption>Sem registros por aqui: o Jardim guarda os nomes até você perguntar.</figcaption></figure>${answer('comment', { title: 'O comentário não atrapalha' })}`
  };
}

function raceFigure(key: ExampleKey): string {
  const result = examples.get(key);
  const rows = result && !(result instanceof Error) ? result.values : lessonExamples[key].expected.rows;
  const items = rows.map((row, i) => {
    const name = String(row[0]), battery = Number(row[1]);
    return `<li data-key="${escapeHtml(name)}"><span class="lesson-race-pos">${i + 1}º</span>${robotIcon(name, 26)}<b>${escapeHtml(name)}</b><span class="lesson-race-bar" aria-hidden="true"><span style="width:${battery}%;background:${paint[robotColor.get(name) ?? ''] ?? '#ddd'}"></span></span><span class="lesson-race-val">${battery}%</span></li>`;
  }).join('');
  const caption = key === 'orderNone' ? 'Do jeito que o banco achou mais prático.' : key === 'orderAsc' ? 'Da bateria mais vazia para a mais cheia.' : 'Da bateria mais cheia para a mais vazia.';
  return `<figure class="lesson-figure lesson-race"><span class="section-eyebrow">O banco responde · ${rows.length} linhas</span><ol aria-label="Resultado: robôs e bateria, ${caption}">${items}</ol><figcaption>${caption}</figcaption></figure>`;
}

/* ---------- Exercícios ---------- */

function feedbackMarkup(exercise: Exercise): string {
  const level = hintLevel.get(exercise.id) ?? 0;
  const hints = exercise.hints.slice(0, level).map((hint, i) => `<p class="lesson-feedback is-hint"><b>Dica ${i + 1}:</b> ${escapeHtml(hint)}</p>`).join('');
  const current = feedback.get(exercise.id);
  return `${hints}${current ? `<div class="lesson-feedback is-${current.tone}">${current.html}</div>` : ''}`;
}

function exerciseHead(exercise: Exercise): string {
  const number = lessonExercises.indexOf(exercise) + 1;
  const solved = saved.solved.includes(exercise.id);
  return `<div class="lesson-try-head"><span class="lesson-try-badge">Tente você · ${number} de ${lessonExercises.length}</span>${solved ? '<span class="lesson-try-done">✓ resolvido</span>' : ''}</div>`;
}

function exerciseMarkup(exercise: Exercise): string {
  const level = hintLevel.get(exercise.id) ?? 0;
  return `<section class="lesson-try" aria-labelledby="try-${exercise.id}-title">
    ${exerciseHead(exercise)}
    <h3 id="try-${exercise.id}-title" class="lesson-try-task">${exercise.task}</h3>
    ${editorMarkup({ id: `try-${exercise.id}`, label: 'treino.sql', status: 'base de treino · Ctrl + Enter testa', tokens: exercise.tokens, describedBy: `try-${exercise.id}-title` })}
    <div class="lesson-try-actions">
      <button type="button" class="game-button lesson-try-run" data-act="try" data-ex="${exercise.id}">Testar consulta</button>
      <button type="button" class="text-button" data-act="try-hint" data-ex="${exercise.id}" ${level >= exercise.hints.length ? 'disabled' : ''}>${level ? 'Ver outra dica' : 'Ver uma dica'}</button>
      <button type="button" class="text-button" data-act="try-reset" data-ex="${exercise.id}">Recomeçar</button>
    </div>
    <div id="try-${exercise.id}-feedback" class="lesson-try-feedback" role="status" aria-live="polite">${feedbackMarkup(exercise)}</div>
  </section>`;
}

function friendlyError(message: string): string {
  const column = /no such column: ([^\s]+)/.exec(message);
  if (column) {
    const name = column[1].replace(/^.*\./, '');
    return `O banco procurou uma coluna chamada ${code(name)} e não achou. Se isso é um texto, coloque entre aspas simples: ${code(`'${name}'`)}. As colunas daqui são ${practiceColumns.map(code).join(', ')}.`;
  }
  const table = /no such table: ([^\s]+)/.exec(message);
  if (table) return `Não existe a tabela ${code(table[1])} na base de treino. A tabela da aula se chama ${code('robos')}.`;
  const near = /near "([^"]*)": syntax error/.exec(message);
  if (near) return `Algo na escrita não encaixou perto de ${code(near[1])}. Confira vírgulas, aspas e a ordem das peças: SELECT → FROM → WHERE → ORDER BY.`;
  if (message.startsWith('Use uma única consulta de leitura')) return `Na base de treino só dá para ler: toda consulta começa com ${code('SELECT')}. Os robôs agradecem por não serem apagados.`;
  if (message.includes('incomplete input')) return 'A consulta parou no meio do caminho. Falta completar alguma parte?';
  return escapeHtml(message);
}

function judge(result: QueryResult, exercise: Exercise, sql: string): { ok: boolean; html: string } {
  const normalize = (column: string) => column.toLowerCase().replace(/^.*\./, '');
  const got = result.columns.map(normalize);
  const want = exercise.expected.columns;
  const table = result.values.length ? grid(result, { label: 'Resultado da sua consulta' }) : '';
  const missing = want.filter(column => !got.includes(column));
  const extra = got.filter(column => !want.includes(column));
  if (missing.length || extra.length) {
    const message = got.length === practiceColumns.length && extra.length
      ? `O ${code('*')} trouxe todas as colunas. Troque pelos nomes: ${want.map(code).join(' e ')}.`
      : [missing.length ? `Faltou ${missing.length > 1 ? 'as colunas' : 'a coluna'} ${missing.map(code).join(' e ')}.` : '', extra.length ? `Vieram colunas a mais: ${extra.map(code).join(', ')}. Peça só ${want.map(code).join(' e ')}.` : ''].join(' ');
    return { ok: false, html: `<p>${message}</p>${table}` };
  }
  if (!result.values.length) return { ok: false, html: '<p>A consulta rodou, mas nenhuma linha passou. Confira o valor do filtro: letras, acentos e aspas precisam bater certinho.</p>' };
  const order = want.map(column => got.indexOf(column));
  const rows = result.values.map(row => JSON.stringify(order.map(i => row[i])));
  const expected = exercise.expected.rows.map(row => JSON.stringify(row));
  const sorted = (list: string[]) => [...list].sort().join('|');
  if (sorted(rows) !== sorted(expected)) {
    const message = rows.length > expected.length
      ? `Vieram ${rows.length} linhas, mas a resposta tem ${expected.length}. Faltou filtrar com ${code('WHERE')}?`
      : `Vieram ${rows.length} ${rows.length === 1 ? 'linha' : 'linhas'}, e a resposta tem ${expected.length}. Confira a condição do filtro.`;
    return { ok: false, html: `<p>${message}</p>${table}` };
  }
  if (exercise.ordered && rows.join('|') !== expected.join('|')) {
    const message = /order\s+by/i.test(sql)
      ? `Quase! As linhas estão certas, mas a ordem está invertida. Do menor para o maior é ${code('ASC')}; do maior para o menor, ${code('DESC')}.`
      : `As linhas estão certas, mas faltou pedir a ordem com ${code('ORDER BY')}. Sem ele, a ordem não é garantida.`;
    return { ok: false, html: `<p>${message}</p>${table}` };
  }
  return { ok: true, html: `<p><b>✦ Isso!</b> ${exercise.success}</p>${table}` };
}

async function runExercise(id: string): Promise<void> {
  const exercise = lessonExercises.find(item => item.id === id);
  const editor = getSqlEditor(root?.querySelector<HTMLElement>(`#try-${id}`));
  if (!exercise || !editor || feedback.get(id)?.tone === 'busy') return;
  if (!editor.value.replace(/--[^\n]*/g, '').trim()) {
    feedback.set(id, { tone: 'hint', html: '<p>Escreva uma consulta antes de testar. O modelo já dá um empurrãozinho.</p>' });
    refreshExercise(exercise);
    return;
  }
  const sql = editor.value;
  feedback.set(id, { tone: 'busy', html: '<p><span class="play-spinner" aria-hidden="true"></span> Perguntando à base de treino…</p>' });
  refreshExercise(exercise);
  try {
    const result = await database.execute(sql);
    const verdict = judge(result, exercise, sql);
    feedback.set(id, { tone: verdict.ok ? 'success' : 'hint', html: verdict.html });
    setEditorStatus(editor, '✓ rodou na base de treino', 'is-ok');
    if (verdict.ok && !saved.solved.includes(id)) {
      saved.solved.push(id);
      save();
    }
  } catch (error) {
    feedback.set(id, { tone: 'error', html: `<p>${friendlyError(error instanceof Error ? error.message : 'Erro desconhecido.')}</p>` });
    setEditorStatus(editor, '✕ não rodou', 'is-error');
  }
  refreshExercise(exercise);
}

function refreshExercise(exercise: Exercise): void {
  const section = root?.querySelector(`#try-${exercise.id}-feedback`)?.closest('.lesson-try');
  if (!section) return;
  section.querySelector('.lesson-try-head')!.outerHTML = exerciseHead(exercise);
  section.querySelector(`#try-${exercise.id}-feedback`)!.innerHTML = feedbackMarkup(exercise);
  const hint = section.querySelector<HTMLButtonElement>('[data-act="try-hint"]')!;
  const level = hintLevel.get(exercise.id) ?? 0;
  hint.disabled = level >= exercise.hints.length;
  hint.textContent = level ? 'Ver outra dica' : 'Ver uma dica';
  const run = section.querySelector<HTMLButtonElement>('.lesson-try-run')!;
  const busy = feedback.get(exercise.id)?.tone === 'busy';
  run.disabled = busy;
  run.textContent = busy ? 'Testando...' : 'Testar consulta';
  refreshProgress();
}

/* ---------- Montagem ---------- */

function progressMarkup(): string {
  const percent = (saved.step + 1) * 100 / steps.length;
  return `<nav id="lesson-progress" class="lesson-progress" aria-label="Passos da aula"><ol>${steps.map((step, i) => {
    const done = i < saved.reached || (i === steps.length - 1 && saved.finished);
    return `<li><button type="button" data-act="step" data-step="${i}" ${i === saved.step ? 'aria-current="step"' : ''} class="${done ? 'is-done' : ''}" aria-label="Passo ${i + 1}: ${step.title}${done ? ' (visto)' : ''}"><span class="lesson-progress-n">${done && i !== saved.step ? '✓' : i + 1}</span><span class="lesson-progress-label">${step.short}</span></button></li>`;
  }).join('')}</ol><span class="lesson-progress-bar" aria-hidden="true"><span style="width:${percent}%"></span></span></nav>`;
}

function refreshProgress(): void {
  const nav = root?.querySelector('#lesson-progress');
  if (nav) nav.outerHTML = progressMarkup();
}

function navMarkup(): string {
  const last = saved.step === steps.length - 1;
  return `<div class="lesson-nav">
    <button type="button" class="outline-button lesson-prev" data-act="prev" ${saved.step === 0 ? 'disabled' : ''}><span aria-hidden="true">←</span><span class="lesson-nav-text"> Voltar</span></button>
    <span class="lesson-count">Passo ${saved.step + 1} de ${steps.length}</span>
    ${last
      ? '<a class="game-button lesson-next" href="/jogar" data-nav data-act="finish">Entrar no Jardim do Éden <span aria-hidden="true">→</span></a>'
      : `<button type="button" class="game-button lesson-next" data-act="next"><span class="lesson-nav-text">Próximo: </span>${steps[saved.step + 1].title} <span aria-hidden="true">→</span></button>`}
  </div>`;
}

function finaleMarkup(): string {
  return `<section class="lesson-finale" aria-labelledby="finale-title">
    <div class="lesson-finale-card">
      <h3 id="finale-title">Agora você já sabe pedir pistas ao banco.</h3>
      <ul class="lesson-recap">
        <li>${code('SELECT * FROM tabela;')} <span>mostra tudo</span></li>
        <li>${code('SELECT a, b FROM tabela;')} <span>escolhe colunas</span></li>
        <li>${code("WHERE coluna = 'texto'")} <span>filtra linhas</span></li>
        <li>${code('ORDER BY coluna DESC')} <span>organiza a resposta</span></li>
      </ul>
      <a class="game-button lesson-enter" href="/jogar" data-nav data-act="finish">Entrar no Jardim do Éden <span aria-hidden="true">→</span></a>
      <p class="lesson-aside">Lá dentro, o botão <b>Consultar guia SQL</b> reabre esta aula em outra aba, sem apagar a sua consulta.</p>
    </div>
    <div class="lesson-more">
      <h3>Para continuar aprendendo</h3>
      <p>Referências em inglês, para quando a curiosidade apertar:</p>
      <ul>
        <li><a href="https://www.w3schools.com/sql/sql_select.asp" target="_blank" rel="noopener noreferrer">W3Schools: SQL SELECT ↗</a></li>
        <li><a href="https://www.w3schools.com/sql/sql_where.asp" target="_blank" rel="noopener noreferrer">W3Schools: SQL WHERE ↗</a></li>
        <li><a href="https://www.w3schools.com/sql/sql_orderby.asp" target="_blank" rel="noopener noreferrer">W3Schools: SQL ORDER BY ↗</a></li>
        <li><a href="https://www.sqlite.org/lang_select.html" target="_blank" rel="noopener noreferrer">SQLite: a instrução SELECT ↗</a></li>
      </ul>
    </div>
  </section>`;
}

function stepMarkup(): string {
  const index = saved.step;
  const content = stepContent(index);
  return `<article id="lesson-step" class="lesson-step ${entering ? 'is-entering' : ''}" aria-labelledby="lesson-step-title">
    <header class="lesson-step-head"><span class="section-eyebrow">Passo ${index + 1} de ${steps.length}</span><h2 id="lesson-step-title" tabindex="-1">${steps[index].title}</h2></header>
    <div class="lesson-columns"><div class="lesson-text">${content.text}</div><div id="lesson-visual" class="lesson-visual">${content.visual}</div></div>
    ${content.exercise ? exerciseMarkup(content.exercise) : ''}
    ${index === steps.length - 1 ? finaleMarkup() : ''}
  </article>`;
}

export function lessonMarkup(): string {
  const hash = /^#passo-(\d)$/.exec(location.hash);
  if (hash) {
    saved.step = Math.min(Math.max(Number(hash[1]) - 1, 0), steps.length - 1);
    saved.reached = Math.max(saved.reached, saved.step);
  }
  return `<main class="lesson" id="top">
    <section class="lesson-intro">
      <div>
        <span class="chapter-pill"><span class="chapter-dot"></span> DOCUMENTAÇÃO 01 · PRIMEIRAS CONSULTAS</span>
        <h1>Como pedir coisas a um banco de dados</h1>
        <p>Seis passos curtos, uma tabela de robôs de treino e nenhum spoiler. No fim, você entra no Jardim do Éden sabendo pedir pistas.</p>
      </div>
      <div class="lesson-skip">
        ${saved.finished ? '<span>Você já passou por aqui.</span>' : '<span>Já conhece SQL?</span>'}
        <a class="outline-button" href="/jogar" data-nav>Ir direto ao jogo <span aria-hidden="true">→</span></a>
      </div>
    </section>
    ${progressMarkup()}
    <div id="lesson-body">${stepMarkup()}</div>
    ${navMarkup()}
  </main>`;
}

function initEditors(): void {
  root?.querySelectorAll<HTMLElement>('.lesson-try .play-code-editor').forEach(host => {
    const id = host.id.replace(/^try-/, '');
    mountSqlEditor(host, {
      value: drafts.get(id) ?? lessonExercises.find(item => item.id === id)!.starter,
      onChange: value => drafts.set(id, value),
      onRun: () => { void runExercise(id); }
    });
  });
}

function renderStep(focusSelector?: string): void {
  if (!root) return;
  const race = new Map<string, number>();
  root.querySelectorAll<HTMLElement>('.lesson-race li[data-key]').forEach(item => race.set(item.dataset.key!, item.getBoundingClientRect().top));
  const body = root.querySelector('#lesson-body')!;
  destroySqlEditors(body);
  body.innerHTML = stepMarkup();
  root.querySelector('.lesson-nav')!.outerHTML = navMarkup();
  refreshProgress();
  initEditors();
  // Os robôs deslizam para a nova posição quando a ordem muda.
  if (race.size && !reducedMotion.matches) {
    root.querySelectorAll<HTMLElement>('.lesson-race li[data-key]').forEach(item => {
      const before = race.get(item.dataset.key!);
      if (before === undefined) return;
      const delta = before - item.getBoundingClientRect().top;
      if (delta) item.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }
  if (focusSelector) root.querySelector<HTMLElement>(focusSelector)?.focus();
}

function goTo(step: number): void {
  if (step < 0 || step >= steps.length) return;
  saved.step = step;
  saved.reached = Math.max(saved.reached, step);
  save();
  history.replaceState(history.state, '', `${lessonPath}#passo-${step + 1}`);
  entering = true;
  renderStep('#lesson-step-title');
  entering = false;
  root?.querySelector('#lesson-progress')?.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
}

function loadExamples(): void {
  if (examplesRequested) return;
  examplesRequested = true;
  (Object.keys(lessonExamples) as ExampleKey[]).forEach(key => {
    database.execute(lessonExamples[key].sql)
      .then(result => { examples.set(key, result); })
      .catch(error => { examples.set(key, error instanceof Error ? error : new Error(String(error))); })
      .finally(() => {
        // Só a coluna visual é redesenhada: o editor do exercício não perde o foco nem o texto.
        const visual = root?.querySelector('#lesson-visual');
        if (visual) visual.innerHTML = stepContent(saved.step).visual;
      });
  });
}

function onClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  if (act === 'next') goTo(saved.step + 1);
  else if (act === 'prev') goTo(saved.step - 1);
  else if (act === 'step') goTo(Number(target.dataset.step));
  else if (act === 'finish') { saved.finished = true; saved.reached = steps.length - 1; save(); }
  else if (act === 'next-piece') { view.piece = view.piece < pieces.length ? view.piece + 1 : 1; renderStep('[data-act="next-piece"]'); }
  else if (act === 'piece') { view.piece = Number(target.dataset.piece); renderStep(`[data-act="piece"][data-piece="${view.piece}"]`); }
  else if (act === 'where') { view.whereMode = target.dataset.value as 'text' | 'number'; renderStep(`[data-act="where"][data-value="${view.whereMode}"]`); }
  else if (act === 'order') { view.order = target.dataset.value as 'none' | 'asc' | 'desc'; renderStep(`[data-act="order"][data-value="${view.order}"]`); }
  else if (act === 'try') void runExercise(target.dataset.ex!);
  else if (act === 'try-hint') {
    const exercise = lessonExercises.find(item => item.id === target.dataset.ex)!;
    hintLevel.set(exercise.id, Math.min((hintLevel.get(exercise.id) ?? 0) + 1, exercise.hints.length));
    refreshExercise(exercise);
    if (target.hasAttribute('disabled')) getSqlEditor(root?.querySelector<HTMLElement>(`#try-${exercise.id}`))?.focus();
  } else if (act === 'try-reset') {
    const exercise = lessonExercises.find(item => item.id === target.dataset.ex)!;
    const editor = getSqlEditor(root?.querySelector<HTMLElement>(`#try-${exercise.id}`));
    drafts.delete(exercise.id);
    feedback.delete(exercise.id);
    if (editor) { editor.value = exercise.starter; setEditorStatus(editor, 'base de treino · Ctrl + Enter testa'); editor.focus(); }
    refreshExercise(exercise);
  } else if (act === 'token') insertToken(target);
}

export function disposeLesson(): void {
  controller?.abort();
  destroySqlEditors(root);
  controller = undefined;
}

export function bindLesson(app: HTMLElement): void {
  disposeLesson();
  controller = new AbortController();
  const { signal } = controller;
  root = app;
  app.addEventListener('click', onClick, { signal });
  history.replaceState(history.state, '', `${lessonPath}#passo-${saved.step + 1}`);
  save();
  initEditors();
  loadExamples();
}

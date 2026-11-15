import { relations, storyName, tableGuide, type TableGuide } from './story-data';
import { afterAdam, code, idOf, isId, matchingDiscovery, moments, rowValue, timeOf, type Discovery, type Line, type Moment } from './story-moments';
import { createSqlClient, type Cell, type QueryResult } from './sql-client';
import { destroySqlEditors, editorMarkup, escapeHtml, getSqlEditor, insertToken, mountSqlEditor, setEditorStatus } from './sql-ui';
import './game.css';

type SceneArt = (type: string, label: string) => string;
type SavedStory = { phase: number; discoveries: (Discovery | null)[] };
type BankTab = 'diagram' | 'records';
type MobileTab = 'cena' | 'banco' | 'consulta';
type Records = { columns: string[]; values: Cell[][]; total: number } | { error: string };
const storyKey = 'worlddb-garden-story-v2';
const soundKey = 'worlddb-sound-v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = matchMedia('(max-width: 760px)');
let state = readStory();
let soundEnabled = readSound();
let audioContext: AudioContext | undefined;
const database = createSqlClient('story');
const execute = database.execute;
const records = new Map<string, Records>();
const loadingRecords = new Set<string>();
let root: HTMLElement | undefined;
let artFn: SceneArt = () => '';
let controller: AbortController | undefined;
let advancing = false;

// Estado da tela: não vai para o localStorage e volta ao padrão a cada momento.
type LastResult = QueryResult & { found: boolean; message?: string };
type FeedbackMotion = 'success' | 'error' | 'hint' | '';
let ui = freshUi();
function freshUi() {
  return {
    bankTab: 'diagram' as BankTab,
    recordsTable: moments[Math.min(state.phase, 5)].bank.tables[0],
    focusValues: [] as string[],
    mobileTab: 'cena' as MobileTab,
    sceneSeen: true,
    result: null as LastResult | null,
    error: '',
    hint: '',
    hintIndex: 0,
    processing: false,
    justFound: false,
    freeMode: false,
    feedbackMotion: '' as FeedbackMotion
  };
}

function readStory(): SavedStory {
  try {
    const saved = JSON.parse(localStorage.getItem(storyKey) || 'null') as SavedStory | null;
    if (saved && Number.isInteger(saved.phase) && saved.phase >= 0 && saved.phase <= 6 && Array.isArray(saved.discoveries)) {
      return { phase: saved.phase, discoveries: Array.from({ length: 6 }, (_, i) => saved.discoveries[i]?.rows ? saved.discoveries[i] : null) };
    }
  } catch { /* Armazenamento opcional. */ }
  return { phase: 0, discoveries: Array(6).fill(null) };
}

function saveStory(): void {
  try { localStorage.setItem(storyKey, JSON.stringify(state)); } catch { /* O jogo funciona sem armazenamento. */ }
}

function readSound(): boolean {
  try {
    const saved = localStorage.getItem(soundKey);
    return saved === null ? !reducedMotion.matches : saved === 'on';
  } catch { return !reducedMotion.matches; }
}

function saveSound(): void {
  try { localStorage.setItem(soundKey, soundEnabled ? 'on' : 'off'); } catch { /* Preferência opcional. */ }
}

function playSound(kind: 'click' | 'clue' | 'finish'): void {
  if (!soundEnabled) return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const notes = kind === 'click' ? [520] : kind === 'clue' ? [580, 780] : [520, 660, 880];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      const start = audioContext!.currentTime + index * .075;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.025, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .115);
      oscillator.connect(gain).connect(audioContext!.destination);
      oscillator.start(start);
      oscillator.stop(start + .12);
    });
  } catch { /* Áudio pode estar indisponível sem afetar o jogo. */ }
}

/* ---------- Ilustração ---------- */

function sceneOverlay(index: number): string {
  const drawings = [
    '<circle cx="77" cy="48" r="9" fill="none" stroke="#ed8b69" stroke-width="3" stroke-dasharray="3 4"/><text x="72" y="52" fill="#a35e54" font-size="15" font-weight="900">?</text>',
    '',
    '<ellipse cx="249" cy="130" rx="35" ry="32" fill="#ffd67877"/><path d="M220 154q-19-9-9-27" fill="none" stroke="#e58e66" stroke-width="4" stroke-linecap="round"/><text x="257" y="102" fill="#a86153" font-size="22" font-weight="900">?</text>',
    '<path d="M217 58q24-18 47 0-20-7-32 7-10 11-15-7Z" fill="#7194b4" stroke="#34364a" stroke-width="2"/><circle cx="255" cy="57" r="2" fill="#34364a"/><path d="M225 84q-8 13-18 10" fill="none" stroke="#7194b4" stroke-width="5" stroke-linecap="round"/><circle cx="206" cy="98" r="5" fill="#f8c45e"/>',
    '<path d="M190 54q18-17 35 0 16 18 31 2" fill="none" stroke="#77a8db" stroke-width="10" stroke-linecap="round"/><path d="m208 45-4 19m15-18 4 22" stroke="#d7ebf5" stroke-width="4"/><circle cx="246" cy="83" r="7" fill="#f5c85f"/>',
    '<path class="clue-route" d="M77 110 C122 68 157 155 218 110 S260 103 278 117" fill="none" stroke="#f5ba58" stroke-width="8" stroke-dasharray="12 8" stroke-linecap="round"/><circle cx="77" cy="110" r="9" fill="#ed8b69"/><circle cx="278" cy="117" r="12" fill="#f5d482" stroke="#34364a" stroke-width="2"/><text x="273" y="123" fill="#34364a" font-size="17" font-weight="900">?</text>'
  ];
  return `<svg class="story-overlay" viewBox="0 0 300 180" aria-hidden="true">${drawings[index]}</svg>`;
}

// O Pomar do Momento 2 tem desenho próprio: pegadas antes, rastro sinuoso depois.
function orchardArt(discovery: Discovery | null): string {
  const base = '<rect x="1" y="1" width="298" height="178" rx="25" fill="#f8f0d9"/><circle cx="277" cy="38" r="17" fill="#ffe790"/><path d="M9 129Q79 81 145 120T291 117V166H9Z" fill="#a7d69b"/><path d="M9 150Q80 122 157 151T291 140V180H9Z" fill="#71bd9b"/><path d="M120 170q35-55 98-44t78 32" fill="none" stroke="#ead1a4" stroke-width="27"/><path d="M59 150V50" stroke="#7d674d" stroke-width="12" stroke-linecap="round"/><circle cx="58" cy="60" r="34" fill="#8acc70"/><circle cx="35" cy="75" r="22" fill="#9ed87f"/><circle cx="82" cy="77" r="23" fill="#86c86c"/><path d="M84 66l9-6" stroke="#7d674d" stroke-width="3" stroke-linecap="round"/><circle cx="97" cy="67" r="8" fill="none" stroke="#ed8b69" stroke-width="2.5" stroke-dasharray="3 3"/>';
  const steps = (dark: boolean) => `<ellipse cx="160" cy="142" rx="7" ry="4" transform="rotate(-18 160 142)" fill="#af846c"/><ellipse cx="182" cy="133" rx="7" ry="4" transform="rotate(13 182 133)" fill="${dark ? '#8f654e' : '#af846c'}"/><ellipse cx="205" cy="133" rx="7" ry="4" transform="rotate(-14 205 133)" fill="${dark ? '#8f654e' : '#af846c'}"/><ellipse cx="228" cy="135" rx="7" ry="4" transform="rotate(10 228 135)" fill="#af846c"/>`;
  const adam = '<path d="M104 152q20-27 42 0v25h-42Z" fill="#e9a67f"/><circle cx="125" cy="127" r="16" fill="#f5c29d"/>';
  let extra: string;
  if (discovery) {
    const row = afterAdam(discovery.rows);
    extra = `<path class="orchard-route" d="M100 76 C118 104 140 150 170 138 S220 118 262 124" fill="none" stroke="#eb8262" stroke-width="4" stroke-dasharray="6 6" stroke-linecap="round"/><circle class="orchard-glow" cx="182" cy="133" r="13" fill="#ffdf8b" opacity=".75"/><circle class="orchard-glow" cx="205" cy="133" r="13" fill="#ffdf8b" opacity=".75"/><path d="M176 150q7-7 14 0t14 0 14 0 14 0" fill="none" stroke="#536d53" stroke-width="3.5" stroke-linecap="round"/>${steps(true)}${adam}<rect x="206" y="96" width="80" height="22" rx="11" fill="#fffaf0" stroke="#34364a" stroke-width="2"/><text x="214" y="111" fill="#a85543" font-size="11" font-weight="500" font-family="DM Mono, monospace">${escapeHtml(idOf(row))} · ${escapeHtml(timeOf(row))}</text>`;
  } else {
    extra = `<text x="93.5" y="71.5" fill="#a35e54" font-size="12" font-weight="900">?</text>${steps(false)}${adam}<circle cx="147" cy="101" r="9" fill="#fffaf0" stroke="#34364a" stroke-width="2"/><text x="144" y="106" fill="#34364a" font-size="13" font-weight="900">!</text>`;
  }
  return `<svg class="scene-art" viewBox="0 0 300 180" role="img" aria-label="Ilustração do Pomar ${discovery ? 'com o rastro revelado' : 'com pegadas no caminho'}">${base}${extra}</svg>`;
}

function sceneArt(index: number, discovery: Discovery | null): string {
  const moment = moments[index];
  return index === 1 ? orchardArt(discovery) : `${artFn(moment.scene, moment.title)}${sceneOverlay(index)}`;
}

/* ---------- Cabeçalho ---------- */

const brandIcon = '<svg viewBox="0 0 80 80" width="30" height="30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="40" cy="40" r="28" fill="#c5e9f1"/><path d="M12 40h56M40 12c-11 14-11 42 0 56M40 12c11 14 11 42 0 56M17 26h46M17 54h46"/><circle cx="29" cy="28" r="4" fill="#ef9a65"/><circle cx="53" cy="42" r="4" fill="#f4c84e"/><circle cx="34" cy="55" r="4" fill="#80bd7b"/></svg>';

function journalMarkup(): string {
  const items = state.discoveries.map((found, i) => {
    if (!found) return '';
    const isNew = i === state.phase;
    return `<li class="${isNew ? 'is-new' : ''}"><span class="play-journal-n">0${i + 1}</span><span>${moments[i].journal(found.rows)}</span>${isNew ? '<span class="play-new">nova</span>' : ''}</li>`;
  }).join('');
  return `<div class="play-pop-head"><span class="section-eyebrow">Seu caderno de pistas</span><button type="button" class="play-close" data-act="journal">fechar ×</button></div>${items ? `<ol class="play-journal-list">${items}</ol>` : '<p class="play-journal-empty">Nenhuma pista ainda. Cada consulta certa guarda uma aqui.</p>'}`;
}

function soundLabel(): string {
  return soundEnabled ? '♪ Som' : '♪ Sem som';
}

function headerMarkup(): string {
  const finished = state.phase === 6;
  const current = Math.min(state.phase, 5);
  const solved = finished || !!state.discoveries[state.phase];
  const count = state.discoveries.filter(Boolean).length;
  const steps = moments.map((_, i) => {
    const done = i < state.phase || (i === state.phase && solved);
    return `<span class="${done ? 'is-done' : i === state.phase ? 'is-current' : ''} ${i === state.phase ? 'is-now' : ''}"></span>`;
  }).join('');
  const status = finished ? 'História resolvida' : `Momento ${current + 1} de 6${solved ? ' · resolvido' : ''}`;
  const percent = finished ? 100 : (current + 1) * 100 / 6;
  return `<header id="play-header" class="play-header">
    <a class="play-brand" href="/" data-nav aria-label="WorldDB, voltar ao início"><span class="brand-mark">${brandIcon}</span><span class="play-brand-name">World<span class="brand-db">DB</span></span></a>
    <div class="play-progress" role="group" aria-label="Progresso: ${status}">
      <span class="play-story-name">${storyName}</span>
      <span class="play-steps" aria-hidden="true">${steps}</span>
      <span class="play-status ${solved ? 'is-solved' : ''}">${status}</span>
      <span class="play-bar ${solved ? 'is-solved' : ''}" aria-hidden="true"><span style="width:${percent}%"></span></span>
    </div>
    <div class="play-actions">
      <div class="play-pop-wrap">
        <button type="button" class="play-chip play-journal-button ${solved && !finished ? 'is-fresh' : ''}" data-act="journal" aria-expanded="false" aria-controls="play-journal"><span class="play-wide">Caderno de pistas</span><span class="play-narrow">Pistas</span> <span class="play-count" aria-label="${count} pistas">${count}</span></button>
        <div id="play-journal" class="play-popover" hidden>${journalMarkup()}</div>
      </div>
      <button type="button" class="play-chip play-sound play-wide-flex" data-act="sound" aria-pressed="${soundEnabled}">${soundLabel()}</button>
      <div class="play-pop-wrap">
        <button type="button" class="play-chip" data-act="menu" aria-expanded="false" aria-controls="play-menu" aria-label="Menu"><span class="play-wide">Menu</span><span class="play-narrow" aria-hidden="true">☰</span></button>
        <div id="play-menu" class="play-popover play-menu" hidden>
          <a href="/" data-nav>Início</a>
          <a href="/explorar" data-nav>Explorar a linha do tempo</a>
          ${guideLink('', 1)}
          ${guideLink('', 2)}
          <button type="button" class="play-sound play-narrow-block" data-act="sound" aria-pressed="${soundEnabled}">${soundLabel()}</button>
          <button type="button" data-act="restart">Reiniciar história</button>
          <p>✧ História inventada para o jogo, inspirada no relato bíblico. Não é um acontecimento histórico datado.</p>
        </div>
      </div>
    </div>
  </header>`;
}

/* ---------- Cena ---------- */

function gapMarkup(): string {
  const moment = moments[state.phase];
  const found = state.discoveries[state.phase];
  return `<div class="play-gap ${found ? 'is-found' : ''} ${found && ui.justFound ? 'is-revealed' : ''}"><span class="play-gap-label">${found ? 'Pista ✓' : 'Lacuna'}</span><span class="play-gap-text">${found ? moment.filled(found.rows) : moment.blank}</span></div>`;
}

function mobileGapMarkup(): string {
  const moment = moments[state.phase];
  const found = state.discoveries[state.phase];
  return `<div id="play-mobile-gap" class="play-mobile-gap ${found ? 'is-found' : ''}">${found ? `<span class="play-gap-thumb" aria-hidden="true">${sceneArt(state.phase, found)}</span>` : ''}<div><span class="play-gap-label">${found ? `Pista 0${state.phase + 1} ✓` : `Missão · ${moment.skill}`}</span><span class="play-gap-text">${found ? moment.filled(found.rows) : moment.blank}</span></div></div>`;
}

function bubble(line: Line): string {
  return `<div class="play-bubble"><span class="play-speaker">${line.speaker}</span><p>${line.text}</p></div>`;
}

function sceneMarkup(): string {
  const index = state.phase;
  const moment = moments[index];
  const found = state.discoveries[index];
  const lines = found ? [moment.after.line] : moment.lines;
  return `<section id="play-scene" class="play-scene" data-pane="cena" aria-labelledby="play-title">
    <div class="play-art scene-${index} ${found ? 'is-discovered' : ''}">${sceneArt(index, found)}<span class="play-art-tag">${found ? moment.revealTag : moment.tag}</span></div>
    <div class="play-story">
      <span class="play-skill ${found ? 'is-found' : ''}"><span class="play-skill-dot"></span>${moment.skill} · Pista 0${index + 1}${found ? ' encontrada' : ''}</span>
      <h1 id="play-title">${moment.title}</h1>
      <div class="play-lines"><p class="play-narration">${found ? moment.after.narration : moment.narration}</p>${lines.map(bubble).join('')}</div>
      ${gapMarkup()}
    </div>
  </section>`;
}

/* ---------- Banco ---------- */

const ROW = 26, HEAD = 32, GAP = 18;
let diagramCount = 0;
type Box = { x: number; y: number; w: number; table: TableGuide };

function guide(name: string): TableGuide {
  return tableGuide.find(table => table.name === name)!;
}

function diagramSvg(names: string[], start: string | null, focus: string[], label: string): string {
  const tables = names.map(guide);
  const links = relations.filter(link => names.includes(link.from) && names.includes(link.to));
  const facts = tables.filter(table => links.some(link => link.from === table.name));
  const dims = tables.filter(table => !facts.includes(table));
  const height = (table: TableGuide) => HEAD + table.columns.length * ROW;
  const stack = (list: TableGuide[], x: number, w: number) => {
    let y = 0;
    const placed = list.map(table => { const box = { x, y, w, table }; y += height(table) + GAP; return box; });
    return { placed, total: y - GAP };
  };
  const boxes: Box[] = [];
  if (!facts.length) {
    boxes.push(...stack(dims, 134, 240).placed.map(box => ({ ...box, y: box.y + 4 })));
  } else {
    const left = stack(dims, 4, 196);
    const right = stack(facts, 294, 214);
    const total = Math.max(left.total, right.total);
    boxes.push(...left.placed.map(box => ({ ...box, y: box.y + 4 + (total - left.total) / 2 })));
    boxes.push(...right.placed.map(box => ({ ...box, y: box.y + 4 + (total - right.total) / 2 })));
  }
  const uid = ++diagramCount;
  const find = (name: string) => boxes.find(box => box.table.name === name)!;
  const svgHeight = Math.max(...boxes.map(box => box.y + height(box.table))) + 10;
  const lines = links.map(link => {
    const target = find(link.to), source = find(link.from);
    const x1 = target.x + target.w, y1 = target.y + HEAD + ROW / 2;
    const x2 = source.x, y2 = source.y + HEAD + source.table.columns.indexOf(link.column) * ROW + ROW / 2;
    const hot = link.from === start && focus.includes(link.column);
    return { hot, svg: `<path d="M${x1} ${y1} H${x1 + 36} C${x1 + 66} ${y1} ${x2 - 38} ${y2} ${x2 - 8} ${y2} H${x2}" class="dg-link ${hot ? 'is-hot' : ''}"/><text x="${x1 + 6}" y="${y1 - 6}" class="dg-card ${hot ? 'is-hot' : ''}">1</text><text x="${x2 - 16}" y="${y2 - 6}" class="dg-card ${hot ? 'is-hot' : ''}">N</text>` };
  });
  // Linhas destacadas por último, para ficarem por cima das outras.
  const linkSvg = [...lines.filter(line => !line.hot), ...lines.filter(line => line.hot)].map(line => line.svg).join('');
  const boxSvg = boxes.map(({ x, y, w, table }) => {
    const isStart = table.name === start && names.length > 1;
    const h = height(table);
    const rows = table.columns.map((column, i) => {
      const ry = y + HEAD + i * ROW;
      const isFocus = focus.includes(column) && table.name === start;
      const isFk = relations.some(link => link.from === table.name && link.column === column);
      const badge = column === 'id' ? 'PK' : isFk ? 'FK' : '';
      return `${isFocus ? `<rect x="${x}" y="${ry}" width="${w}" height="${ROW}" class="dg-focus"/>` : ''}${i ? `<line x1="${x}" y1="${ry}" x2="${x + w}" y2="${ry}" class="dg-sep"/>` : ''}${badge ? `<rect x="${x + 9}" y="${ry + 7}" width="21" height="12" rx="3" class="dg-${badge.toLowerCase()}"/><text x="${x + 19.5}" y="${ry + 16.5}" class="dg-badge">${badge}</text>` : ''}<text x="${x + 37}" y="${ry + 17.5}" class="dg-col ${isFocus || column === 'id' ? 'is-strong' : ''}">${column}</text><text x="${x + w - 10}" y="${ry + 17.5}" class="dg-type">${table.types[i]}</text>`;
    }).join('');
    const tag = isStart
      ? `<rect x="${x + w - 88}" y="${y + 8}" width="80" height="17" rx="8.5" class="dg-start-pill"/><text x="${x + w - 48}" y="${y + 20.5}" class="dg-start-text">comece aqui</text>`
      : `<text x="${x + w - 10}" y="${y + 20.5}" class="dg-count">${table.rows}</text>`;
    const clip = `dg-${uid}-${table.name}`;
    return `<g class="dg-table ${isStart ? 'is-start' : ''}"><clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/></clipPath><rect x="${x + (isStart ? 5 : 3)}" y="${y + (isStart ? 5 : 3)}" width="${w}" height="${h}" rx="10" class="dg-shadow"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="dg-body"/><g clip-path="url(#${clip})"><rect x="${x}" y="${y}" width="${w}" height="${HEAD}" class="dg-head"/>${rows}</g><line x1="${x}" y1="${y + HEAD}" x2="${x + w}" y2="${y + HEAD}" class="dg-head-line"/><text x="${x + 10}" y="${y + 21}" class="dg-name">${table.name}</text>${tag}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="dg-outline"/></g>`;
  }).join('');
  return `<svg class="play-diagram" viewBox="0 0 516 ${svgHeight}" role="img" aria-label="${escapeHtml(label)}">${linkSvg}${boxSvg}</svg>`;
}

function cellMarkup(value: Cell): string {
  if (value === null) return '<span class="play-null">NULL</span>';
  if (isId(value)) return `<button type="button" class="play-id" data-act="open-id" data-id="${escapeHtml(value)}" title="Ver ${escapeHtml(value)} em personagens">${escapeHtml(value)}</button>`;
  return escapeHtml(value);
}

function recordsBody(moment: Moment): string {
  const name = ui.recordsTable;
  const chips = tableGuide.map(table => `<button type="button" class="${moment.bank.tables.includes(table.name) ? '' : 'is-extra'} ${table.name === name ? 'is-selected' : ''}" data-act="records-table" data-table="${table.name}" aria-pressed="${table.name === name}">${table.name}</button>`).join('');
  const data = records.get(name);
  let body: string;
  if (!data) body = '<p class="play-records-loading"><span class="play-spinner" aria-hidden="true"></span> Abrindo os registros...</p>';
  else if ('error' in data) body = `<p class="play-feedback is-error">${escapeHtml(data.error)} <button type="button" class="text-button" data-act="records-table" data-table="${name}" data-retry>Tentar de novo</button></p>`;
  else {
    let matched = '';
    const rows = data.values.map(row => {
      const hit = row.find(cell => typeof cell === 'string' && ui.focusValues.includes(cell));
      if (hit !== undefined && !matched) matched = String(hit);
      return `<tr class="${hit !== undefined ? 'is-focus' : ''}">${row.map(cell => `<td>${cellMarkup(cell)}</td>`).join('')}</tr>`;
    }).join('');
    const notes = [
      data.values.some(row => row.includes(null)) ? `<p class="play-note"><span class="play-null">NULL</span> não é vazio nem zero: é “ninguém anotou”.${name === 'personagens' ? ' Deus recusou todos os apelidos, até “Chefe”.' : ''}</p>` : '',
      matched ? `<p class="play-note is-good">↑ ${code(escapeHtml(matched))} apareceu no seu resultado.${isId(matched) ? ' Agora o ID tem nome.' : ''}</p>` : ''
    ].join('');
    body = `<div class="play-scroll"><table class="play-table"><thead><tr>${data.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${notes ? `<div class="play-notes">${notes}</div>` : ''}`;
  }
  return `<div class="play-record-chips" role="group" aria-label="Escolha uma tabela">${chips}</div>${body}`;
}

function bankFoot(moment: Moment): string {
  if (ui.bankTab === 'diagram') {
    const others = tableGuide.filter(table => !moment.bank.tables.includes(table.name));
    return `<span class="play-also">${others.length ? `Também no mapa: ${others.map(table => `<span>${table.name}</span>`).join('')}` : 'Todas as tabelas do mapa estão aqui.'}</span><button type="button" class="play-link" data-act="full-map">Mapa completo ⤢</button>`;
  }
  const data = records.get(ui.recordsTable);
  const table = guide(ui.recordsTable);
  const shown = data && !('error' in data) ? data.values.length : 0;
  const summary = data && !('error' in data)
    ? shown < data.total ? `mostrando ${shown} de ${data.total} · o resto, só com SQL` : `${data.total} registros · somente leitura`
    : `${table.rows} registros`;
  return `<span>${summary}</span><code>SELECT * FROM ${table.name};</code>`;
}

function bankMarkup(): string {
  const moment = moments[state.phase];
  const tab = ui.bankTab;
  const body = tab === 'diagram'
    ? `<div class="play-bank-legend"><span>Tabelas úteis para esta pista</span><span class="play-legend"><span><i class="is-pk">PK</i>chave</span><span><i class="is-fk">FK</i>aponta para</span></span></div>${diagramSvg(moment.bank.tables, moment.bank.start, moment.bank.focus, `Diagrama das tabelas ${moment.bank.tables.join(', ')}`)}<p class="play-bank-note">${moment.bank.note}</p>`
    : recordsBody(moment);
  return `<section id="play-bank" class="play-bank" data-pane="banco" aria-labelledby="bank-title">
    <div class="play-bank-head"><div><span class="section-eyebrow">Onde procurar</span><h2 id="bank-title">Banco do Jardim</h2></div>
      <div class="play-tabs" role="tablist" aria-label="Como ver o banco">
        <button type="button" role="tab" id="bank-tab-diagram" aria-selected="${tab === 'diagram'}" aria-controls="bank-body" data-act="bank-tab" data-tab="diagram">Diagrama</button>
        <button type="button" role="tab" id="bank-tab-records" aria-selected="${tab === 'records'}" aria-controls="bank-body" data-act="bank-tab" data-tab="records">Registros</button>
      </div>
    </div>
    <div id="bank-body" class="play-bank-body is-${tab}" role="tabpanel" aria-labelledby="bank-tab-${tab}">${body}</div>
    <div class="play-bank-foot">${bankFoot(moment)}</div>
  </section>`;
}

function mapDialog(): string {
  return `<dialog id="play-map" class="play-dialog" aria-labelledby="map-title"><div class="play-dialog-head"><div><span class="section-eyebrow">Banco do Jardim</span><h2 id="map-title">Mapa completo</h2></div><button type="button" class="play-close" data-act="map-close">fechar ×</button></div><div class="play-scroll">${diagramSvg(['personagens', 'locais', 'objetos', 'visitas', 'movimentacoes'], null, [], 'Diagrama com as cinco tabelas e suas ligações')}</div><ul class="play-map-list">${tableGuide.map(table => `<li><code>${table.name}</code> ${table.description}</li>`).join('')}</ul><p class="play-bank-note">IDs ligam registros. No prólogo, os IDs com # são uma brincadeira do WorldDB.</p></dialog>`;
}

/* ---------- Consulta ---------- */

function missionMarkup(): string {
  const moment = moments[state.phase];
  const found = state.discoveries[state.phase];
  return `<div id="play-mission" class="play-mission"><span class="section-eyebrow">Sua missão · ${moment.skill}</span><h2>${moment.question}</h2><p id="play-task" class="play-task">${moment.task}</p>${found ? '' : `<p class="play-lesson">✦ ${moment.lesson}</p>`}</div>`;
}

function resultTable(columns: string[] | undefined, rows: Cell[][], found: boolean): string {
  if (columns && !columns.length) return '<p class="play-empty">A consulta não retornou colunas.</p>';
  if (!rows.length) return '<p class="play-empty">A consulta funcionou, mas não encontrou registros.</p>';
  const moment = moments[state.phase];
  const mark = (row: Cell[]) => {
    if (!found) return null;
    const cells = row.map(String);
    if (moment.highlight?.cells.every(cell => cells.includes(cell))) return { kind: 'clue', label: `<span class="play-clue-tag">${moment.highlight.label}</span>` };
    if (moment.dim?.cells.every(cell => cells.includes(cell))) return { kind: 'dim', label: moment.dim.note };
    return moment.highlight ? null : { kind: 'clue', label: '' };
  };
  const marks = rows.map(mark);
  const notes = marks.some(item => item?.label);
  const head = `<tr><th class="play-n">#</th>${(columns ?? rows[0].map(() => '')).map(column => `<th>${escapeHtml(column)}</th>`).join('')}${notes ? '<th><span class="sr-only">Nota</span></th>' : ''}</tr>`;
  const body = rows.map((row, i) => `<tr class="${marks[i] ? `is-${marks[i]!.kind}` : ''}${found && ui.justFound ? ' is-row-enter' : ''}" style="--row-delay:${i * 55 + 120}ms"><td class="play-n">${i + 1}</td>${row.map(cell => `<td>${cellMarkup(cell)}</td>`).join('')}${notes ? `<td class="play-row-note">${marks[i]?.label ?? ''}</td>` : ''}</tr>`).join('');
  return `<div class="play-scroll"><table class="play-table play-result-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>${rows.length === 100 ? '<p class="play-empty">Mostrando as primeiras 100 linhas.</p>' : ''}`;
}

function nextLabel(): string {
  return state.phase === 5 ? 'Ver a conclusão →' : 'Seguir a pista →';
}

function successBurstMarkup(): string {
  const sparks = [
    [-42, -23], [-12, -43], [25, -36], [44, -5],
    [32, 31], [0, 43], [-35, 29], [-46, 4]
  ].map(([x, y], index) => `<i style="--spark-x:${x}px;--spark-y:${y}px;--spark-delay:${index * 35}ms"></i>`).join('');
  return `<div class="play-success-burst" aria-hidden="true"><span class="play-success-ring"></span><span class="play-success-check">✓</span>${sparks}</div>`;
}

function resultInner(): string {
  const moment = moments[state.phase];
  const found = state.discoveries[state.phase];
  const motion = ui.feedbackMotion ? ` is-feedback-${ui.feedbackMotion}` : '';
  const hint = ui.hint ? `<p class="play-feedback is-hint${ui.feedbackMotion === 'hint' ? motion : ''}"><b>Dica ${Math.min(ui.hintIndex, moment.hints.length)} de ${moment.hints.length}:</b> ${escapeHtml(ui.hint)}</p>` : '';
  const success = `<p class="play-feedback is-success${motion}"><span aria-hidden="true">✦</span> ${moment.success}</p>`;
  let body: string;
  if (ui.processing) body = '<p class="play-feedback is-processing"><span class="play-spinner" aria-hidden="true"></span> Procurando nos registros...</p>';
  else if (ui.error) body = `<p class="play-feedback is-error${motion}">${escapeHtml(ui.error)}</p>`;
  else if (ui.result) body = `${ui.result.found ? success : `<p class="play-feedback is-hint${motion}">${escapeHtml(ui.result.message)}</p>`}${resultTable(ui.result.columns, ui.result.values, ui.result.found)}`;
  else if (found) body = `${success}${resultTable(found.columns, found.rows, true)}`;
  else body = '<div class="play-placeholder"><strong>O resultado da sua consulta aparecerá aqui.</strong><span>Uma linha certa preenche a lacuna da história.</span></div>';
  const foot = found ? `<div class="play-result-foot"><span>${found.rows.length} ${found.rows.length === 1 ? 'linha' : 'linhas'} · pista guardada no caderno</span><button type="button" class="outline-button play-next" data-act="next">${nextLabel()}</button></div>` : '';
  return `${ui.justFound ? successBurstMarkup() : ''}<span class="section-eyebrow">Resultado</span>${hint}${body}${foot}`;
}

function queryMarkup(): string {
  const moment = moments[state.phase];
  const guided = isGuided(moment);
  const modeButton = moment.guide && moment.free ? `<button type="button" class="text-button play-mode" data-act="free-mode" aria-pressed="${ui.freeMode}">${ui.freeMode ? 'Voltar à máscara' : 'Escrever sozinho'}</button>` : '';
  return `<section id="play-query" class="play-query" data-pane="consulta" aria-label="Consulta">
    ${missionMarkup()}
    ${editorMarkup({ id: 'sql-editor', label: 'consulta.sql', status: guided ? 'Preencha os espaços' : 'Ctrl + Enter executa', statusId: 'editor-status', tokens: moment.tokens, assist: guided ? moment.guide : undefined, describedBy: 'play-task' })}
    <div class="play-run"><button type="button" class="game-button play-run-button" data-act="run">Executar consulta →</button><button type="button" class="text-button" data-act="hint">Preciso de uma dica</button>${modeButton}${guideLink('text-button play-guide')}</div>
    <div id="play-result" class="play-result" role="status" aria-live="polite">${resultInner()}</div>
  </section>`;
}

// Abre em outra aba para não perder a consulta que está no editor.
// Os dois primeiros momentos usam o que a Documentação 01 ensina; do terceiro em diante, a 02.
function guideLink(className: string, lesson = state.phase >= 2 ? 2 : 1): string {
  return `<a class="${className}" href="/aprender/0${lesson}" target="_blank" rel="noopener">${className ? 'Consultar guia SQL' : `Guia SQL 0${lesson}`} <span aria-hidden="true">↗</span><span class="sr-only"> (abre em outra aba)</span></a>`;
}

function mobileBarMarkup(): string {
  const moment = moments[state.phase];
  const found = state.discoveries[state.phase];
  const tab = ui.mobileTab;
  let action = '';
  if (tab === 'cena') action = found ? `<button type="button" class="outline-button" data-act="next">${moment.nextLabel}</button>` : '<button type="button" class="outline-button" data-act="mobile-tab" data-tab="banco">Procurar no banco →</button>';
  else if (tab === 'banco') action = '<button type="button" class="game-button" data-act="mobile-tab" data-tab="consulta">Montar consulta →</button>';
  else if (tab === 'consulta') action = found ? `<button type="button" class="outline-button" data-act="next">${nextLabel()}</button>` : '<button type="button" class="game-button play-run-button" data-act="run">Executar consulta →</button>';
  const tabs: [MobileTab, string][] = [['cena', 'Cena'], ['banco', 'Banco'], ['consulta', 'Consulta']];
  return `<div id="play-mobile-bar" class="play-mobile-bar">${action ? `<div class="play-mobile-action">${action}</div>` : ''}<nav class="play-tabbar" aria-label="Partes do momento">${tabs.map(([id, label], i) => `<button type="button" data-act="mobile-tab" data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${id === 'cena' && found && !ui.sceneSeen && tab !== 'cena' ? '<span class="play-new">nova</span>' : ''}<small>${i + 1}</small>${label}</button>`).join('')}</nav></div>`;
}

/* ---------- Montagem ---------- */

function finalMarkup(): string {
  const final = state.discoveries[5];
  return `<main class="game-main play-final"><div class="final-confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--confetti-left:${(index + 1) * 5.2}%;--confetti-delay:${index * 42}ms"></i>`).join('')}</div><section class="final-scene paper-panel"><div class="final-art">${artFn('garden-picnic', 'festa na clareira')}</div><div><span class="chapter-pill"><span class="chapter-dot"></span> MISTÉRIO RESOLVIDO</span><h1>A fruta virou festa!</h1><p class="final-proof">${final ? moments[5].filled(final.rows) : ''}</p><p>${final ? escapeHtml(rowValue(final.rows[0], 'Guardou a fruta para a torta surpresa da festa.')) : ''}</p><p>Adão trouxe a toalha, Pardal decorou a mesa com a fita e Cobra chegou com o chapéu. Faltaram só os guardanapos.</p><div class="fiction-note">✧ História inventada para o jogo, inspirada no relato bíblico — sem data histórica</div><div class="home-actions"><a class="game-button" href="/" data-nav>Voltar ao início</a><a class="outline-button" href="/explorar" data-nav>Explorar a linha do tempo</a></div><button class="text-button" data-act="restart" type="button">Jogar de novo</button></div></section></main>`;
}

export function gameMarkup(baseArt: SceneArt): string {
  artFn = baseArt;
  if (state.phase === 6) return `${headerMarkup()}${finalMarkup()}${notesMarkup()}`;
  const found = !!state.discoveries[state.phase];
  return `<div class="play-shell" data-tab="${ui.mobileTab}" data-found="${found}"><div class="play-top">${headerMarkup()}${mobileGapMarkup()}</div><main class="play">
    ${sceneMarkup()}
    <div class="play-workspace">${bankMarkup()}${queryMarkup()}</div>
    ${mapDialog()}
  </main>${mobileBarMarkup()}${notesMarkup()}</div>`;
}

type Region = 'header' | 'scene' | 'bank' | 'mission' | 'result' | 'mobile';
function refresh(...regions: Region[]): void {
  if (!root) return;
  const swap = (id: string, html: string) => { const element = root!.querySelector(`#${id}`); if (element) element.outerHTML = html; };
  const builders: Record<Region, () => void> = {
    header: () => swap('play-header', headerMarkup()),
    scene: () => { swap('play-scene', sceneMarkup()); swap('play-mobile-gap', mobileGapMarkup()); },
    bank: () => swap('play-bank', bankMarkup()),
    mission: () => swap('play-mission', missionMarkup()),
    result: () => { const element = root!.querySelector('#play-result'); if (element) element.innerHTML = resultInner(); },
    mobile: () => swap('play-mobile-bar', mobileBarMarkup())
  };
  regions.forEach(region => builders[region]());
  const shell = root.querySelector<HTMLElement>('.play-shell');
  if (shell) {
    shell.dataset.tab = ui.mobileTab;
    shell.dataset.found = String(!!state.discoveries[state.phase]);
  }
  setBusy(ui.processing);
}

function refreshResultWithMotion(motion: FeedbackMotion): void {
  ui.feedbackMotion = motion;
  refresh('result');
  ui.feedbackMotion = '';
}

function mount(): void {
  if (!root) return;
  destroySqlEditors(root);
  root.innerHTML = gameMarkup(artFn);
  afterRender();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// A máscara guia quem está começando; quem prefere pode escrever a consulta inteira.
function isGuided(moment: Moment): boolean {
  return !!moment.guide && !(ui.freeMode && moment.free);
}

function remountQuery(): void {
  const section = root?.querySelector<HTMLElement>('#play-query');
  if (!section) return;
  destroySqlEditors(section);
  section.outerHTML = queryMarkup();
  afterRender();
  getSqlEditor(root?.querySelector<HTMLElement>('#sql-editor'))?.focus();
}

function afterRender(): void {
  const host = root?.querySelector<HTMLElement>('#sql-editor');
  if (host) {
    const moment = moments[state.phase];
    const guided = isGuided(moment);
    mountSqlEditor(host, {
      value: guided ? moment.starter : readDraft() ?? moment.free ?? moment.starter,
      guided,
      onChange: guided ? undefined : saveDraft,
      onRun: () => { void runQuery(); }
    });
  }
  if (ui.bankTab === 'records') ensureRecords(ui.recordsTable);
}

/* ---------- Anotações ---------- */

// Bloco livre do jogador. Fica fora do estado da história: sobrevive à troca de momento e a "Reiniciar história".
const notesKey = 'worlddb-garden-notes-v1';
const notesLimit = 4000;
let notes = readNotes();
let notesOpen = false;
let clearTimer = 0;

function readNotes(): string {
  try { return (localStorage.getItem(notesKey) ?? '').slice(0, notesLimit); } catch { return ''; }
}

function saveNotes(): void {
  try {
    if (notes) localStorage.setItem(notesKey, notes);
    else localStorage.removeItem(notesKey);
  } catch { /* As anotações valem só para esta visita. */ }
}

const notesIcon = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h9.5L19 7v13.5H6Z" fill="#fffdf6"/><path d="M15.5 3.5V7H19M9 11h7M9 14.5h7M9 18h4"/><path d="M4 7h3M4 11h3M4 15h3"/></svg>';

function notesMarkup(): string {
  return `<button type="button" class="play-notes-button ${notes ? 'has-notes' : ''}" data-act="notes" aria-expanded="${notesOpen}" aria-controls="play-notes" aria-label="Anotações" title="Anotações">${notesIcon}<span class="play-notes-dot" aria-hidden="true"></span></button>
  <aside id="play-notes" class="play-notes" aria-labelledby="notes-title" ${notesOpen ? '' : 'hidden'}>
    <div class="play-pop-head"><span id="notes-title" class="section-eyebrow">Suas anotações</span><button type="button" class="play-close" data-act="notes">fechar ×</button></div>
    <textarea id="play-notes-text" class="play-notes-text" maxlength="${notesLimit}" spellcheck="false" placeholder="Anote suspeitos, horários, IDs… o que ajudar na investigação." aria-labelledby="notes-title" aria-describedby="notes-status">${escapeHtml(notes)}</textarea>
    <div class="play-notes-foot"><span id="notes-status" role="status" aria-live="polite">${notesStatus()}</span><button type="button" class="text-button" data-act="notes-clear" ${notes ? '' : 'disabled'}>Limpar</button></div>
  </aside>`;
}

function notesStatus(): string {
  return notes ? `Guardado neste navegador · ${notes.length} de ${notesLimit}` : 'Fica guardado só neste navegador';
}

function syncNotes(): void {
  const status = root?.querySelector('#notes-status');
  if (status) status.textContent = notesStatus();
  const clear = root?.querySelector<HTMLButtonElement>('[data-act="notes-clear"]');
  if (clear) { clear.disabled = !notes; clear.textContent = 'Limpar'; delete clear.dataset.confirm; }
  root?.querySelectorAll('.play-notes-button').forEach(button => button.classList.toggle('has-notes', !!notes));
}

function toggleNotes(open = !notesOpen): void {
  notesOpen = open;
  const panel = root?.querySelector<HTMLElement>('#play-notes');
  const trigger = root?.querySelector<HTMLElement>('.play-notes-button');
  if (!panel) return;
  panel.hidden = !open;
  trigger?.setAttribute('aria-expanded', String(open));
  if (open) {
    closePopovers();
    const text = panel.querySelector<HTMLTextAreaElement>('#play-notes-text');
    text?.focus();
    text?.setSelectionRange(text.value.length, text.value.length);
  } else if (panel.contains(document.activeElement)) trigger?.focus();
}

// Apagar pede um segundo clique, para um toque sem querer não levar as anotações embora.
function clearNotes(button: HTMLElement): void {
  window.clearTimeout(clearTimer);
  if (!button.dataset.confirm) {
    button.dataset.confirm = 'true';
    button.textContent = 'Apagar tudo?';
    clearTimer = window.setTimeout(syncNotes, 3500);
    return;
  }
  notes = '';
  saveNotes();
  const text = root?.querySelector<HTMLTextAreaElement>('#play-notes-text');
  if (text) { text.value = ''; text.focus(); }
  syncNotes();
}

/* ---------- Rascunho ---------- */

// v3 reinicia rascunhos criados antes de os campos guiados permanecerem editáveis.
const draftKey = 'worlddb-garden-draft-v3';

function readDraft(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey) || 'null') as { phase: number; sql: string } | null;
    return saved && saved.phase === state.phase && typeof saved.sql === 'string' ? saved.sql : null;
  } catch { return null; }
}

function saveDraft(sql: string): void {
  try { localStorage.setItem(draftKey, JSON.stringify({ phase: state.phase, sql })); } catch { /* Rascunho opcional. */ }
}

function clearDraft(): void {
  try { localStorage.removeItem(draftKey); } catch { /* Rascunho opcional. */ }
}

/* ---------- Banco SQL ---------- */

function ensureRecords(name: string): void {
  if (records.has(name) || loadingRecords.has(name)) return;
  const table = guide(name);
  loadingRecords.add(name);
  Promise.all([
    execute(`SELECT * FROM ${name}${table.preview === 'all' ? '' : ` LIMIT ${table.preview}`}`),
    execute(`SELECT COUNT(*) FROM ${name}`)
  ]).then(([rows, count]) => {
    records.set(name, { columns: rows.columns, values: rows.values, total: Number(count.values[0][0]) });
  }).catch(() => {
    records.set(name, { error: 'Não consegui abrir os registros.' });
  }).finally(() => {
    loadingRecords.delete(name);
    if (ui.bankTab === 'records' && ui.recordsTable === name) refresh('bank');
  });
}

function readableError(message: string): string {
  if (message.includes('no such table')) return `Não encontrei essa tabela. Confira o Banco do Jardim. (${message})`;
  if (message.includes('no such column')) return `Não encontrei essa coluna. Confira os nomes no diagrama. (${message})`;
  if (message.includes('syntax error') || message.includes('incomplete input')) return `Há um erro na escrita da consulta. Confira SELECT, FROM, WHERE, JOIN, nomes e aspas. (${message})`;
  return message;
}

function setBusy(busy: boolean): void {
  root?.querySelectorAll<HTMLButtonElement>('.play-run-button').forEach(button => {
    button.disabled = busy;
    button.textContent = busy ? 'Consultando...' : 'Executar consulta →';
  });
}

async function runQuery(): Promise<void> {
  const editor = getSqlEditor(root?.querySelector<HTMLElement>('#sql-editor'));
  if (!editor || ui.processing) return;
  if (editor.remainingSlots) {
    ui.error = `Preencha ${editor.remainingSlots === 1 ? 'o espaço que falta' : `os ${editor.remainingSlots} espaços que faltam`} antes de executar.`;
    setEditorStatus(editor, `${editor.remainingSlots} ${editor.remainingSlots === 1 ? 'espaço restante' : 'espaços restantes'}`);
    refreshResultWithMotion('error');
    return;
  }
  if (!editor.executableValue.replace(/--[^\n]*/g, '').trim()) {
    ui.error = 'Digite uma consulta antes de executar.';
    refreshResultWithMotion('error');
    return;
  }
  playSound('click');
  const phase = state.phase;
  ui.processing = true;
  ui.error = '';
  setEditorStatus(editor, 'consultando…');
  refresh('result');
  const started = performance.now();
  try {
    const result = await execute(editor.executableValue);
    if (state.phase !== phase || !editor.isConnected) return;
    const elapsed = Math.max(1, Math.round(performance.now() - started));
    ui.processing = false;
    const discovery = matchingDiscovery(result, phase);
    setEditorStatus(editor, `✓ executada em ${elapsed} ms`, 'is-ok');
    if (discovery) {
      const fresh = !state.discoveries[phase];
      state.discoveries[phase] = discovery;
      saveStory();
      playSound('clue');
      ui.result = { ...result, found: true };
      ui.hint = '';
      if (fresh) {
        ui.justFound = true;
        ui.sceneSeen = ui.mobileTab === 'cena';
        const moment = moments[phase];
        const clueRow = discovery.rows.find(row => moment.highlight?.cells.every(cell => row.map(String).includes(cell))) ?? discovery.rows[0];
        ui.focusValues = clueRow.filter((cell): cell is string => typeof cell === 'string');
        // No computador, o banco já abre o registro que dá nome ao ID encontrado.
        if (phase > 0 && clueRow.some(isId) && !mobileLayout.matches) {
          ui.bankTab = 'records';
          ui.recordsTable = 'personagens';
          ensureRecords('personagens');
        }
      }
      ui.feedbackMotion = fresh ? 'success' : '';
      refresh('header', 'scene', 'bank', 'mission', 'result', 'mobile');
      ui.justFound = false;
      ui.feedbackMotion = '';
    } else {
      const moment = moments[phase];
      const message = state.discoveries[phase]
        ? 'Consulta válida. A pista deste momento já está no caderno.'
        : `Consulta válida, mas essa ainda não fecha a pista. ${moment.hints[Math.min(ui.hintIndex++, moment.hints.length - 1)]}`;
      ui.result = { ...result, found: false, message };
      refreshResultWithMotion('hint');
    }
  } catch (error) {
    if (state.phase !== phase || !editor.isConnected) return;
    ui.processing = false;
    ui.result = null;
    ui.error = readableError(error instanceof Error ? error.message : 'Erro desconhecido.');
    setEditorStatus(editor, '✕ a consulta não rodou', 'is-error');
    refreshResultWithMotion('error');
  }
}

/* ---------- Interação ---------- */

function togglePopover(id: 'play-journal' | 'play-menu', open?: boolean): void {
  const popover = root?.querySelector<HTMLElement>(`#${id}`);
  const trigger = root?.querySelector<HTMLElement>(`[aria-controls="${id}"]`);
  if (!popover || !trigger) return;
  const next = open ?? popover.hidden;
  popover.hidden = !next;
  trigger.setAttribute('aria-expanded', String(next));
}

// No celular o bloco ocupa o mesmo lugar do caderno e do menu, então abrir um fecha o outro.
function toggleNotesForPopover(): void {
  if (notesOpen && mobileLayout.matches) toggleNotes(false);
}

function closePopovers(): void {
  togglePopover('play-journal', false);
  togglePopover('play-menu', false);
}

function setMobileTab(tab: MobileTab): void {
  ui.mobileTab = tab;
  if (tab === 'cena') ui.sceneSeen = true;
  refresh('mobile');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function completionMarkup(final: boolean): string {
  const label = final ? 'Mistério resolvido!' : 'Pista guardada!';
  const detail = final ? 'Você conectou todas as pistas do Jardim.' : `Momento ${state.phase + 1} de ${moments.length} concluído`;
  return `<div class="play-complete-overlay" role="status" aria-live="assertive">
    <div class="play-complete-card">
      <span class="play-complete-check" aria-hidden="true">✓</span>
      <span class="section-eyebrow">${detail}</span>
      <strong>${label}</strong>
    </div>
    <span class="play-complete-orbit" aria-hidden="true"></span>
  </div>`;
}

async function advanceMoment(): Promise<void> {
  if (!root || advancing || !state.discoveries[state.phase]) return;
  advancing = true;
  const activeController = controller;
  const final = state.phase === 5;
  playSound(final ? 'finish' : 'click');
  root.querySelectorAll<HTMLButtonElement>('[data-act="next"]').forEach(button => { button.disabled = true; });
  if (!reducedMotion.matches) {
    root.insertAdjacentHTML('beforeend', completionMarkup(final));
    await new Promise(resolve => window.setTimeout(resolve, final ? 900 : 720));
  }
  if (activeController?.signal.aborted) {
    advancing = false;
    return;
  }
  state.phase++;
  saveStory();
  clearDraft();
  ui = freshUi();
  advancing = false;
  mount();
}

function onClick(event: MouseEvent): void {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  if (act === 'journal' || act === 'menu') toggleNotesForPopover();
  if (act === 'journal') { togglePopover('play-menu', false); togglePopover('play-journal'); }
  else if (act === 'menu') { togglePopover('play-journal', false); togglePopover('play-menu'); }
  else if (act === 'notes') toggleNotes();
  else if (act === 'notes-clear') clearNotes(target);
  else if (act === 'sound') {
    soundEnabled = !soundEnabled;
    saveSound();
    root?.querySelectorAll<HTMLButtonElement>('[data-act="sound"]').forEach(button => {
      button.textContent = soundLabel();
      button.setAttribute('aria-pressed', String(soundEnabled));
    });
    if (soundEnabled) playSound('click');
  } else if (act === 'restart') {
    playSound('click');
    state = { phase: 0, discoveries: Array(6).fill(null) };
    saveStory();
    clearDraft();
    database.reset(new Error('A história foi reiniciada.'));
    records.clear();
    ui = freshUi();
    mount();
  } else if (act === 'next') {
    void advanceMoment();
  } else if (act === 'bank-tab') {
    ui.bankTab = target.dataset.tab as BankTab;
    if (ui.bankTab === 'records') ensureRecords(ui.recordsTable);
    refresh('bank');
    root?.querySelector<HTMLElement>(`#bank-tab-${ui.bankTab}`)?.focus();
  } else if (act === 'records-table') {
    const name = target.dataset.table!;
    if (target.hasAttribute('data-retry')) records.delete(name);
    ui.recordsTable = name;
    ensureRecords(name);
    refresh('bank');
    root?.querySelector<HTMLElement>(`[data-act="records-table"][data-table="${name}"]`)?.focus();
  } else if (act === 'open-id') {
    ui.bankTab = 'records';
    ui.recordsTable = 'personagens';
    ui.focusValues = [target.dataset.id!];
    ensureRecords('personagens');
    if (mobileLayout.matches) setMobileTab('banco');
    refresh('bank');
    if (!mobileLayout.matches) root?.querySelector('#play-bank')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  } else if (act === 'full-map') root?.querySelector<HTMLDialogElement>('#play-map')?.showModal();
  else if (act === 'map-close') root?.querySelector<HTMLDialogElement>('#play-map')?.close();
  else if (act === 'run') void runQuery();
  else if (act === 'hint') {
    playSound('click');
    const hints = moments[state.phase].hints;
    ui.hint = hints[Math.min(ui.hintIndex++, hints.length - 1)];
    refreshResultWithMotion('hint');
  } else if (act === 'free-mode') {
    ui.freeMode = !ui.freeMode;
    ui.error = '';
    remountQuery();
  } else if (act === 'mobile-tab') setMobileTab(target.dataset.tab as MobileTab);
  else if (act === 'token') insertToken(target);
}

export function disposeGame(): void {
  controller?.abort();
  destroySqlEditors(root);
  controller = undefined;
}

export function bindGame(app: HTMLDivElement, sceneArt: SceneArt): void {
  disposeGame();
  controller = new AbortController();
  const { signal } = controller;
  root = app;
  artFn = sceneArt;
  app.addEventListener('click', onClick, { signal });
  app.addEventListener('click', event => {
    const dialog = event.target as HTMLElement;
    if (dialog instanceof HTMLDialogElement && dialog.id === 'play-map') dialog.close();
  }, { signal });
  document.addEventListener('click', event => {
    if (!(event.target as HTMLElement).closest('.play-pop-wrap')) closePopovers();
  }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (notesOpen && root?.querySelector('#play-notes')?.contains(document.activeElement)) { toggleNotes(false); return; }
    const open = root?.querySelector<HTMLElement>('.play-popover:not([hidden])');
    if (!open) return;
    closePopovers();
    root?.querySelector<HTMLElement>(`[aria-controls="${open.id}"]`)?.focus();
  }, { signal });
  mobileLayout.addEventListener('change', () => { if (state.phase < 6) refresh('mobile'); }, { signal });
  app.addEventListener('input', event => {
    const text = event.target as HTMLTextAreaElement;
    if (text.id !== 'play-notes-text') return;
    notes = text.value.slice(0, notesLimit);
    saveNotes();
    window.clearTimeout(clearTimer);
    syncNotes();
  }, { signal });
  afterRender();
}

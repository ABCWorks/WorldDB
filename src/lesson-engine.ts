import { createSqlClient, type Cell, type QueryResult } from './sql-client';
import { destroySqlEditors, editorMarkup, escapeHtml, getSqlEditor, highlightSql, insertToken, mountSqlEditor, setEditorStatus } from './sql-ui';
import { judgeResult } from './lesson-judge';
import type { Exercise, LessonQuery } from './lesson-data';
import './lesson.css';

// Motor das documentações a partir da 02: passos, exemplos que rodam na base de treino e exercícios
// corrigidos pelo resultado. A Documentação 01 tem ilustrações próprias e continua em lesson.ts.

type GridOptions = { label?: string; title?: string; highlightCols?: string[] };
export type LessonTools = {
  /** Resultado de um exemplo, rodado de verdade na base de treino. */
  answer: (key: string, options?: GridOptions) => string;
  query: (sql: string, caption?: string) => string;
  code: (value: string) => string;
};
export type LessonStep = { short: string; title: string; text: (tools: LessonTools) => string; visual: (tools: LessonTools) => string; exercise?: string };
export type LessonConfig = {
  number: string;
  path: string;
  storageKey: string;
  database: Parameters<typeof createSqlClient>[0];
  pill: string;
  heading: string;
  intro: string;
  /** Tabelas da base de treino, para as mensagens de erro. */
  tables: string[];
  steps: LessonStep[];
  examples: Record<string, LessonQuery>;
  exercises: Exercise[];
  finale: (tools: LessonTools) => string;
  previous?: { href: string; label: string };
};

type Feedback = { tone: 'success' | 'hint' | 'error' | 'busy'; html: string };
type Saved = { step: number; reached: number; solved: string[]; finished: boolean };

export function createLesson(config: LessonConfig) {
  const { steps, examples, exercises } = config;
  const database = createSqlClient(config.database);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const results = new Map<string, QueryResult | Error>();
  const drafts = new Map<string, string>();
  const hintLevel = new Map<string, number>();
  const feedback = new Map<string, Feedback>();
  const idle = 'base de treino · Ctrl + Enter testa';
  const saved = readSaved();
  let root: HTMLElement | undefined;
  let controller: AbortController | undefined;
  let examplesRequested = false;
  let entering = false;

  function readSaved(): Saved {
    try {
      const value = JSON.parse(localStorage.getItem(config.storageKey) || 'null') as Saved | null;
      if (value && Number.isInteger(value.step) && Array.isArray(value.solved)) {
        const step = Math.min(Math.max(value.step, 0), steps.length - 1);
        return { step, reached: Math.max(step, Number(value.reached) || 0), solved: value.solved.filter(id => typeof id === 'string'), finished: !!value.finished };
      }
    } catch { /* Armazenamento opcional. */ }
    return { step: 0, reached: 0, solved: [], finished: false };
  }

  function save(): void {
    try { localStorage.setItem(config.storageKey, JSON.stringify(saved)); } catch { /* A aula funciona sem armazenamento. */ }
  }

  const code = (value: string) => `<code>${escapeHtml(value)}</code>`;
  const cell = (value: Cell) => value === null ? '<span class="play-null">NULL</span>' : escapeHtml(value);

  function grid(table: QueryResult, options: GridOptions): string {
    const hl = (column: string) => options.highlightCols?.includes(column) ? 'is-hl' : '';
    const head = table.columns.map(column => `<th scope="col" class="${hl(column)}">${escapeHtml(column)}</th>`).join('');
    const body = table.values.map(row => `<tr>${row.map((value, i) => `<td class="${hl(table.columns[i])}">${cell(value)}</td>`).join('')}</tr>`).join('');
    return `<div class="lesson-grid-wrap"><table class="lesson-grid" aria-label="${escapeHtml(options.label ?? 'Resultado')}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  const tools: LessonTools = {
    code,
    query: (sql, caption = 'consulta') => `<figure class="lesson-query"><figcaption>${caption}</figcaption><pre><code>${highlightSql(sql)}</code></pre></figure>`,
    answer(key, options = {}) {
      const result = results.get(key);
      const title = options.title ?? 'O banco responde';
      if (!result) return `<div class="lesson-answer"><span class="section-eyebrow">${title}</span><p class="lesson-loading"><span class="play-spinner" aria-hidden="true"></span> A base de treino está acordando…</p></div>`;
      if (result instanceof Error) return `<div class="lesson-answer"><p class="lesson-feedback is-error">Não consegui rodar este exemplo: ${escapeHtml(result.message)}</p></div>`;
      const count = `${result.values.length} ${result.values.length === 1 ? 'linha' : 'linhas'}`;
      return `<div class="lesson-answer"><span class="section-eyebrow">${title} · ${count}</span>${grid(result, { ...options, label: options.label ?? `Resultado de ${examples[key].sql}` })}</div>`;
    }
  };

  /* ---------- Exercícios ---------- */

  const findExercise = (id: string | undefined) => exercises.find(item => item.id === id);

  function feedbackMarkup(exercise: Exercise): string {
    const level = hintLevel.get(exercise.id) ?? 0;
    const hints = exercise.hints.slice(0, level).map((hint, i) => `<p class="lesson-feedback is-hint"><b>Dica ${i + 1}:</b> ${escapeHtml(hint)}</p>`).join('');
    const current = feedback.get(exercise.id);
    return `${hints}${current ? `<div class="lesson-feedback is-${current.tone}">${current.html}</div>` : ''}`;
  }

  function exerciseHead(exercise: Exercise): string {
    const solved = saved.solved.includes(exercise.id);
    return `<div class="lesson-try-head"><span class="lesson-try-badge">Tente você · ${exercises.indexOf(exercise) + 1} de ${exercises.length}</span>${solved ? '<span class="lesson-try-done">✓ resolvido</span>' : ''}</div>`;
  }

  function exerciseMarkup(exercise: Exercise): string {
    const level = hintLevel.get(exercise.id) ?? 0;
    const id = `try-${exercise.id}`;
    return `<section class="lesson-try" aria-labelledby="${id}-title">
      ${exerciseHead(exercise)}
      <h3 id="${id}-title" class="lesson-try-task">${exercise.task}</h3>
      ${editorMarkup({ id, label: 'treino.sql', status: idle, tokens: exercise.tokens, describedBy: `${id}-title` })}
      <div class="lesson-try-actions">
        <button type="button" class="game-button lesson-try-run" data-act="try" data-ex="${exercise.id}">Testar consulta</button>
        <button type="button" class="text-button" data-act="try-hint" data-ex="${exercise.id}" ${level >= exercise.hints.length ? 'disabled' : ''}>${level ? 'Ver outra dica' : 'Ver uma dica'}</button>
        <button type="button" class="text-button" data-act="try-reset" data-ex="${exercise.id}">Recomeçar</button>
      </div>
      <div id="${id}-feedback" class="lesson-try-feedback" role="status" aria-live="polite">${feedbackMarkup(exercise)}</div>
    </section>`;
  }

  function friendlyError(message: string): string {
    const column = /no such column: ([^\s]+)/.exec(message);
    if (column) return `O banco procurou uma coluna chamada ${code(column[1])} e não achou. Confira o nome e o apelido da tabela. Se for um texto, coloque entre aspas simples.`;
    const table = /no such table: ([^\s]+)/.exec(message);
    if (table) return `Não existe a tabela ${code(table[1])} na base de treino. As tabelas daqui são ${config.tables.map(code).join(', ')}.`;
    const ambiguous = /ambiguous column name: ([^\s]+)/.exec(message);
    if (ambiguous) return `Mais de uma tabela tem a coluna ${code(ambiguous[1])}. Diga de qual você quer: ${code(`tabela.${ambiguous[1]}`)}.`;
    const near = /near "([^"]*)": syntax error/.exec(message);
    if (near) return `Algo na escrita não encaixou perto de ${code(near[1])}. Confira a ordem das peças: SELECT → FROM → JOIN … ON → WHERE → ORDER BY → LIMIT.`;
    if (message.startsWith('Use uma única consulta de leitura')) return `Na base de treino só dá para ler: toda consulta começa com ${code('SELECT')}.`;
    if (message.includes('incomplete input')) return 'A consulta parou no meio do caminho. Falta completar alguma parte?';
    return escapeHtml(message);
  }

  function verdictMarkup(result: QueryResult, exercise: Exercise, sql: string): { ok: boolean; html: string } {
    const verdict = judgeResult(result, exercise.expected, exercise.ordered);
    const table = result.values.length ? grid(result, { label: 'Resultado da sua consulta' }) : '';
    if (verdict.ok) return { ok: true, html: `<p><b>✦ Isso!</b> ${exercise.success}</p>${table}` };
    const want = exercise.expected.rows.length;
    const got = result.values.length;
    const messages: Record<typeof verdict.reason, string> = {
      columns: `A resposta tem ${exercise.expected.columns.length} ${exercise.expected.columns.length === 1 ? 'coluna' : 'colunas'}, e vieram ${result.columns.length}. Peça só o que a tarefa pede.`,
      empty: 'A consulta rodou, mas nenhuma linha passou. Confira os valores do filtro: letras, acentos e aspas precisam bater certinho.',
      more: `Vieram ${got} linhas, mas a resposta tem ${want}. Faltou algum filtro ou limite?`,
      fewer: `Vieram ${got} ${got === 1 ? 'linha' : 'linhas'}, e a resposta tem ${want}. Alguma condição ficou apertada demais.`,
      different: 'A quantidade de linhas bate, mas o conteúdo não. Confira as colunas pedidas e as condições.',
      order: /order\s+by/i.test(sql) ? `Quase! As linhas estão certas, mas a ordem está invertida: ${code('ASC')} sobe, ${code('DESC')} desce.` : `As linhas estão certas, mas faltou pedir a ordem com ${code('ORDER BY')}.`
    };
    return { ok: false, html: `<p>${messages[verdict.reason]}</p>${table}` };
  }

  async function runExercise(id: string): Promise<void> {
    const exercise = findExercise(id);
    const editor = getSqlEditor(root?.querySelector<HTMLElement>(`#try-${id}`));
    if (!exercise || !editor || feedback.get(id)?.tone === 'busy') return;
    const sql = editor.value;
    if (!sql.replace(/--[^\n]*/g, '').trim()) {
      feedback.set(id, { tone: 'hint', html: '<p>Escreva uma consulta antes de testar. O modelo já dá um empurrãozinho.</p>' });
      refreshExercise(exercise);
      return;
    }
    feedback.set(id, { tone: 'busy', html: '<p><span class="play-spinner" aria-hidden="true"></span> Perguntando à base de treino…</p>' });
    refreshExercise(exercise);
    try {
      const verdict = verdictMarkup(await database.execute(sql), exercise, sql);
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
  }

  /* ---------- Montagem ---------- */

  function progressMarkup(): string {
    const percent = (saved.step + 1) * 100 / steps.length;
    return `<nav id="lesson-progress" class="lesson-progress" aria-label="Passos da aula"><ol>${steps.map((step, i) => {
      const done = i < saved.reached || (i === steps.length - 1 && saved.finished);
      return `<li><button type="button" data-act="step" data-step="${i}" ${i === saved.step ? 'aria-current="step"' : ''} class="${done ? 'is-done' : ''}" aria-label="Passo ${i + 1}: ${step.title}${done ? ' (visto)' : ''}"><span class="lesson-progress-n">${done && i !== saved.step ? '✓' : i + 1}</span><span class="lesson-progress-label">${step.short}</span></button></li>`;
    }).join('')}</ol><span class="lesson-progress-bar" aria-hidden="true"><span style="width:${percent}%"></span></span></nav>`;
  }

  function navMarkup(): string {
    const last = saved.step === steps.length - 1;
    return `<div class="lesson-nav">
      <button type="button" class="outline-button lesson-prev" data-act="prev" ${saved.step === 0 ? 'disabled' : ''}><span aria-hidden="true">←</span><span class="lesson-nav-text"> Voltar</span></button>
      <span class="lesson-count">Passo ${saved.step + 1} de ${steps.length}</span>
      ${last
        ? '<span></span>'
        : `<button type="button" class="game-button lesson-next" data-act="next"><span class="lesson-nav-text">Próximo: </span>${steps[saved.step + 1].title} <span aria-hidden="true">→</span></button>`}
    </div>`;
  }

  function stepMarkup(): string {
    const index = saved.step;
    const step = steps[index];
    const exercise = findExercise(step.exercise);
    return `<article id="lesson-step" class="lesson-step ${entering ? 'is-entering' : ''}" aria-labelledby="lesson-step-title">
      <header class="lesson-step-head"><span class="section-eyebrow">Passo ${index + 1} de ${steps.length}</span><h2 id="lesson-step-title" tabindex="-1">${step.title}</h2></header>
      <div class="lesson-columns"><div class="lesson-text">${step.text(tools)}</div><div id="lesson-visual" class="lesson-visual">${step.visual(tools)}</div></div>
      ${exercise ? exerciseMarkup(exercise) : ''}
      ${index === steps.length - 1 ? config.finale(tools) : ''}
    </article>`;
  }

  function lessonMarkup(): string {
    const hash = /^#passo-(\d)$/.exec(location.hash);
    if (hash) {
      saved.step = Math.min(Math.max(Number(hash[1]) - 1, 0), steps.length - 1);
      saved.reached = Math.max(saved.reached, saved.step);
    }
    return `<main class="lesson" id="top">
      <section class="lesson-intro">
        <div>
          <span class="chapter-pill"><span class="chapter-dot"></span> ${config.pill}</span>
          <h1>${config.heading}</h1>
          <p>${config.intro}</p>
        </div>
        <div class="lesson-skip">
          ${config.previous ? `<a class="text-link" href="${config.previous.href}" data-nav>${config.previous.label}</a>` : ''}
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
        value: drafts.get(id) ?? findExercise(id)!.starter,
        onChange: value => drafts.set(id, value),
        onRun: () => { void runExercise(id); }
      });
    });
  }

  function renderStep(focusSelector?: string): void {
    if (!root) return;
    const body = root.querySelector('#lesson-body')!;
    destroySqlEditors(body);
    body.innerHTML = stepMarkup();
    root.querySelector('.lesson-nav')!.outerHTML = navMarkup();
    root.querySelector('#lesson-progress')!.outerHTML = progressMarkup();
    initEditors();
    if (focusSelector) root.querySelector<HTMLElement>(focusSelector)?.focus();
  }

  function goTo(step: number): void {
    if (step < 0 || step >= steps.length) return;
    saved.step = step;
    saved.reached = Math.max(saved.reached, step);
    if (step === steps.length - 1) saved.finished = true;
    save();
    history.replaceState(history.state, '', `${config.path}#passo-${step + 1}`);
    entering = true;
    renderStep('#lesson-step-title');
    entering = false;
    root?.querySelector('#lesson-progress')?.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }

  function loadExamples(): void {
    if (examplesRequested) return;
    examplesRequested = true;
    Object.keys(examples).forEach(key => {
      database.execute(examples[key].sql)
        .then(result => { results.set(key, result); })
        .catch(error => { results.set(key, error instanceof Error ? error : new Error(String(error))); })
        .finally(() => {
          // Só a coluna visual é redesenhada: o editor do exercício não perde o foco nem o texto.
          const visual = root?.querySelector('#lesson-visual');
          if (visual) visual.innerHTML = steps[saved.step].visual(tools);
        });
    });
  }

  function onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const act = target.dataset.act;
    const exercise = findExercise(target.dataset.ex);
    if (act === 'next') goTo(saved.step + 1);
    else if (act === 'prev') goTo(saved.step - 1);
    else if (act === 'step') goTo(Number(target.dataset.step));
    else if (act === 'finish') { saved.finished = true; saved.reached = steps.length - 1; save(); }
    else if (act === 'token') insertToken(target);
    else if (!exercise) return;
    else if (act === 'try') void runExercise(exercise.id);
    else if (act === 'try-hint') {
      hintLevel.set(exercise.id, Math.min((hintLevel.get(exercise.id) ?? 0) + 1, exercise.hints.length));
      refreshExercise(exercise);
      if (target.hasAttribute('disabled')) getSqlEditor(root?.querySelector<HTMLElement>(`#try-${exercise.id}`))?.focus();
    } else if (act === 'try-reset') {
      const editor = getSqlEditor(root?.querySelector<HTMLElement>(`#try-${exercise.id}`));
      drafts.delete(exercise.id);
      feedback.delete(exercise.id);
      if (editor) { editor.value = exercise.starter; setEditorStatus(editor, idle); editor.focus(); }
      refreshExercise(exercise);
    }
  }

  function disposeLesson(): void {
    controller?.abort();
    destroySqlEditors(root);
    controller = undefined;
  }

  function bindLesson(app: HTMLElement): void {
    disposeLesson();
    controller = new AbortController();
    root = app;
    app.addEventListener('click', onClick, { signal: controller.signal });
    history.replaceState(history.state, '', `${config.path}#passo-${saved.step + 1}`);
    save();
    initEditors();
    loadExamples();
  }

  return { lessonMarkup, bindLesson, disposeLesson };
}

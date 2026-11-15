import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { sql, SQLite } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';
import { Decoration, type DecorationSet, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, MatchDecorator, placeholder, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import { classHighlighter, highlightTree, tags } from '@lezer/highlight';
import { escapeHtml } from './html';
import { createSqlSlot, findSqlSlots, resolveSqlSlots, slotPattern, type SqlAssist } from './sql-slots';
import './sql-editor.css';

export { escapeHtml } from './html';
export { createSqlSlot, type SqlAssist } from './sql-slots';

// CodeMirror 6 foi escolhido por ser modular, acessível e ter suporte oficial a SQL/SQLite.
// A mesma configuração é usada no jogo e na documentação para evitar dois comportamentos de edição.

const sqlite = sql({ dialect: SQLite });
class SqlSlotWidget extends WidgetType {
  constructor(readonly label: string, readonly value: string) { super(); }

  override eq(other: SqlSlotWidget): boolean {
    return other.label === this.label && other.value === this.value;
  }

  toDOM(): HTMLElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `cm-sql-slot${this.value ? ' is-filled' : ''}`;
    element.textContent = this.value || this.label;
    element.dataset.slotLabel = this.label;
    element.setAttribute('aria-label', `${this.value ? `${this.label}: ${this.value}` : `Preencher ${this.label}`}. Selecionar campo.`);
    element.setAttribute('aria-pressed', 'false');
    return element;
  }
}

const slotMatcher = new MatchDecorator({
  regexp: slotPattern,
  decoration: match => Decoration.replace({
    widget: new SqlSlotWidget(decodeURIComponent(match[1]), decodeURIComponent(match[2])),
    inclusive: false
  })
});

const sqlSlots = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = slotMatcher.createDeco(view);
  }

  update(update: ViewUpdate): void {
    this.decorations = slotMatcher.updateDeco(update, this.decorations);
  }
}, {
  decorations: value => value.decorations,
  provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations ?? Decoration.none)
});
const sqlHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#ffcf62', fontWeight: '600' },
  { tag: [tags.number, tags.string, tags.bool, tags.atom], color: '#ef9b6b' },
  { tag: tags.comment, color: '#9a9bb1', fontStyle: 'italic' },
  { tag: [tags.variableName, tags.propertyName, tags.typeName], color: '#fff9e9' },
  { tag: tags.operator, color: '#9ed7e0' },
  { tag: tags.invalid, color: '#ff9d88', textDecoration: 'underline wavy' }
]);

const editorTheme = EditorView.theme({
  '&': { color: '#fff9e9', backgroundColor: '#34364a', height: '100%', maxWidth: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: "'DM Mono', monospace", lineHeight: '1.75', overflow: 'auto' },
  '.cm-content': { minHeight: '148px', padding: '14px 0', caretColor: '#fff9e9' },
  '.cm-line': { padding: '0 16px 0 8px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#fff9e9' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#ffffff38' },
  '.cm-gutters': { backgroundColor: '#34364a', color: '#77788f', border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '34px', padding: '0 10px 0 6px' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#ffffff0a' },
  '.cm-placeholder': { color: '#8a8ba3', fontStyle: 'normal' }
}, { dark: true });

/** Realce dos exemplos estáticos usando o parser SQL, sem regex manual. */
export function highlightSql(source: string): string {
  let html = '';
  let position = 0;
  highlightTree(sqlite.language.parser.parse(source), classHighlighter, (from, to, classes) => {
    html += escapeHtml(source.slice(position, from));
    html += `<span class="${classes}">${escapeHtml(source.slice(from, to))}</span>`;
    position = to;
  });
  return html + escapeHtml(source.slice(position));
}

type EditorMarkupOptions = {
  id: string;
  label: string;
  status: string;
  statusId?: string;
  tokens: string[];
  assist?: SqlAssist;
  describedBy?: string;
  placeholder?: string;
};

type MountOptions = {
  value: string;
  guided?: boolean;
  onChange?: (value: string) => void;
  onRun?: () => void;
};

export class SqlEditor {
  constructor(readonly host: HTMLElement, readonly view: EditorView, readonly guided: boolean, private readonly cleanup?: () => void) {}

  get value(): string {
    return this.view.state.doc.toString();
  }

  set value(value: string) {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: value },
      selection: { anchor: value.length },
      scrollIntoView: true
    });
  }

  get isConnected(): boolean {
    return this.host.isConnected && this.view.dom.isConnected;
  }

  get executableValue(): string {
    return resolveSqlSlots(this.value);
  }

  get remainingSlots(): number {
    return findSqlSlots(this.value).filter(slot => !slot.value).length;
  }

  selectSlot(label: string): void {
    this.host.dataset.activeSlot = label;
    this.host.querySelectorAll<HTMLButtonElement>('.cm-sql-slot').forEach(slot => {
      const selected = slot.dataset.slotLabel === label;
      slot.classList.toggle('is-selected', selected);
      slot.setAttribute('aria-pressed', String(selected));
    });
    const tokens = this.host.closest('.play-editor')?.querySelector<HTMLElement>('.play-tokens.is-guided');
    if (!tokens) return;
    const baseLabel = tokens.dataset.baseLabel ?? 'Escolha um valor para';
    const visibleLabel = `${baseLabel} ${label}:`;
    tokens.setAttribute('aria-label', visibleLabel);
    const labelElement = tokens.querySelector<HTMLElement>('.play-tokens-label');
    if (labelElement) labelElement.textContent = visibleLabel;
    const currentValue = findSqlSlots(this.value).find(slot => slot.label === label)?.value;
    tokens.querySelectorAll<HTMLButtonElement>('[data-slot-target]').forEach(button => {
      const belongsToSlot = button.dataset.slotTarget === label;
      const selected = belongsToSlot && button.dataset.token === currentValue;
      button.hidden = !belongsToSlot;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  /** Põe o valor no espaço indicado e passa a seleção para o próximo espaço vazio. */
  fillSlot(label: string, token: string): boolean {
    const slot = findSqlSlots(this.value).find(candidate => candidate.label === label);
    if (!slot) return false;
    const replacement = createSqlSlot(slot.label, token);
    this.view.dispatch({
      changes: { from: slot.from, to: slot.to, insert: replacement },
      selection: { anchor: slot.from + replacement.length },
      scrollIntoView: true
    });
    const slots = findSqlSlots(this.value);
    const remaining = slots.filter(candidate => !candidate.value).length;
    this.selectSlot((slots.find(candidate => !candidate.value) ?? slot).label);
    setEditorStatus(
      this,
      remaining ? `${remaining} ${remaining === 1 ? 'espaço restante' : 'espaços restantes'}` : 'Consulta completa · Ctrl + Enter executa',
      remaining ? '' : 'is-ok'
    );
    return true;
  }

  focus(): void {
    this.view.focus();
  }

  destroy(): void {
    this.cleanup?.();
    this.view.destroy();
  }
}

const mountedEditors = new WeakMap<HTMLElement, SqlEditor>();

export function editorMarkup(options: EditorMarkupOptions): string {
  const labelId = `${options.id}-label`;
  const describedBy = [options.describedBy, options.statusId].filter(Boolean).join(' ');
  const firstField = options.assist?.fields[0];
  const tokenLabel = options.assist && firstField ? `${options.assist.label} ${firstField.slot}:` : 'Blocos SQL para inserir no cursor:';
  const tokenClass = options.assist ? 'play-tokens is-guided' : 'play-tokens is-shortcuts';
  const tokenButtons = options.assist
    ? options.assist.fields.flatMap((field, fieldIndex) => field.choices.map(token => `<button type="button" data-act="token" data-token="${escapeHtml(token)}" data-fill-slot="true" data-slot-target="${escapeHtml(field.slot)}" aria-label="Usar ${escapeHtml(token)} no campo ${escapeHtml(field.slot)}" aria-pressed="false" ${fieldIndex ? 'hidden' : ''}>${escapeHtml(token)}</button>`)).join('')
    : options.tokens.map(token => `<button type="button" data-act="token" data-token="${escapeHtml(token)}">${escapeHtml(token)}</button>`).join('');
  return `<div class="play-editor">
      <div class="play-editor-bar"><span id="${labelId}" class="play-editor-label">${escapeHtml(options.label)}</span><span ${options.statusId ? `id="${options.statusId}"` : ''} class="play-editor-status" role="status" aria-live="polite">${escapeHtml(options.status)}</span></div>
      <div class="play-editor-body"><div id="${options.id}" class="play-code-editor" data-label-id="${labelId}" data-describedby="${escapeHtml(describedBy)}" data-placeholder="${escapeHtml(options.placeholder ?? 'Escreva sua consulta aqui...')}"></div></div>
      <div class="${tokenClass}" role="group" aria-label="${escapeHtml(tokenLabel)}" ${options.assist ? `data-base-label="${escapeHtml(options.assist.label)}"` : ''}>
        <div class="play-tokens-head"><span class="play-tokens-label" aria-hidden="true">${escapeHtml(tokenLabel)}</span>${options.assist ? '<span class="play-tokens-hint" aria-hidden="true">clique ou arraste até o espaço</span>' : ''}</div>
        <div class="play-token-list">${tokenButtons}</div>
      </div>
    </div>`;
}

// Arrastar um valor até um espaço da máscara. Usa eventos de ponteiro, então funciona com mouse, toque e caneta;
// o clique continua valendo para teclado e para quem prefere não arrastar.
function enableTokenDrag(editor: SqlEditor): () => void {
  const tokens = editor.host.closest('.play-editor')?.querySelector<HTMLElement>('.play-tokens.is-guided');
  if (!tokens) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  type Drag = { button: HTMLElement; token: string; pointerId: number; x: number; y: number; ghost?: HTMLElement; over?: HTMLElement };
  let drag: Drag | undefined;
  let suppressClick = false;

  const slotElements = () => Array.from(editor.host.querySelectorAll<HTMLElement>('.cm-sql-slot'));
  // Um espaço aceita o valor quando ele está entre as escolhas daquele campo.
  const accepts = (slot: HTMLElement, token: string) => Array.from(tokens.querySelectorAll<HTMLElement>('[data-slot-target]'))
    .some(choice => choice.dataset.slotTarget === slot.dataset.slotLabel && choice.dataset.token === token);
  // Não precisa acertar em cheio: vale o espaço mais próximo dentro de uma pequena margem.
  const nearestSlot = (x: number, y: number, token: string) => {
    let best: HTMLElement | undefined;
    let bestDistance = 28;
    for (const slot of slotElements()) {
      if (!accepts(slot, token)) continue;
      const box = slot.getBoundingClientRect();
      const distance = Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));
      if (distance < bestDistance) { best = slot; bestDistance = distance; }
    }
    return best;
  };

  const finish = () => {
    if (!drag) return;
    drag.ghost?.remove();
    drag.button.classList.remove('is-dragging');
    if (drag.button.hasPointerCapture(drag.pointerId)) drag.button.releasePointerCapture(drag.pointerId);
    editor.host.classList.remove('is-dragging');
    slotElements().forEach(slot => slot.classList.remove('is-drop-target', 'is-drop-over'));
    drag = undefined;
  };

  tokens.addEventListener('pointerdown', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('button[data-fill-slot]');
    if (!button?.dataset.token || event.button !== 0 || drag) return;
    drag = { button, token: button.dataset.token, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }, { signal });

  document.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const current = drag;
    if (!current.ghost) {
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
      const ghost = document.createElement('div');
      ghost.className = 'play-token-ghost';
      ghost.textContent = current.token;
      ghost.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ghost);
      current.ghost = ghost;
      current.button.setPointerCapture(current.pointerId);
      current.button.classList.add('is-dragging');
      editor.host.classList.add('is-dragging');
      slotElements().forEach(slot => slot.classList.toggle('is-drop-target', accepts(slot, current.token)));
    }
    current.ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -130%)`;
    const over = nearestSlot(event.clientX, event.clientY, current.token);
    if (over !== current.over) {
      current.over?.classList.remove('is-drop-over');
      over?.classList.add('is-drop-over');
      current.over = over;
    }
  }, { signal });

  document.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { ghost, token } = drag;
    const label = nearestSlot(event.clientX, event.clientY, token)?.dataset.slotLabel;
    finish();
    if (!ghost) return;
    // O navegador ainda dispara um clique no botão depois de soltar; ele não pode preencher outro espaço.
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 80);
    if (label) editor.fillSlot(label, token);
    else setEditorStatus(editor, 'Solte o valor sobre um espaço da consulta');
  }, { signal });

  document.addEventListener('pointercancel', event => { if (event.pointerId === drag?.pointerId) finish(); }, { signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && drag?.ghost) finish(); }, { signal });
  tokens.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  }, { signal, capture: true });

  return () => { finish(); controller.abort(); };
}

// O cursor começa onde o modelo espera a continuação: no primeiro espaço deixado no fim de uma linha, ou no fim do texto.
// Assim os botões de atalho funcionam mesmo antes de a pessoa clicar no editor.
function startingCursor(value: string): number {
  const gap = /[ \t]+$/m.exec(value);
  return gap ? gap.index + gap[0].length : value.length;
}

export function mountSqlEditor(host: HTMLElement, options: MountOptions): SqlEditor {
  destroySqlEditor(host);
  host.classList.toggle('is-guided', !!options.guided);
  const describedBy = host.dataset.describedby?.trim();
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: options.value,
      selection: { anchor: options.guided ? 0 : startingCursor(options.value) },
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        sqlite,
        sqlSlots,
        // Na máscara, linhas longas quebram: no celular nenhum espaço fica escondido atrás da rolagem.
        ...(options.guided ? [EditorState.readOnly.of(true), EditorView.editable.of(false), EditorView.lineWrapping] : []),
        syntaxHighlighting(sqlHighlightStyle),
        editorTheme,
        placeholder(host.dataset.placeholder ?? 'Escreva sua consulta aqui...'),
        EditorView.contentAttributes.of({
          'aria-labelledby': host.dataset.labelId ?? '',
          ...(describedBy ? { 'aria-describedby': describedBy } : {}),
          'aria-multiline': 'true',
          ...(options.guided ? { 'aria-readonly': 'true' } : {}),
          spellcheck: 'false',
          autocapitalize: 'off',
          autocomplete: 'off'
        }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) options.onChange?.(update.state.doc.toString());
        }),
        keymap.of([
          { key: 'Mod-Enter', run: () => { options.onRun?.(); return true; } },
          ...defaultKeymap,
          ...historyKeymap
        ])
      ]
    })
  });
  const onSlotClick = (event: MouseEvent) => {
    const slot = (event.target as HTMLElement).closest<HTMLButtonElement>('.cm-sql-slot');
    if (slot?.dataset.slotLabel) editor.selectSlot(slot.dataset.slotLabel);
  };
  host.addEventListener('click', onSlotClick);
  let stopDrag = () => {};
  const editor: SqlEditor = new SqlEditor(host, view, !!options.guided, () => { host.removeEventListener('click', onSlotClick); stopDrag(); });
  if (options.guided) stopDrag = enableTokenDrag(editor);
  mountedEditors.set(host, editor);
  const firstSlot = findSqlSlots(editor.value)[0];
  if (options.guided && firstSlot) editor.selectSlot(firstSlot.label);
  return editor;
}

export function getSqlEditor(host: HTMLElement | null | undefined): SqlEditor | undefined {
  return host ? mountedEditors.get(host) : undefined;
}

export function destroySqlEditor(host: HTMLElement | null | undefined): void {
  if (!host) return;
  const editor = mountedEditors.get(host);
  if (!editor) return;
  editor.destroy();
  mountedEditors.delete(host);
}

export function destroySqlEditors(container: ParentNode | null | undefined): void {
  container?.querySelectorAll<HTMLElement>('.play-code-editor').forEach(destroySqlEditor);
}

/** Botões de atalho: inserem o trecho na seleção e devolvem o foco ao editor. */
export function insertToken(button: HTMLElement): void {
  const host = button.closest('.play-editor')?.querySelector<HTMLElement>('.play-code-editor');
  const editor = getSqlEditor(host);
  const token = button.dataset.token;
  if (!editor || !token) return;
  const { from, to } = editor.view.state.selection.main;
  if (button.dataset.fillSlot === 'true') {
    const slots = findSqlSlots(editor.value);
    const label = button.dataset.slotTarget ?? host?.dataset.activeSlot ?? slots.find(candidate => !candidate.value)?.label ?? slots[0]?.label;
    if (!label || !editor.fillSlot(label, token)) setEditorStatus(editor, 'Nenhum campo disponível.');
    return;
  }
  const before = editor.view.state.sliceDoc(0, from);
  // Depois de um comentário de ajuda, o trecho vai para a linha de baixo; senão viraria comentário também.
  const inComment = before.slice(before.lastIndexOf('\n') + 1).includes('--');
  const glue = inComment ? '\n' : before && !/\s$/.test(before) && token !== ',' && token !== ';' ? ' ' : '';
  const insert = `${glue}${token}`;
  editor.view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true
  });
  editor.focus();
}

export function setEditorStatus(editor: SqlEditor | null | undefined, text: string, tone = ''): void {
  const status = editor?.host.closest('.play-editor')?.querySelector<HTMLElement>('.play-editor-status');
  if (!status) return;
  status.textContent = text;
  status.className = `play-editor-status ${tone}`;
}

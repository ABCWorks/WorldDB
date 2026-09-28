import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { sql, SQLite } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { classHighlighter, highlightTree, tags } from '@lezer/highlight';
import './sql-editor.css';

// CodeMirror 6 foi escolhido por ser modular, acessível e ter suporte oficial a SQL/SQLite.
// A mesma configuração é usada no jogo e na documentação para evitar dois comportamentos de edição.

export function escapeHtml(value: unknown): string {
  return String(value ?? 'NULL').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

const sqlite = sql({ dialect: SQLite });
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
  '.cm-gutters': { backgroundColor: '#34364a', color: '#77788f', border: 'none', padding: '14px 0' },
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
  describedBy?: string;
  placeholder?: string;
};

type MountOptions = {
  value: string;
  onChange?: (value: string) => void;
  onRun?: () => void;
};

export class SqlEditor {
  constructor(readonly host: HTMLElement, readonly view: EditorView) {}

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

  focus(): void {
    this.view.focus();
  }
}

const mountedEditors = new WeakMap<HTMLElement, SqlEditor>();

export function editorMarkup(options: EditorMarkupOptions): string {
  const labelId = `${options.id}-label`;
  const describedBy = [options.describedBy, options.statusId].filter(Boolean).join(' ');
  return `<div class="play-editor">
      <div class="play-editor-bar"><span id="${labelId}" class="play-editor-label">${escapeHtml(options.label)}</span><span ${options.statusId ? `id="${options.statusId}"` : ''} class="play-editor-status" role="status" aria-live="polite">${escapeHtml(options.status)}</span></div>
      <div class="play-editor-body"><div id="${options.id}" class="play-code-editor" data-label-id="${labelId}" data-describedby="${escapeHtml(describedBy)}" data-placeholder="${escapeHtml(options.placeholder ?? 'Escreva sua consulta aqui...')}"></div></div>
      <div class="play-tokens" role="group" aria-label="Atalhos de SQL">${options.tokens.map(token => `<button type="button" data-act="token" data-token="${escapeHtml(token)}">${escapeHtml(token)}</button>`).join('')}</div>
    </div>`;
}

export function mountSqlEditor(host: HTMLElement, options: MountOptions): SqlEditor {
  destroySqlEditor(host);
  const describedBy = host.dataset.describedby?.trim();
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: options.value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        sqlite,
        syntaxHighlighting(sqlHighlightStyle),
        editorTheme,
        placeholder(host.dataset.placeholder ?? 'Escreva sua consulta aqui...'),
        EditorView.contentAttributes.of({
          'aria-labelledby': host.dataset.labelId ?? '',
          ...(describedBy ? { 'aria-describedby': describedBy } : {}),
          'aria-multiline': 'true',
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
  const editor = new SqlEditor(host, view);
  mountedEditors.set(host, editor);
  return editor;
}

export function getSqlEditor(host: HTMLElement | null | undefined): SqlEditor | undefined {
  return host ? mountedEditors.get(host) : undefined;
}

export function destroySqlEditor(host: HTMLElement | null | undefined): void {
  if (!host) return;
  const editor = mountedEditors.get(host);
  if (!editor) return;
  editor.view.destroy();
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
  const before = editor.view.state.sliceDoc(0, from);
  const glue = before && !/\s$/.test(before) && token !== ',' && token !== ';' ? ' ' : '';
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

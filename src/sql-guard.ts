// Regra única para aceitar consultas: usada pelo worker do site, pelo scripts/check-lesson.mjs e pelos testes.
// A escrita já é barrada pelo PRAGMA query_only das bases; aqui a ideia é dar um aviso claro antes de chegar lá.
const quotedOrComment = /'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g;

export function prepareReadOnlyQuery(sql: string): string {
  // Os modelos do editor trazem comentários "--" de ajuda; linhas só de comentário nas pontas não contam.
  const trimmed = sql.trim().replace(/^(--[^\n]*\s*)+/, '').replace(/(\s*--[^\n]*)+$/, '').trim().replace(/;\s*$/, '');
  if (trimmed.length > 2500) throw new Error('Consulta muito longa. Tente uma pergunta mais curta.');
  // Um ";" dentro de texto ou comentário não separa instruções, então não conta.
  const bare = trimmed.replace(quotedOrComment, ' ');
  if (!/^(SELECT|WITH)\b/i.test(trimmed) || bare.includes(';')) {
    throw new Error('Use uma única consulta de leitura começando com SELECT ou WITH.');
  }
  return trimmed;
}

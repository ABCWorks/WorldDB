// Regra única para aceitar consultas: usada pelo worker do site e pelo scripts/check-lesson.mjs.
export function prepareReadOnlyQuery(sql: string): string {
  // Os modelos do editor trazem comentários "--" de ajuda; linhas só de comentário nas pontas não contam.
  const trimmed = sql.trim().replace(/^(--[^\n]*\s*)+/, '').replace(/(\s*--[^\n]*)+$/, '').trim().replace(/;\s*$/, '');
  if (trimmed.length > 2500) throw new Error('Consulta muito longa. Tente uma pergunta mais curta.');
  if (!/^(SELECT|WITH)\b/i.test(trimmed) || trimmed.includes(';')) {
    throw new Error('Use uma única consulta de leitura começando com SELECT ou WITH.');
  }
  return trimmed;
}

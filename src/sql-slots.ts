// Espaços das máscaras guiadas. Cada espaço é um comentário SQL com rótulo e valor,
// então a consulta continua sendo texto comum e o editor só troca o comentário por um botão.

export const slotPattern = /\/\*__worlddb_slot:([^:]+):([^*]*)__\*\//g;

export type SqlSlot = { label: string; value: string; from: number; to: number };

export type SqlAssist = {
  label: string;
  fields: { slot: string; choices: string[] }[];
};

export function createSqlSlot(label: string, value = ''): string {
  return `/*__worlddb_slot:${encodeURIComponent(label)}:${encodeURIComponent(value)}__*/`;
}

export function findSqlSlots(source: string): SqlSlot[] {
  return [...source.matchAll(slotPattern)].map(match => ({
    label: decodeURIComponent(match[1]),
    value: decodeURIComponent(match[2]),
    from: match.index,
    to: match.index + match[0].length
  }));
}

/** Troca cada espaço pelo valor escolhido; espaços vazios somem. */
export function resolveSqlSlots(source: string): string {
  return source.replace(slotPattern, (_match, _label: string, value: string) => decodeURIComponent(value));
}

/** Preenche os espaços pelo rótulo, deixando os demais como estão. */
export function fillSqlSlots(source: string, values: Record<string, string>): string {
  return source.replace(slotPattern, (match, label: string) => {
    const name = decodeURIComponent(label);
    return name in values ? createSqlSlot(name, values[name]) : match;
  });
}

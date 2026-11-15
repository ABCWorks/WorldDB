export type Cell = string | number | null;
export type QueryResult = { columns: string[]; values: Cell[][] };
export type SqlClient = { execute: (sql: string) => Promise<QueryResult>; reset: (error: Error) => void };
type Job = { resolve: (result: QueryResult) => void; reject: (error: Error) => void; timer: number };

// "story" guarda o mistério do Jardim; "practice" é a base de treino da Documentação 01.
// Cada cliente tem o próprio Web Worker, então consultas de treino nunca tocam os dados da história.
// O Vite só reconhece o worker com opções literais, por isso há um construtor para cada base.
const spawn = {
  story: () => new Worker(new URL('./sql-worker.ts', import.meta.url), { type: 'module', name: 'story' }),
  practice: () => new Worker(new URL('./sql-worker.ts', import.meta.url), { type: 'module', name: 'practice' })
};

export function createSqlClient(database: keyof typeof spawn): SqlClient {
  let worker: Worker | undefined;
  let sequence = 0;
  const pending = new Map<number, Job>();

  function reset(error: Error): void {
    worker?.terminate();
    worker = undefined;
    pending.forEach(job => { clearTimeout(job.timer); job.reject(error); });
    pending.clear();
  }

  function getWorker(): Worker {
    if (worker) return worker;
    const created = spawn[database]();
    created.onmessage = (event: MessageEvent<{ id: number; result?: QueryResult; error?: string }>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      clearTimeout(job.timer);
      if (event.data.error) job.reject(new Error(event.data.error));
      else job.resolve(event.data.result!);
    };
    created.onerror = () => reset(new Error('O banco não abriu. Recarregue a página e tente novamente.'));
    worker = created;
    return created;
  }

  function execute(sql: string): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      const current = getWorker();
      const id = ++sequence;
      const timer = window.setTimeout(() => reset(new Error('A consulta demorou demais. Tente uma versão mais simples.')), 4000);
      pending.set(id, { resolve, reject, timer });
      current.postMessage({ id, sql });
    });
  }

  return { execute, reset };
}

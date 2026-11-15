import { createLesson, type LessonTools } from './lesson-engine';
import { lesson2Examples as examples, lesson2Exercises } from './lesson-02-data';

// Documentação 02: o que falta para fechar o caso do Jardim (AND, BETWEEN, LIMIT e JOIN).

const tag = (name: string) => `<span class="lesson-table-tag">tabela ${name}</span>`;

function finale({ code }: LessonTools): string {
  return `<section class="lesson-finale" aria-labelledby="finale-title">
    <div class="lesson-finale-card">
      <h3 id="finale-title">Agora nenhuma pista do Jardim escapa.</h3>
      <ul class="lesson-recap">
        <li>${code('WHERE a = 1 AND b > 2')} <span>duas condições juntas</span></li>
        <li>${code("BETWEEN '08:00' AND '09:00'")} <span>um intervalo, com as pontas</span></li>
        <li>${code('ORDER BY coluna DESC LIMIT 1')} <span>só o primeiro da fila</span></li>
        <li>${code('JOIN outra ON a.outra_id = outra.id')} <span>troca um ID por um nome</span></li>
      </ul>
      <a class="game-button lesson-enter" href="/jogar" data-nav data-act="finish">Voltar ao Jardim do Éden <span aria-hidden="true">→</span></a>
      <p class="lesson-aside">Seu progresso no jogo fica guardado: você volta exatamente na pista em que parou.</p>
    </div>
    <div class="lesson-more">
      <h3>Para continuar aprendendo</h3>
      <p>Referências em inglês, para quando a curiosidade apertar:</p>
      <ul>
        <li><a href="https://www.w3schools.com/sql/sql_and.asp" target="_blank" rel="noopener noreferrer">W3Schools: SQL AND ↗</a></li>
        <li><a href="https://www.w3schools.com/sql/sql_between.asp" target="_blank" rel="noopener noreferrer">W3Schools: SQL BETWEEN ↗</a></li>
        <li><a href="https://www.w3schools.com/sql/sql_join.asp" target="_blank" rel="noopener noreferrer">W3Schools: SQL JOIN ↗</a></li>
        <li><a href="https://www.sqlite.org/lang_select.html" target="_blank" rel="noopener noreferrer">SQLite: a instrução SELECT ↗</a></li>
      </ul>
    </div>
  </section>`;
}

const lesson = createLesson({
  number: '02',
  path: '/aprender/02',
  storageKey: 'worlddb-lesson-02-v1',
  database: 'practice2',
  pill: 'DOCUMENTAÇÃO 02 · FILTROS E JUNÇÕES',
  heading: 'Como cruzar pistas de tabelas diferentes',
  intro: 'Cinco passos curtos com os mesmos robôs, que agora têm salas e turnos. No fim, você sabe combinar filtros, pegar só o primeiro da fila e juntar tabelas: tudo o que o Jardim pede da terceira pista em diante.',
  tables: ['robos', 'salas', 'turnos'],
  previous: { href: '/aprender/01', label: '← Documentação 01: primeiras consultas' },
  examples,
  exercises: lesson2Exercises,
  finale,
  steps: [
    {
      short: 'AND', title: 'Dois filtros de uma vez', exercise: 'dois-filtros',
      text: ({ code, query }) => `<p>Na Documentação 01, o ${code('WHERE')} deixava passar as linhas que atendiam a <b>uma</b> condição. Com ${code('AND')}, a linha só passa se atender a <b>todas</b>.</p>
        ${query(examples.and.sql)}
        <p>Nina também é azul, mas tem 40 de bateria: passou na primeira condição e ficou na segunda. Com ${code('AND')}, quase não vale.</p>
        <ul class="lesson-terms">
          <li>${code('=')} é igual a</li>
          <li>${code('>')} é maior que, ${code('<')} é menor que</li>
          <li>${code('>=')} e ${code('<=')} incluem o próprio valor</li>
        </ul>
        <p class="lesson-aside">Quebrar a linha antes do ${code('AND')} não muda nada para o banco. É só para a gente ler melhor.</p>`,
      visual: ({ answer }) => `${tag('robos')}${answer('robos', { title: 'Todos os robôs', highlightCols: ['bateria', 'cor'] })}${answer('and')}`
    },
    {
      short: 'BETWEEN', title: 'Entre dois valores', exercise: 'intervalo',
      text: ({ code, query }) => `<p>Os robôs trabalham em turnos, e cada turno fica anotado na tabela ${code('turnos')}: quem, em qual sala e a que horas.</p>
        <p>Para pegar um intervalo, ${code('BETWEEN')} pede o começo e o fim, com ${code('AND')} no meio:</p>
        ${query(examples.between.sql)}
        <p><b>As duas pontas entram.</b> O turno das ${code('08:00')} em ponto apareceu no resultado.</p>
        <p class="lesson-warning"><b>Horário aqui é texto</b>, sempre no formato ${code('HH:MM')}, e por isso vai entre aspas simples. Como todos têm o mesmo tamanho, a ordem alfabética coincide com a ordem do relógio.</p>`,
      visual: ({ answer }) => `${tag('turnos')}${answer('turnos', { title: 'Todos os turnos', highlightCols: ['horario'] })}${answer('between')}`
    },
    {
      short: 'LIMIT', title: 'Só o primeiro da fila', exercise: 'primeiros',
      text: ({ code, query }) => `<p>Às vezes a pergunta é “quem é o mais…?”. A receita tem duas peças: ${code('ORDER BY')} põe na ordem certa e ${code('LIMIT')} corta a fila.</p>
        ${query(examples.limit.sql)}
        <ul class="lesson-terms">
          <li>${code('ORDER BY bateria DESC')} põe a bateria mais cheia no topo.</li>
          <li>${code('LIMIT 1')} fica só com a primeira linha. ${code('LIMIT 3')} ficaria com três.</li>
        </ul>
        <p class="lesson-warning"><b>${code('LIMIT')} sem ${code('ORDER BY')} é sorteio.</b> O banco devolve as primeiras linhas que encontrar, e não as que você queria.</p>
        <p class="lesson-aside">A ordem das peças é sempre esta: ${code('WHERE')}, depois ${code('ORDER BY')}, e ${code('LIMIT')} por último.</p>`,
      visual: ({ answer }) => `${tag('robos')}${answer('robos', { title: 'Todos os robôs', highlightCols: ['bateria'] })}${answer('limit')}`
    },
    {
      short: 'JOIN', title: 'Juntar duas tabelas', exercise: 'juntar',
      text: ({ code, query }) => `<p>Olhe a tabela ${code('turnos')}: ela não guarda o nome do robô, só o número dele em ${code('robo_id')}. Isso evita repetir o nome em toda linha, mas deixa a leitura difícil.</p>
        <p>${code('JOIN')} resolve: ele cola duas tabelas, linha com linha, sempre que a condição do ${code('ON')} bate.</p>
        ${query(examples.join.sql)}
        <ul class="lesson-terms">
          <li>${code('turnos.robo_id')} é uma <b>chave estrangeira</b>: um número que aponta para o ${code('id')} de outra tabela.</li>
          <li>${code('ON turnos.robo_id = robos.id')} diz como as linhas se encontram.</li>
          <li>${code('tabela.coluna')} deixa claro de onde vem cada coluna. As duas tabelas têm ${code('id')}, então sem o nome da tabela o banco não sabe qual você quer.</li>
        </ul>`,
      visual: ({ answer }) => `${tag('turnos')}${answer('turnos', { title: 'Os turnos, só com números', highlightCols: ['robo_id'] })}${tag('robos')}${answer('robos', { title: 'Os robôs', highlightCols: ['id'] })}${answer('join', { title: 'Juntas, o número vira nome' })}`
    },
    {
      short: 'Vários', title: 'Apelidos e três tabelas', exercise: 'tres-tabelas',
      text: ({ code, query }) => `<p>Um turno aponta para duas tabelas: o robô e a sala. Para trazer os dois nomes, é um ${code('JOIN')} para cada uma.</p>
        <p>Como escrever ${code('turnos')} toda hora cansa, dá para dar um <b>apelido</b> logo depois do nome da tabela: ${code('turnos t')}, ${code('robos r')}, ${code('salas s')}.</p>
        ${query(examples.joinAll.sql)}
        <ul class="lesson-terms">
          <li>Cada ${code('JOIN')} traduz um ID: ${code('t.robo_id')} vira robô, ${code('t.sala_id')} vira sala.</li>
          <li>O ${code('WHERE')} vem depois de todos os ${code('JOIN')}s e pode filtrar por qualquer tabela.</li>
        </ul>
        <p class="lesson-aside">É exatamente este formato que fecha o caso do Jardim: uma tabela de acontecimentos, cheia de IDs, e um JOIN para cada nome que falta.</p>`,
      visual: ({ answer }) => `${tag('salas')}${answer('salas', { title: 'As salas', highlightCols: ['id'] })}${tag('turnos')}${answer('turnos', { title: 'Os turnos', highlightCols: ['robo_id', 'sala_id'] })}${answer('joinAll', { title: 'Três tabelas, uma resposta' })}`
    }
  ]
});

export const { lessonMarkup, bindLesson, disposeLesson } = lesson;

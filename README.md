# WorldDB

Uma aventura ilustrada para aprender SQL. A página inicial abre um mistério fictício no jardim; a linha do tempo original permanece disponível para exploração. O prólogo do Jardim do Éden é identificado como narrativa religiosa, sem data histórica.

## Iniciar localmente

O projeto usa **npm** (Node 22.6 ou mais novo).

```bash
npm install
npm run dev
```

Abra o endereço `Local` exibido pelo Vite no terminal.

## Percursos

- `/`: abertura do jogo, com globo 3D e prévia da primeira história.
- `/aprender/01`: Documentação 01, primeiras consultas (`SELECT`, colunas, `WHERE`, `ORDER BY`). É para onde leva o botão **Jogar** da página inicial; quem já sabe SQL pode ir direto ao jogo.
- `/aprender/02`: Documentação 02, filtros e junções (`AND`, `BETWEEN`, `LIMIT`, `JOIN`, apelidos de tabela). Cobre o que o jogo pede da terceira pista em diante.
- `/jogar`: seis momentos de investigação com `SELECT`, `WHERE`, filtros combinados, `ORDER BY` e `JOIN`. O progresso e a preferência de som ficam apenas no `localStorage` do navegador.
- `/explorar`: os seis capítulos da linha do tempo, com entidades, relações e fontes.
- Qualquer outro endereço mostra uma página 404.

As consultas rodam em SQLite via WebAssembly dentro de um Web Worker. Cada sessão usa uma base isolada em memória; apenas consultas de leitura são aceitas (`src/sql-guard.ts` avisa cedo e o `PRAGMA query_only` garante) e consultas demoradas são interrompidas.

## Onde fica cada coisa

| Arquivo | Conteúdo |
| --- | --- |
| `src/main.ts` | Rotas, página inicial, linha do tempo e página 404 |
| `src/globe.ts` | Globo 3D (three.js), carregado só em `/` e `/explorar` |
| `src/data.ts` | Capítulos históricos da linha do tempo |
| `src/story-data.ts` | Esquema e os 39 registros fictícios do Jardim, guia de tabelas e relações |
| `src/story-moments.ts` | Os seis momentos do jogo: textos, máscaras, solução de referência e validação |
| `src/game.ts` | Tela do jogo: cena, banco, editor, resultado e progresso |
| `src/lesson.ts`, `src/lesson-data.ts` | Documentação 01 e sua base de treino |
| `src/lesson-02.ts`, `src/lesson-02-data.ts` | Documentação 02 e sua base de treino |
| `src/lesson-engine.ts`, `src/lesson-judge.ts` | Motor de aulas (passos, exemplos, exercícios) e correção pelo resultado |
| `src/sql-ui.ts`, `src/sql-slots.ts` | Editor CodeMirror e os espaços das máscaras guiadas |
| `src/sql-client.ts`, `src/sql-worker.ts`, `src/sql-guard.ts` | Execução das consultas no Web Worker |

IDs, entidades, relações e consultas da linha do tempo são metáforas criadas para o site; as fontes históricas aparecem no rodapé da exploração.

### Máscaras guiadas

Nos seis momentos do jogo o editor começa como uma máscara: a consulta já vem montada e o jogador escolhe o valor de cada espaço. Do quarto momento em diante há o botão **Escrever sozinho**, que troca a máscara por um editor livre. Uma nova documentação pode ser criada com `createLesson` (`src/lesson-engine.ts`), passando passos, exemplos e exercícios.

## Checagens

```bash
npm run check
```

Roda tudo o que o CI roda antes do build:

- `npm run typecheck`: TypeScript em modo estrito.
- `npm run lint`: ESLint.
- `npm run check:lesson`: roda cada exemplo e cada resposta da Documentação 01 no mesmo sql.js do site e confere o resultado esperado, o isolamento da base de treino e as colunas reais da primeira missão.
- `npm test`: testes com Vitest. `tests/story.test.ts` garante que o jogo pode ser vencido (a solução de referência de cada momento fecha a pista, as máscaras têm combinação vencedora, o diagrama bate com o esquema real); `tests/lesson-02.test.ts` faz o mesmo para a Documentação 02. `npm run check:story` roda só os testes do jogo.

Ao mudar um registro em `src/story-data.ts`, rode `npm run check:story`: se a história deixar de fechar, o teste aponta o momento.

## Compilar

```bash
npm run build
npm run preview
```

## Editor SQL

O jogo e os exercícios das documentações usam o mesmo editor baseado no **CodeMirror 6**, com o dialeto SQLite. A escolha prioriza suporte mantido a SQL, navegação por teclado e leitor de tela, histórico de desfazer/refazer, seleção e rolagem nativas e integração modular sem carregar recursos de uma IDE completa.

Cada parte pesada é baixada só quando é usada. No build de produção, a página inicial carrega cerca de `34 kB` de JavaScript (`12 kB` gzip); o globo (three.js, `545 kB`, `135 kB` gzip) vem em seguida, apenas em `/` e `/explorar`; o editor (`342 kB`, `113 kB` gzip) e o SQLite (`688 kB`) só são baixados no jogo e nas documentações.

## Deploy automático no Debian

O workflow `.github/workflows/deploy.yml` compila e publica o site somente em pushes para `main`. A branch padrão de desenvolvimento é `develop`; integre `develop` em `main` quando quiser publicar. Como o servidor usa um IP privado, o job roda em um GitHub Actions runner self-hosted instalado no próprio Debian.

Preparação única:

1. No Debian, confirme que `pm2`, `curl` e `ss` estão disponíveis para o usuário que executará o runner. Instale o PM2, se necessário, com `npm install --global pm2`.
2. No repositório do GitHub, abra **Settings > Actions > Runners > New self-hosted runner**, escolha Linux/x64 e execute no Debian os comandos gerados pelo GitHub como o usuário de deploy.
3. Instale o runner como serviço seguindo a etapa exibida pelo GitHub, para ele voltar automaticamente após reiniciar o Debian.
4. Opcionalmente, crie a variável de repositório `WORLDDB_PORT` em **Settings > Secrets and variables > Actions > Variables**. O valor padrão é `4174`.
5. Para manter o processo PM2 após reinicializações, execute uma vez `pm2 startup`, siga o comando que ele imprimir e depois rode `pm2 save`.

No Cloudflare Zero Trust, abra o Tunnel que já roda no Debian e adicione um **Public Hostname** com:

- Subdomínio: `worlddb`
- Domínio: `picoli.dev.br`
- Tipo: `HTTP`
- URL do serviço: `localhost:4174`

O endereço público será `https://worlddb.picoli.dev.br`. Não é necessário liberar a porta `4174` no roteador ou firewall, pois o `cloudflared` acessa o serviço localmente.

O deploy mantém tudo em `~/projetos/worlddb`: publica em `dist/`, cria backups em `backup/` e usa `temp/` durante a troca. Ele valida `/`, `/jogar`, `/explorar` e `/aprender/01` e restaura a versão anterior se a verificação falhar. Nenhuma senha SSH é necessária no modelo com runner self-hosted.

> Por segurança, use runner self-hosted apenas quando você controla quem pode alterar ou executar workflows no repositório. O GitHub recomenda cautela especial em repositórios públicos.

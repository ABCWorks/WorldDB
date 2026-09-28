# WorldDB

Uma aventura ilustrada para aprender SQL. A página inicial abre um mistério fictício no jardim; a linha do tempo original permanece disponível para exploração. O prólogo do Jardim do Éden é identificado como narrativa religiosa, sem data histórica.

## Iniciar localmente

```bash
npm install
npm run dev
```

Abra o endereço `Local` exibido pelo Vite no terminal.

## Conferir a Documentação 01

```bash
npm run check:lesson
```

Roda cada exemplo e cada resposta da aula no mesmo sql.js do site e confere o resultado esperado, o isolamento da base de treino e as colunas reais da primeira missão. O CI executa essa checagem antes do build.

## Compilar

```bash
npm run build
npm run preview
```

## Editor SQL

O jogo e os exercícios da documentação usam o mesmo editor baseado no **CodeMirror 6**, com o dialeto SQLite. A escolha prioriza suporte mantido a SQL, navegação por teclado e leitor de tela, histórico de desfazer/refazer, seleção e rolagem nativas e integração modular sem carregar recursos de uma IDE completa.

No build de produção medido durante a migração, o CodeMirror ficou em um chunk carregado sob demanda de `334,52 kB` (`110,87 kB` gzip). Jogo e documentação também passaram a ser carregados por rota; com isso, o chunk inicial caiu de `603,85 kB` (`161,02 kB` gzip) para `526,28 kB` (`135,76 kB` gzip), e quem abre apenas a página inicial não baixa o editor. O editor foi verificado no jogo e na documentação em desktop e nas larguras mobile de 320, 375 e 390 px, sem rolagem horizontal da página.

## Deploy automatico no Debian

O workflow `.github/workflows/deploy.yml` compila e publica o site somente em pushes para `main`. A branch padrao de desenvolvimento e `develop`; integre `develop` em `main` quando quiser publicar. Como o servidor usa um IP privado, o job roda em um GitHub Actions runner self-hosted instalado no proprio Debian.

Preparacao unica:

1. No Debian, confirme que `pm2`, `curl` e `ss` estao disponiveis para o usuario que executara o runner. Instale o PM2, se necessario, com `npm install --global pm2`.
2. No repositorio do GitHub, abra **Settings > Actions > Runners > New self-hosted runner**, escolha Linux/x64 e execute no Debian os comandos gerados pelo GitHub como o usuario de deploy.
3. Instale o runner como servico seguindo a etapa exibida pelo GitHub, para ele voltar automaticamente apos reiniciar o Debian.
4. Opcionalmente, crie a variavel de repositorio `WORLDDB_PORT` em **Settings > Secrets and variables > Actions > Variables**. O valor padrao e `4174`.
5. Para manter o processo PM2 apos reinicializacoes, execute uma vez `pm2 startup`, siga o comando que ele imprimir e depois rode `pm2 save`.

No Cloudflare Zero Trust, abra o Tunnel que ja roda no Debian e adicione um **Public Hostname** com:

- Subdominio: `worlddb`
- Dominio: `picoli.dev.br`
- Tipo: `HTTP`
- URL do servico: `localhost:4174`

O endereco publico sera `https://worlddb.picoli.dev.br`. Nao e necessario liberar a porta `4174` no roteador ou firewall, pois o `cloudflared` acessa o servico localmente.

O deploy mantem tudo em `~/projetos/worlddb`: publica em `dist/`, cria backups em `backup/` e usa `temp/` durante a troca. Ele valida `/`, `/jogar` e `/explorar` e restaura a versao anterior se a verificacao falhar. Nenhuma senha SSH e necessaria no modelo com runner self-hosted.

> Por seguranca, use runner self-hosted apenas quando voce controla quem pode alterar ou executar workflows no repositorio. O GitHub recomenda cautela especial em repositorios publicos.

## Percursos

- `/`: abertura do jogo, com globo 3D e prévia da primeira história.
- `/aprender/01`: Documentação 01, primeiras consultas (`SELECT`, colunas, `WHERE`, `ORDER BY`). É para onde leva o botão **Jogar** da página inicial; quem já sabe SQL pode ir direto ao jogo. Os exemplos e exercícios rodam numa base de treino isolada (`src/lesson-data.ts`), separada do mistério.
- `/jogar`: seis momentos de investigação com `SELECT`, `WHERE`, filtros combinados, `ORDER BY` e `JOIN`. O progresso e a preferência de som ficam apenas no `localStorage` do navegador.
- `/explorar`: os seis capítulos da linha do tempo, com entidades, relações e fontes.

As consultas do jogo rodam em SQLite via WebAssembly dentro de um Web Worker. Cada sessão usa uma base isolada em memória; apenas consultas de leitura são aceitas e consultas demoradas são interrompidas. Os 39 registros fictícios e o guia de cinco tabelas da história estão em `src/story-data.ts`; a execução está em `src/sql-worker.ts`. Os capítulos históricos ficam em `src/data.ts`. IDs, entidades, relações e consultas da linha do tempo são metáforas criadas para o site; as fontes históricas aparecem no rodapé da exploração.

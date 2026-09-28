import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { eras, type Era } from './data';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
let active = 0;
let globe: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial> | undefined;
let controls: OrbitControls | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let animation = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function icon(name: string, size = 54): string {
  const common = `viewBox="0 0 80 80" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const shapes: Record<string, string> = {
    tree: '<path d="M40 66V35M40 55l-15-12M40 45l16-13"/><path d="M30 52c-18 7-27-8-15-20-5-11 6-23 18-20 7-10 22-7 25 5 12 1 16 15 8 22 6 11-3 21-15 16-5 6-14 6-21-3Z" fill="#8fcd6d"/><circle cx="53" cy="24" r="4" fill="#ec7868"/><path d="M25 68h30"/>',
    sprout: '<path d="M40 67V35M40 48c-2-15-12-21-24-18 1 13 10 18 24 18ZM40 42c2-15 12-21 24-18-1 13-10 18-24 18Z" fill="#9dd275"/><path d="M20 68h40"/><path d="m18 58 5-5m38 5-5-5"/>',
    tablet: '<path d="M18 12q22-5 44 0l4 55q-25 5-52 0Z" fill="#d59b65"/><path d="m26 27 8-3-5 7m12-7 8 2-6 5m-17 9 9-3-4 7m13-6 8 2-5 5m-19 8 8-3m10-1 8 2"/>',
    book: '<path d="M40 66c-9-6-20-7-32-4V19c13-3 23-1 32 5 9-6 19-8 32-5v43c-12-3-23-2-32 4Z" fill="#f1c778"/><path d="M40 24v42M17 30c6-1 11 0 16 2M17 39c6-1 11 0 16 2M47 32c5-2 10-3 16-2M47 41c5-2 10-3 16-2"/>',
    rocket: '<path d="M33 52c-4-17 3-34 22-43 12 18 6 37-8 49Z" fill="#f7f1dc"/><circle cx="49" cy="29" r="6" fill="#8bcbd9"/><path d="m33 52-11 2 4-15 9-4m12 23 2 10 10-13-2-10M31 54l-7 8m7-1-7 8m17-11-5 12"/><path d="m27 39-7-9 14 2"/>',
    web: '<circle cx="40" cy="40" r="28" fill="#c5e9f1"/><path d="M12 40h56M40 12c-11 14-11 42 0 56M40 12c11 14 11 42 0 56M17 26h46M17 54h46"/><circle cx="29" cy="28" r="4" fill="#ef9a65"/><circle cx="53" cy="42" r="4" fill="#f4c84e"/><circle cx="34" cy="55" r="4" fill="#80bd7b"/>',
    spark: '<path d="m40 8 7 23 24 9-24 7-7 24-8-24-23-7 23-9Z" fill="#ffd45a"/>',
    snake: '<path d="M17 56c7 7 19 6 25 0 8-8-3-18 6-25 6-5 15 1 11 8-2 4-8 3-9 0"/><path d="M16 56c-3-7 1-13 8-13s12 6 12 13" fill="#91c878"/><circle cx="58" cy="30" r="2" fill="currentColor"/><path d="m62 38 7 3-6 2"/>',
    person: '<circle cx="40" cy="23" r="11" fill="#ffd0a3"/><path d="M20 67c1-17 8-27 20-27s19 10 20 27Z" fill="#77bdd1"/><path d="M29 18c4-13 21-14 24 2"/>',
    goat: '<path d="M17 39h33l10-8 8 5-4 12-13 1-6 10H22l-5-20Z" fill="#eee0bb"/><path d="M26 59v9m22-9v9m14-29 7-7m-9 4-2-9m-3 13h1"/>',
    house: '<path d="m10 36 30-22 30 22v31H10Z" fill="#f8ce75"/><path d="m8 37 32-24 32 24M33 67V44h16v23"/><path d="M15 25v-9h11v9"/>',
    seed: '<path d="M17 55c4-16 16-28 45-32-2 29-14 42-31 42-7 0-12-4-14-10Z" fill="#a8d17b"/><path d="M20 62c13-14 23-23 37-31"/>',
    print: '<path d="M17 28h46v29H17Z" fill="#e3b876"/><path d="M10 21h60M40 12v9M23 57v12h34V57M26 37h28m-28 8h28"/>',
    moon: '<path d="M57 10A30 30 0 1 0 69 56 31 31 0 0 1 57 10Z" fill="#f5e5ae"/><circle cx="30" cy="32" r="4"/><circle cx="39" cy="51" r="3"/>',
    flag: '<path d="M23 69V13m0 2c14-8 22 8 38 0v28c-16 8-24-8-38 0" fill="#f5dc8a"/><path d="M15 69h25"/>',
    link: '<path d="m29 49-6 6a12 12 0 0 1-17-17l13-13a12 12 0 0 1 17 0m8 6 6-6a12 12 0 0 1 17 17L54 55a12 12 0 0 1-17 0M25 40h30"/>',
    computer: '<rect x="10" y="12" width="60" height="42" rx="5" fill="#a5d6e2"/><path d="M40 54v13m-18 0h36M21 24h20m-20 9h30"/>'
  };
  return `<svg ${common}>${shapes[name] || shapes.spark}</svg>`;
}

function sceneArt(type: string, label: string): string {
  const sky = '<circle cx="277" cy="38" r="17" fill="#ffe790"/><path d="M9 129Q79 81 145 120T291 117V166H9Z" fill="#a7d69b"/><path d="M9 150Q80 122 157 151T291 140V180H9Z" fill="#71bd9b"/>';
  const pieces: Record<string, string> = {
    'garden-missing': `<path d="M69 149V51" stroke="#7d674d" stroke-width="13" stroke-linecap="round"/><circle cx="70" cy="59" r="36" fill="#8acc70"/><circle cx="43" cy="74" r="25" fill="#9ed87f"/><circle cx="93" cy="76" r="24" fill="#86c86c"/><path d="M109 143q20-27 42 0v25h-42Z" fill="#e9a67f"/><circle cx="130" cy="118" r="16" fill="#f5c29d"/><path d="M194 148q18-25 38 0v23h-38Z" fill="#e2bc7d"/><circle cx="213" cy="125" r="15" fill="#f5c29d"/><path d="M246 161q-12-20 2-29 12-7 16 3-2 7-10 5" fill="none" stroke="#536d53" stroke-width="8" stroke-linecap="round"/>`,
    'garden-trail': `<path d="M59 150V50" stroke="#7d674d" stroke-width="12" stroke-linecap="round"/><circle cx="58" cy="60" r="34" fill="#8acc70"/><circle cx="35" cy="75" r="22" fill="#9ed87f"/><circle cx="82" cy="77" r="23" fill="#86c86c"/><circle cx="73" cy="51" r="5" fill="#ec8063"/><path d="M120 170q35-55 98-44t78 32" fill="none" stroke="#ead1a4" stroke-width="27"/><ellipse cx="142" cy="145" rx="7" ry="4" transform="rotate(-18 142 145)" fill="#af846c"/><ellipse cx="166" cy="134" rx="7" ry="4" transform="rotate(13 166 134)" fill="#af846c"/><ellipse cx="191" cy="134" rx="7" ry="4" transform="rotate(-14 191 134)" fill="#af846c"/><path d="M229 151q-16-24 2-35 15-8 18 4-2 7-11 5" fill="none" stroke="#536d53" stroke-width="9" stroke-linecap="round"/><circle cx="251" cy="117" r="2" fill="#34364a"/>`,
    'garden-basket': `<path d="M61 151V51" stroke="#7d674d" stroke-width="12" stroke-linecap="round"/><circle cx="60" cy="61" r="35" fill="#8acc70"/><circle cx="36" cy="75" r="23" fill="#9ed87f"/><circle cx="84" cy="77" r="22" fill="#86c86c"/><path d="M132 148q18-25 37 0v24h-37Z" fill="#e2bc7d"/><circle cx="150" cy="124" r="17" fill="#f5c29d"/><path d="M183 158q30-19 71 0l-6 20h-59Z" fill="#cf8d58" stroke="#8f654e" stroke-width="3"/><path d="M194 159q3-32 26-32t25 32" fill="none" stroke="#8f654e" stroke-width="5"/><circle cx="217" cy="149" r="8" fill="#ec8063"/><path d="M215 138q4-7 10-5" fill="none" stroke="#4f9665" stroke-width="3"/>`,
    'garden-picnic': `<path d="M45 150V61" stroke="#7d674d" stroke-width="12" stroke-linecap="round"/><circle cx="46" cy="68" r="34" fill="#8acc70"/><circle cx="22" cy="80" r="21" fill="#9ed87f"/><circle cx="70" cy="82" r="21" fill="#86c86c"/><path d="m112 157 70-23 75 29-62 17Z" fill="#f6cb7b" stroke="#d58f6a" stroke-width="4"/><path d="m133 152 65 24m-32-32 63 25" stroke="#fff6e0" stroke-width="5"/><path d="M110 127q14-18 29 0v24h-29Z" fill="#e9a67f"/><circle cx="125" cy="107" r="13" fill="#f5c29d"/><path d="M174 121q14-18 29 0v24h-29Z" fill="#e2bc7d"/><circle cx="189" cy="101" r="13" fill="#f5c29d"/><path d="M242 151q-16-22 1-32 12-6 16 4-2 7-10 5" fill="none" stroke="#536d53" stroke-width="8" stroke-linecap="round"/><path d="M205 150q20-12 40 0l-5 15h-31Z" fill="#cf8d58" stroke="#8f654e" stroke-width="3"/><circle cx="223" cy="143" r="8" fill="#ec8063"/>`,
    garden: `<path d="M68 147V51" stroke="#7d674d" stroke-width="13" stroke-linecap="round"/><circle cx="70" cy="59" r="36" fill="#8acc70"/><circle cx="43" cy="74" r="25" fill="#9ed87f"/><circle cx="93" cy="76" r="24" fill="#86c86c"/><circle cx="55" cy="46" r="5" fill="#ec8063"/><circle cx="87" cy="61" r="5" fill="#ec8063"/><path d="M117 115q18-23 34 0v39h-34Z" fill="#e9a67f"/><circle cx="134" cy="92" r="14" fill="#f5c29d"/><path d="M174 115q18-23 34 0v39h-34Z" fill="#e2bc7d"/><circle cx="191" cy="92" r="14" fill="#f5c29d"/><path d="M225 150q-11-18 1-27 11-7 14 1-2 8-10 4" fill="none" stroke="#536d53" stroke-width="8" stroke-linecap="round"/>`,
    farm: `<path d="M4 159q76-38 143-8t149-6" fill="none" stroke="#5ca66e" stroke-width="6"/><path d="m164 113 42-34 43 34v43h-85Z" fill="#f2cb7f"/><path d="m157 115 49-43 49 43" fill="none" stroke="#9d6559" stroke-width="9" stroke-linejoin="round"/><path d="M195 156v-25h19v25" fill="#aa785b"/><path d="M51 153V91m0 45-20-20m20 3 20-21M93 152V104m0 33-18-15m18-3 17-19" fill="none" stroke="#4f9665" stroke-width="7" stroke-linecap="round"/><path d="M26 102q23-20 24 13-23 9-24-13Zm26-10q20-20 27 0-15 21-27 0ZM80 110q18-17 16 14-19 5-16-14Zm15-20q18-16 23 0-16 17-23 0Z" fill="#8fc96c"/><path d="M257 144h22l8-10 8 6-4 14h-31Z" fill="#f5e8cc"/>`,
    writing: `<path d="M40 160 49 54q89-19 170 0l8 106Z" fill="#c99462" stroke="#9c6b4e" stroke-width="5"/><path d="m76 79 20-8-11 18m30-16 21 4-13 13m35-16 20-7-9 17M78 109l18-6-7 16m32-11 20 4-13 12m38-19 22-8-10 18M81 135l18-5m33 2 20-6m29 5 18-5" fill="none" stroke="#8f654e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="m229 42 27 82" stroke="#7c5b45" stroke-width="8" stroke-linecap="round"/>`,
    printing: `<path d="M47 54h184v21H47Z" fill="#a86850"/><path d="M62 76h154v67H62Z" fill="#d6a66c"/><path d="M72 87h133v34H72Z" fill="#e9d9a8"/><path d="M83 96h109m-109 11h109" stroke="#927456" stroke-width="4"/><path d="M126 17h28v36h-28Z" fill="#95725c"/><path d="M52 146h181" stroke="#825a4c" stroke-width="8"/><path d="M207 40q27-22 46 2v104h-46Z" fill="#f2d591"/><path d="M214 58h31m-31 11h31m-31 11h31" stroke="#b79262" stroke-width="3"/>`,
    moon: `<circle cx="152" cy="116" r="75" fill="#e8e1ca"/><circle cx="105" cy="101" r="11" fill="#d4ceb9"/><circle cx="178" cy="126" r="17" fill="#d4ceb9"/><circle cx="150" cy="70" r="8" fill="#d4ceb9"/><path d="M175 143v-55m0 2 31 7-31 7" stroke="#636d85" stroke-width="4" fill="#f6c95a"/><path d="M93 169q-13-42 6-55l10-10 10 10 5 55Z" fill="#f7f3df" stroke="#69738d" stroke-width="3"/><circle cx="108" cy="99" r="15" fill="#91c7d5" stroke="#68738d" stroke-width="4"/><path d="M86 137 69 156m51-20 16 20" stroke="#f7f3df" stroke-width="13" stroke-linecap="round"/>`,
    connected: `<circle cx="151" cy="99" r="69" fill="#78c9d5" stroke="#4a91aa" stroke-width="4"/><path d="M112 47q32 5 25 29 26-3 28 19-19 11-10 26-34-1-32 29-31-9-38-36 18-20 3-35 6-27 24-32ZM182 53q32 14 34 42-22-11-27 17-12-9-11-28Z" fill="#9bd581"/><path d="M38 38 86 65m164-30-35 26M37 151l51-26m155 27-33-29" stroke="#597bb6" stroke-width="4"/><circle cx="34" cy="34" r="11" fill="#f6c85f"/><circle cx="257" cy="31" r="11" fill="#f6c85f"/><circle cx="29" cy="151" r="11" fill="#f6c85f"/><circle cx="254" cy="153" r="11" fill="#f6c85f"/>`
  };
  return `<svg class="scene-art" viewBox="0 0 300 180" role="img" aria-label="Ilustração simbólica de ${label}"><rect x="1" y="1" width="298" height="178" rx="25" fill="#f8f0d9"/>${sky}${pieces[type]}</svg>`;
}

function timeline(): string {
  return `<div class="timeline-heading"><div><span class="section-eyebrow">A grande viagem</span><h2>Escolha um capítulo</h2></div><span class="timeline-hint">Clique nos pontos para viajar no tempo</span></div>
  <div class="timeline-scroll"><div class="timeline-track"><svg class="timeline-path" viewBox="0 0 1200 130" preserveAspectRatio="none" aria-hidden="true"><path d="M37 69 C120 5 165 5 234 66 S349 126 444 64 S554 11 657 65 S774 122 868 64 S995 5 1164 64"/></svg>${eras.map((era, index) => `<button class="time-point ${index === active ? 'is-active' : ''}" type="button" data-era="${index}" aria-pressed="${index === active}" aria-label="${era.kicker}, ${era.year}"><span class="point-icon">${icon(era.icon, 35)}</span><span class="point-dot"></span><span class="point-year">${era.year}</span><span class="point-name">${era.kicker.replace(' · Jardim do Éden','')}</span></button>`).join('')}</div></div>`;
}

function details(era: Era): string {
  return `<section class="data-section" aria-labelledby="data-title"><div class="data-intro"><div><span class="section-eyebrow">Por dentro do WorldDB</span><h2 id="data-title">E se isso virasse dados?</h2></div><p>Um jeito divertido de ligar pessoas, objetos e ideias. IDs e esquemas são metáforas inventadas para este site.</p></div>
  <div class="data-grid"><div class="paper-panel entities-panel"><div class="panel-top"><span class="panel-kicker">01 / registros</span><h3>Quem aparece por aqui?</h3></div><div class="entity-list">${era.entities.map(entity => `<article class="entity-card"><span class="entity-icon">${icon(entity.icon, 31)}</span><div class="entity-content"><div class="entity-title"><strong>${entity.name}</strong><span>${entity.id}</span></div><span class="entity-type">${entity.type}</span><p>${entity.attrs.join(' · ')}</p></div></article>`).join('')}</div></div>
  <div class="right-stack"><div class="paper-panel relations-panel"><div class="panel-top"><span class="panel-kicker">02 / conexões</span><h3>Como tudo se liga</h3></div><div class="relations-list">${era.relations.map(relation => `<div class="relation-row"><span class="relation-node">${relation.from}</span><span class="relation-link"><small>${relation.label}</small><span>⟶</span><small>${relation.cardinality}</small></span><span class="relation-node">${relation.to}</span></div>`).join('')}</div></div>
  <div class="paper-panel sql-panel"><div class="panel-top"><span class="panel-kicker">03 / brincando de perguntar</span><h3>Uma consulta, uma resposta</h3></div><pre><code>${era.sql}</code></pre><div class="query-result"><span>Resultado da história</span>${era.result.map(item => `<strong>${item}</strong>`).join('')}</div></div></div></div>
  <div class="system-log"><span class="log-mark">✦</span><span class="log-label">LOG DO SISTEMA</span><strong>${era.log}</strong></div></section>`;
}

function header(mode: 'home' | 'explore' | 'learn'): string {
  return `<header class="site-header"><a class="brand" href="/" data-nav aria-label="WorldDB, voltar ao início"><span class="brand-mark">${icon('web', 35)}</span><span>World<span class="brand-db">DB</span></span></a><div class="header-note">e se o mundo fosse um software?</div><nav class="site-nav" aria-label="Menu principal"><a class="header-link ${mode === 'home' ? 'nav-active' : ''}" href="/" data-nav>Início</a><a class="header-link ${mode === 'learn' ? 'nav-active' : ''}" href="/aprender/01" data-nav>Aprender</a><a class="header-link" href="/jogar" data-nav>Jogar</a><a class="header-link ${mode === 'explore' ? 'nav-active' : ''}" href="/explorar" data-nav>Explorar</a></nav></header>`;
}

function globeMarkup(era: Era): string {
  return `<div class="hero-globe"><span class="deco star star-one">✦</span><span class="deco star star-two">✳</span><span class="deco cloud cloud-one"></span><span class="deco cloud cloud-two"></span><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div id="globe" class="globe-canvas" role="img" aria-label="Globo artístico interativo; arraste para girar"></div><div class="globe-caption"><span class="globe-caption-icon">↔</span> Arraste para girar o globo</div><div class="scene-sticker">${sceneArt(era.scene, era.kicker)}</div></div>`;
}

function renderHome(): void {
  const era = eras[0];
  document.documentElement.style.setProperty('--era', era.accent);
  document.documentElement.style.setProperty('--era-pale', era.pale);
  app.innerHTML = `${header('home')}<main id="top"><div class="intro-line"><span class="intro-spark">✳</span> Uma aventura para aprender SQL <span class="intro-spark">✳</span></div><section class="hero home-hero" aria-labelledby="home-title">${globeMarkup(era)}<div class="hero-story"><div class="chapter-pill"><span class="chapter-dot"></span> WORLDDB · A PRIMEIRA AVENTURA</div><span class="story-kicker">Um mistério em cada consulta</span><h1 id="home-title">O mundo é um banco de dados.</h1><p class="home-subtitle">Descubra suas histórias com SQL.</p><p class="story-summary">Aprenda a fazer perguntas aos dados enquanto investiga um pequeno mistério no jardim. Nenhuma experiência com programação é necessária.</p><div class="home-actions"><a class="game-button" href="/aprender/01" data-nav>Jogar <span aria-hidden="true">→</span></a><a class="outline-button" href="/explorar" data-nav>Explorar o mundo</a></div></div></section><section class="home-preview paper-panel" aria-labelledby="preview-title"><div class="preview-art">${sceneArt('garden', 'um jardim fictício')}</div><div><span class="section-eyebrow">História 01 · prólogo do jardim</span><h2 id="preview-title">O caso da fruta sumida</h2><p>Uma fruta desapareceu da árvore. Adão, Eva e Cobra têm histórias para contar. Quem passou por ali? O que aconteceu?</p><p>Você vai escrever consultas curtas para encontrar pistas. Cada resposta abre a próxima cena.</p><span class="fiction-note">✧ História inventada para o jogo, inspirada na narrativa bíblica — sem data histórica</span><div><a class="text-link" href="/aprender/01" data-nav>Começar a investigação →</a></div></div></section><section class="home-more"><span class="section-eyebrow">O mundo continua</span><h2>Seis capítulos para explorar</h2><p>A linha do tempo original segue aberta, com entidades, relações, consultas ilustrativas e fontes.</p><a class="outline-button" href="/explorar" data-nav>Ver linha do tempo →</a></section></main>`;
  app.querySelector<HTMLHeadingElement>('#preview-title')!.textContent = 'O grande sumiço da fruta';
  app.querySelector<HTMLParagraphElement>('.home-preview p')!.textContent = 'Pouco antes da festa, a fruta desapareceu. Cobra parece suspeita, mas os registros do jardim podem contar outra história.';
  initGlobe(era);
}

function renderExplore(): void {
  const era = eras[active];
  document.documentElement.style.setProperty('--era', era.accent);
  document.documentElement.style.setProperty('--era-pale', era.pale);
  app.innerHTML = `${header('explore')}
  <main id="top"><div class="intro-line"><span class="intro-spark">✳</span> Uma aventura ilustrada pelos registros da humanidade <span class="intro-spark">✳</span></div>
  <section class="hero" aria-label="Explore as épocas">${globeMarkup(era)}
  <div class="hero-story"><div class="chapter-pill"><span class="chapter-dot"></span> CAPÍTULO ${String(active + 1).padStart(2, '0')} / ${String(eras.length).padStart(2, '0')}</div><span class="story-kicker">${era.kicker}</span><h1>${era.title}</h1><div class="story-year">${era.year}</div><p class="story-summary">${era.summary}</p>${era.note ? `<div class="fiction-note">✧ ${era.note}</div>` : ''}<div class="story-actions"><button type="button" class="round-nav" id="previous" aria-label="Capítulo anterior" ${active === 0 ? 'disabled' : ''}>←</button><span>${String(active + 1).padStart(2, '0')} <span class="page-divider">/</span> ${String(eras.length).padStart(2, '0')}</span><button type="button" class="round-nav" id="next" aria-label="Próximo capítulo" ${active === eras.length - 1 ? 'disabled' : ''}>→</button><a href="#data-title" class="data-link">Explorar os dados ↓</a></div></div></section>
  <section class="timeline-section" aria-label="Linha do tempo">${timeline()}</section>${details(era)}
  <footer id="fontes"><div class="footer-title"><span class="footer-flower">✿</span><div><span class="section-eyebrow">Para continuar a aventura</span><h2>Fontes e notas</h2></div></div><p>Datas e acontecimentos históricos seguem as fontes abaixo. As ilustrações são simbólicas; os IDs, entidades, relações e consultas SQL são invenções do projeto. O Éden é apresentado como narrativa bíblica.</p><div class="source-links"><a href="https://www.si.edu/object/research-origins-agriculture-between-foraging-and-farming%3Aslasro_76126" target="_blank" rel="noopener noreferrer">Smithsonian ↗</a><a href="https://www.britishmuseum.org/sites/default/files/2019-09/Visit_Mesopotamia_KS2b.pdf" target="_blank" rel="noopener noreferrer">British Museum ↗</a><a href="https://www.loc.gov/item/2021666734/" target="_blank" rel="noopener noreferrer">Library of Congress ↗</a><a href="https://www.nasa.gov/mission/apollo-11/" target="_blank" rel="noopener noreferrer">NASA ↗</a><a href="https://home.cern/science/computing/the-birth-of-the-web/where-web-was-born/" target="_blank" rel="noopener noreferrer">CERN ↗</a><a href="https://www.biblegateway.com/passage/?search=Genesis%202-3&version=ARC" target="_blank" rel="noopener noreferrer">Gênesis 2–3 ↗</a></div><div class="footer-end">WorldDB <span>✦</span> Um pequeno experimento sobre um mundo enorme.</div></footer></main>`;
  app.querySelectorAll<HTMLButtonElement>('[data-era]').forEach(button => button.addEventListener('click', () => selectEra(Number(button.dataset.era))));
  app.querySelector<HTMLButtonElement>('#previous')?.addEventListener('click', () => selectEra(active - 1));
  app.querySelector<HTMLButtonElement>('#next')?.addEventListener('click', () => selectEra(active + 1));
  initGlobe(era);
}

function selectEra(index: number): void {
  if (index < 0 || index >= eras.length || index === active) return;
  const oldFocus = document.activeElement as HTMLElement;
  const wasTimeline = oldFocus.hasAttribute('data-era');
  const wasPrev = oldFocus.id === 'previous';
  const wasNext = oldFocus.id === 'next';
  active = index;
  disposeGlobe();
  renderExplore();
  if (wasTimeline) app.querySelector<HTMLButtonElement>(`[data-era="${index}"]`)?.focus({ preventScroll: true });
  else if (wasPrev || wasNext) app.querySelector<HTMLButtonElement>(`#${wasPrev ? 'previous' : 'next'}`)?.focus({ preventScroll: true });
  app.querySelector('.time-point.is-active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
}

function globeTexture(era: Era): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = era.sea; ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
  for (let x = 0; x < 1024; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
  for (let y = 0; y < 512; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
  const lands = [
    [[68,105],[115,67],[185,78],[207,121],[259,113],[283,163],[241,214],[204,220],[179,269],[140,230],[115,190],[77,179]],
    [[232,260],[288,234],[329,268],[342,327],[313,401],[281,451],[246,390],[224,316]],
    [[423,97],[477,75],[529,91],[548,123],[589,103],[667,111],[742,92],[793,123],[852,118],[898,159],[853,200],[799,210],[758,248],[700,223],[656,256],[612,221],[562,234],[521,201],[471,204],[430,166]],
    [[481,229],[537,230],[580,277],[566,355],[530,409],[492,380],[468,314]],
    [[784,326],[836,311],[889,340],[912,390],[869,412],[818,391]]
  ];
  ctx.fillStyle = era.land; ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 5;
  for (const points of lands) { ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#ffffffaa';
  for (let i = 0; i < 65; i++) { const x = (i * 157 + 47) % 1024; const y = (i * 83 + 31) % 512; ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 3 : 1.5, 0, Math.PI * 2); ctx.fill(); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function initGlobe(era: Era): void {
  const host = document.querySelector<HTMLDivElement>('#globe')!;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, .1, 100);
    camera.position.z = 5.5;
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(-2, 3, 5); scene.add(light);
    globe = new THREE.Mesh(new THREE.SphereGeometry(1.74, 64, 48), new THREE.MeshPhongMaterial({ map: globeTexture(era), shininess: 18, specular: '#8bc5c1' }));
    globe.rotation.y = -.6;
    scene.add(globe);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.enableZoom = false; controls.enableDamping = !reducedMotion.matches;
    controls.autoRotate = !reducedMotion.matches; controls.autoRotateSpeed = .75;
    const frame = () => { animation = requestAnimationFrame(frame); controls?.update(); renderer?.render(scene!, camera!); };
    frame();
  } catch {
    host.innerHTML = `<svg class="globe-fallback" viewBox="0 0 320 320" role="img" aria-label="Ilustração do globo terrestre"><circle cx="160" cy="160" r="142" fill="${era.sea}" stroke="#434354" stroke-width="4"/><path d="M86 62q49-25 68 20t50 31q31 6 25 36-41 4-46 44-28 1-37 44-45-6-49-49-51-20-42-70 21-5 31-56Zm134 172q46-8 49 15-22 35-60 42-13-33 11-57Z" fill="${era.land}" stroke="#fff" stroke-width="4"/><ellipse cx="160" cy="160" rx="72" ry="142" fill="none" stroke="#ffffff88" stroke-width="2"/><path d="M20 160h280" stroke="#ffffff88" stroke-width="2"/></svg>`;
    host.setAttribute('aria-label', 'Ilustração estática do globo terrestre');
  }
}

function disposeGlobe(): void {
  cancelAnimationFrame(animation);
  controls?.dispose();
  globe?.geometry.dispose(); globe?.material.map?.dispose(); globe?.material.dispose();
  renderer?.dispose(); renderer?.domElement.remove();
  globe = undefined; controls = undefined; renderer = undefined; scene = undefined; camera = undefined;
}

window.addEventListener('resize', () => {
  if (!renderer || !camera) return;
  const host = document.querySelector<HTMLDivElement>('#globe'); if (!host) return;
  camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight);
});
document.addEventListener('keydown', event => {
  if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && (document.activeElement?.hasAttribute('data-era') || document.activeElement?.classList.contains('round-nav'))) {
    event.preventDefault(); selectEra(active + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
reducedMotion.addEventListener('change', () => { if (controls) { controls.autoRotate = !reducedMotion.matches; controls.enableDamping = !reducedMotion.matches; } });
const siteTitle = 'WorldDB — descubra histórias com SQL';
type GameModule = typeof import('./game');
type LessonModule = typeof import('./lesson');
let gameModule: GameModule | undefined;
let lessonModule: LessonModule | undefined;
let renderRequest = 0;

async function render(): Promise<void> {
  const request = ++renderRequest;
  disposeGlobe();
  gameModule?.disposeGame();
  lessonModule?.disposeLesson();
  document.title = siteTitle;
  if (location.pathname === '/aprender' || location.pathname === '/aprender/') history.replaceState({}, '', '/aprender/01');
  if (location.pathname === '/aprender/01') {
    const lesson = lessonModule ?? await import('./lesson');
    lessonModule = lesson;
    if (request !== renderRequest) return;
    document.title = 'Documentação 01: Primeiras consultas — WorldDB';
    app.innerHTML = `${header('learn')}${lesson.lessonMarkup()}`;
    lesson.bindLesson(app);
  } else if (location.pathname === '/jogar') {
    const game = gameModule ?? await import('./game');
    gameModule = game;
    if (request !== renderRequest) return;
    document.documentElement.style.setProperty('--era', eras[0].accent);
    document.documentElement.style.setProperty('--era-pale', eras[0].pale);
    app.innerHTML = game.gameMarkup(sceneArt);
    game.bindGame(app, sceneArt);
  } else if (location.pathname === '/explorar') renderExplore();
  else renderHome();
}

document.addEventListener('click', event => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-nav]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  if (location.pathname !== link.pathname) history.pushState({}, '', link.pathname);
  void render();
  window.scrollTo({ top: 0, behavior: 'instant' });
});
window.addEventListener('popstate', () => { void render(); });
void render();

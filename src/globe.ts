import { AmbientLight, CanvasTexture, DirectionalLight, Mesh, MeshPhongMaterial, PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Era } from './data';

// O globo fica num módulo próprio para o three.js só ser baixado nas rotas que o mostram.

export type Globe = { dispose: () => void };

function globeTexture(era: Era): CanvasTexture {
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
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Lança erro se o WebGL não estiver disponível; quem chama mostra a ilustração estática. */
export function createGlobe(host: HTMLElement, era: Era, reducedMotion: MediaQueryList): Globe {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, host.clientWidth / Math.max(host.clientHeight, 1), .1, 100);
  camera.position.z = 5.5;
  scene.add(new AmbientLight(0xffffff, 2.1));
  const light = new DirectionalLight(0xffffff, 2.5); light.position.set(-2, 3, 5); scene.add(light);
  const material = new MeshPhongMaterial({ map: globeTexture(era), shininess: 18, specular: '#8bc5c1' });
  const globe = new Mesh(new SphereGeometry(1.74, 64, 48), material);
  globe.rotation.y = -.6;
  scene.add(globe);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableZoom = false;
  const applyMotion = () => { controls.enableDamping = !reducedMotion.matches; controls.autoRotate = !reducedMotion.matches; };
  applyMotion();
  controls.autoRotateSpeed = .75;

  // O desenho para quando o globo sai da tela, para não gastar bateria à toa.
  let animation = 0;
  let visible = true;
  const frame = () => { animation = requestAnimationFrame(frame); controls.update(); renderer.render(scene, camera); };
  const start = () => { if (!animation && visible) frame(); };
  const stop = () => { cancelAnimationFrame(animation); animation = 0; };
  const observer = new IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) start(); else stop();
  });
  observer.observe(host);
  const onResize = () => {
    if (!host.clientHeight) return;
    camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };
  window.addEventListener('resize', onResize);
  reducedMotion.addEventListener('change', applyMotion);
  start();

  return {
    dispose() {
      stop();
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      reducedMotion.removeEventListener('change', applyMotion);
      controls.dispose();
      globe.geometry.dispose(); material.map?.dispose(); material.dispose();
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}

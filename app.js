// OySir Pitch — slide navigation, speaker notes with a 3-minute timer, and a live 3D model.
const stage = document.getElementById('stage');
const slides = [...stage.querySelectorAll('.slide')];
const notesPanel = document.getElementById('notes-panel');
const notesText = document.getElementById('notes-text');
const notesPos = document.getElementById('notes-pos');
const help = document.getElementById('help');
let current = 0;

/* ---------- fit the 1920×1080 stage to the window ---------- */
function fit() {
  const vp = document.getElementById('viewport');
  const s = Math.min(vp.clientWidth / 1920, vp.clientHeight / 1080);
  stage.style.transform = `scale(${s})`;
  stage.dataset.scale = s;
  model.resize?.();
}
window.addEventListener('resize', fit);

/* ---------- navigation ---------- */
function show(i, push = true) {
  current = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((el, n) => el.classList.toggle('active', n === current));
  notesText.textContent = slides[current].querySelector('.notes')?.textContent.trim() ?? '';
  notesPos.textContent = `${current + 1} / ${slides.length} · ${slides[current].dataset.title}`;
  if (push) history.replaceState(null, '', `#slide-${current + 1}`);
  if ('model' in slides[current].dataset) model.start(); else model.pause();
  if (slides[current] !== songSlide) fadeOutSong();
  timer.begin();
}
const next = () => show(current + 1);
const prev = () => show(current - 1);

function fromHash() {
  const m = location.hash.match(/^#slide-(\d+)$/);
  return m ? Number(m[1]) - 1 : 0;
}
window.addEventListener('hashchange', () => show(fromHash(), false));

const forwardKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
const backKeys = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
const keyActions = {
  Home: () => show(0),
  End: () => show(slides.length - 1),
  n: () => { notesPanel.hidden = !notesPanel.hidden; },
  f: () => toggleFullscreen(),
  r: () => timer.reset(),
  p: () => toggleSong(),
};

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (forwardKeys.includes(k)) { e.preventDefault(); next(); }
  else if (backKeys.includes(k)) { e.preventDefault(); prev(); }
  else keyActions[k]?.();
});

// click: right two-thirds forward, left third back (not on the live model)
stage.addEventListener('click', (e) => {
  if (e.target.closest('#model-canvas, #song')) return;
  const r = stage.getBoundingClientRect();
  (e.clientX - r.left < r.width / 3) ? prev() : next();
});

// swipe
let touchX = null;
stage.addEventListener('touchstart', (e) => { if (!e.target.closest('#model-canvas, #song')) touchX = e.touches[0].clientX; }, { passive: true });
stage.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX; touchX = null;
  if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
}, { passive: true });

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { /* not allowed here; ignore */ }
}

setTimeout(() => help.classList.add('fade'), 4000);

/* ---------- 3-minute timer (starts when you leave slide 1) ---------- */
const timer = (() => {
  const el = document.getElementById('timer');
  const LIMIT = 180;
  let startedAt = null, tick = null;
  const draw = () => {
    const left = startedAt ? LIMIT - (Date.now() - startedAt) / 1000 : LIMIT;
    const a = Math.abs(Math.round(left));
    el.textContent = `${left < 0 ? '−' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
    el.classList.toggle('over', left < 0);
  };
  return {
    begin() { if (!startedAt && current > 0) { startedAt = Date.now(); tick = setInterval(draw, 250); } draw(); },
    reset() { clearInterval(tick); startedAt = null; draw(); },
  };
})();
document.getElementById('timer-reset').addEventListener('click', (e) => { e.stopPropagation(); timer.reset(); });

/* ---------- live 3D model (loads the first time its slide opens) ---------- */
const model = {
  ready: null, running: false,
  start() { this.running = true; this.ready ??= initModel(this); },
  pause() { this.running = false; },
};

async function initModel(api) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const canvas = document.getElementById('model-canvas');
  const box = canvas.parentElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  camera.position.set(190, 150, 260);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-10, 22, 0); controls.enableDamping = true; controls.enableZoom = false; controls.enablePan = false;
  controls.autoRotate = true; controls.autoRotateSpeed = 1.2;
  canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(80, 200, 120); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130 });
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 0.5));

  const [P, MESH] = await Promise.all([
    fetch('params.json').then((r) => r.json()),
    fetch('meshes.json').then((r) => r.json()),
  ]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -P.flat - 0.2; ground.receiveShadow = true; scene.add(ground);

  const mat = (p, physical) => { const m = physical ? new THREE.MeshPhysicalMaterial(p) : new THREE.MeshStandardMaterial(p); m.side = THREE.DoubleSide; return m; };
  const mats = {
    outer: mat({ color: 0xffffff, vertexColors: true, roughness: 0.85 }),
    inner: mat({ color: 0xf1eee9, roughness: 0.18, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 620] }, true),
    hinge: mat({ color: 0xc49a46, roughness: 0.32, metalness: 1 }),
    pearl: mat({ color: 0xd9d8d6, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.6, iridescenceIOR: 1.4, sheen: 1, sheenColor: 0xcfd6e8 }, true),
    brass: mat({ color: 0xc8a050, roughness: 0.25, metalness: 1 }),
  };
  const bytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  const geo = (name) => {
    const d = MESH[name]; const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bytes(d.p)), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes(d.i)), 1));
    if (d.c) { const u8 = new Uint8Array(bytes(d.c)); const f = new Float32Array(u8.length); for (let i = 0; i < u8.length; i++) f[i] = (u8[i] / 255) ** 2.2; g.setAttribute('color', new THREE.BufferAttribute(f, 3)); }
    g.computeVertexNormals(); return g;
  };
  const add = (name, m, parent) => { const mesh = new THREE.Mesh(geo(name), m); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };

  const root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root);   // model files are Z-up, in mm
  const pivot = new THREE.Group(); pivot.position.set(P.axisX, 0, 0); root.add(pivot);
  const lid = new THREE.Group(); lid.position.set(-P.axisX, 0, 0); pivot.add(lid);
  pivot.rotation.y = -THREE.MathUtils.degToRad(72);
  add('base_outer', mats.outer, root); add('base_inner', mats.inner, root); add('base_hinge', mats.hinge, root);
  add('lid_outer', mats.outer, lid); add('lid_inner', mats.inner, lid); add('lid_hinge', mats.hinge, lid);

  const pearlG = new THREE.Group(); root.add(pearlG);
  const pearl = add('pearl', mats.pearl, pearlG); pearl.position.z = P.pearlZ;
  const spout = add('pearl_nozzle', mats.brass, pearlG); spout.position.z = P.pearlZ;
  const cyl = (r, h, z, parent) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), mats.brass); m.rotation.x = Math.PI / 2; m.position.z = z + h / 2; parent.add(m); };
  cyl(6.5, 3, -P.bowl, root);
  cyl(1.4, P.pearlZ - 5.15 + P.bowl - 3 + 0.5, -P.bowl + 3, pearlG);
  cyl(P.actD / 2 - 0.15, 4.4, P.pearlZ - 5.15, pearlG);

  // spray mist
  const N = 160, pos = new Float32Array(N * 3), vel = [];
  const mistGeo = new THREE.BufferGeometry(); mistGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, transparent: true, opacity: 0, depthWrite: false }));
  root.add(mist);
  const nozzle = new THREE.Vector3(P.nozTip[0], P.nozTip[1], P.pearlZ + P.nozTip[2]);
  const dir = new THREE.Vector3(...P.nozDir);
  let sprayT = -1;
  const spray = () => {
    if (sprayT >= 0 && sprayT < 0.4) return;
    sprayT = 0;
    for (let i = 0; i < N; i++) {
      pos.set([nozzle.x, nozzle.y, nozzle.z], i * 3);
      vel[i] = dir.clone().multiplyScalar(1 + Math.random() * 1.2)
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.35)).multiplyScalar(60);
    }
  };
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (ray.intersectObjects([pearl, spout]).length) spray();
  });

  api.resize = () => {
    const w = box.clientWidth, h = box.clientHeight;          // stage pixels, before scaling
    const s = Number(stage.dataset.scale || 1);
    renderer.setPixelRatio(Math.min(2.5, (window.devicePixelRatio || 1) * s));
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  api.resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!api.running) return;
    if (sprayT >= 0) {
      sprayT += dt;
      const press = sprayT < 0.12 ? sprayT / 0.12 : Math.max(0, 1 - (sprayT - 0.12) / 0.25);
      pearlG.position.z = -2 * press;
      for (let i = 0; i < N; i++) { const v = vel[i]; v.multiplyScalar(0.965); v.z += 6 * dt; pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt; }
      mistGeo.attributes.position.needsUpdate = true;
      mist.material.opacity = sprayT < 0.1 ? 0 : Math.max(0, 0.75 - (sprayT - 0.1) * 0.5);
      mist.material.size = 3.2 + sprayT * 4;
      if (sprayT > 1.8) { sprayT = -1; mist.material.opacity = 0; }
    }
    controls.update(); renderer.render(scene, camera);
  });
}

/* ---------- "Our Time" on the song slide: P or the pearl plays it; leaving the slide fades it out ---------- */
// On the live site the song streams from YouTube. A local copy (localhost) plays audio/our-time.m4a
// when that file exists; it is kept out of Git because the recording is copyrighted.
const songSlide = document.getElementById('song').closest('.slide');
const songToggle = document.getElementById('song-toggle');
const song = { backend: null, playing: false, fadeTimer: 0 };
const localSongUrl = 'audio/our-time.m4a';
const isLocalCopy = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

function showSongPlaying(playing) {
  song.playing = playing;
  songToggle.classList.toggle('playing', playing);
  songToggle.setAttribute('aria-label', playing ? 'Pause “Our Time”' : 'Play “Our Time”');
}

function createLocalSong(url) {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.addEventListener('playing', () => showSongPlaying(true));
  audio.addEventListener('pause', () => showSongPlaying(false));
  return {
    play: () => audio.play().catch(() => showSongPlaying(false)),
    pause: () => audio.pause(),
    getVolume: () => audio.volume,
    setVolume: (volume) => { audio.volume = volume; },
  };
}

function showYouTubeState(state) {
  const { PLAYING, PAUSED, ENDED } = YT.PlayerState;
  if (state === PLAYING) showSongPlaying(true);
  else if (state === PAUSED || state === ENDED) showSongPlaying(false);
}

function createYouTubeSong(videoId) {
  return new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => {
      const player = new YT.Player('song-player', {
        videoId,
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: () => resolve({
            play: () => player.playVideo(),
            pause: () => player.pauseVideo(),
            getVolume: () => player.getVolume() / 100,
            setVolume: (volume) => player.setVolume(volume * 100),
          }),
          onStateChange: (e) => showYouTubeState(e.data),
        },
      });
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.append(script);
  });
}

async function localSongExists() {
  try { return (await fetch(localSongUrl, { method: 'HEAD' })).ok; } catch { return false; }
}

async function loadSong() {
  if (isLocalCopy && await localSongExists()) {
    document.getElementById('song').classList.add('local');
    song.backend = createLocalSong(localSongUrl);
    return;
  }
  song.backend = await createYouTubeSong('lMo7szh1eLA');
}

function playSong() {
  if (!song.backend) return;
  clearInterval(song.fadeTimer);
  song.backend.setVolume(1);
  song.backend.play();
}

function fadeOutSong() {
  if (!song.backend || !song.playing) return;
  clearInterval(song.fadeTimer);
  let volume = song.backend.getVolume();
  song.fadeTimer = setInterval(() => {
    volume -= 0.06;
    if (volume > 0) { song.backend.setVolume(volume); return; }
    clearInterval(song.fadeTimer);
    song.backend.pause();
    song.backend.setVolume(1);
  }, 50);
}

function toggleSong() {
  if (song.playing) fadeOutSong(); else playSong();
}

songToggle.addEventListener('click', toggleSong);
loadSong();

/* ---------- go ---------- */
fit();
show(fromHash(), false);

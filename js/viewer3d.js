import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── Config — edit to change controls ──────────────────
const CONFIG = {
  background:       0x1a1a1a,
  ambientIntensity: 1.5,
  dirLightIntensity: 2.0,

  enableDamping:    false,
  dampingFactor:    0.08,
  autoRotate:       false,
  autoRotateSpeed:  1.0,

  enableZoom:       true,
  zoomSpeed:        2.5,
  minDistance:      0.01,
  maxDistance:      1000,

  enablePan:        true,
  panSpeed:         0.5,

  enableRotate:     true,
  rotateSpeed:      10,
};

let renderer, scene, camera, orthoCamera, controls, animId;
let useOrtho = true;
let lastModelSize = 1;
let viewerCanvas;

function initViewer(canvas) {
  viewerCanvas = canvas;
  const w = canvas.clientWidth  || 800;
  const h = canvas.clientHeight || 600;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h, false);
  renderer.setClearColor(CONFIG.background);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, CONFIG.ambientIntensity));

  const dir = new THREE.DirectionalLight(0xffffff, CONFIG.dirLightIntensity);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  const dir2 = new THREE.DirectionalLight(0xffffff, CONFIG.dirLightIntensity * 0.4);
  dir2.position.set(-5, -5, -5);
  scene.add(dir2);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 100000);
  camera.position.set(2, 2, 4);

  // Orthographic camera (sized later when model loads)
  const frustum = 5;
  orthoCamera = new THREE.OrthographicCamera(
    -frustum * (w/h), frustum * (w/h), frustum, -frustum, -100000, 100000
  );
  orthoCamera.position.copy(camera.position);

  controls = new TrackballControls(useOrtho ? orthoCamera : camera, canvas);
  controls.rotateSpeed   = CONFIG.rotateSpeed;
  controls.zoomSpeed     = CONFIG.zoomSpeed;
  controls.panSpeed      = CONFIG.panSpeed;
  controls.noZoom        = !CONFIG.enableZoom;
  controls.noPan         = !CONFIG.enablePan;
  controls.noRotate      = !CONFIG.enableRotate;
  controls.dynamicDampingFactor = CONFIG.dampingFactor;
  controls.staticMoving  = !CONFIG.enableDamping;

  // Mouse mapping: left=pan, middle-drag=rotate, scroll=zoom, right=nothing
  // Mouse mapping: default — left=rotate, middle=zoom, right=pan
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };

  window._viewerResize = function() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const frustum = 5;
      orthoCamera.left   = -frustum * (w/h);
      orthoCamera.right  =  frustum * (w/h);
      orthoCamera.top    =  frustum;
      orthoCamera.bottom = -frustum;
      orthoCamera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
  };
  window.addEventListener('resize', window._viewerResize);

  function animate() {
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, useOrtho ? orthoCamera : camera);
  }
  animate();

  // ── Part selection via click ──────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedMesh = null;
  let originalMaterials = new Map();

  canvas.addEventListener('click', (e) => {
    // Only select if mouse didn't move much (not orbiting)
    const rect = canvas.getBoundingClientRect();
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    const activeCam = useOrtho ? orthoCamera : camera;
    raycaster.setFromCamera(mouse, activeCam);

    const meshes = [];
    scene.traverse(c => { if (c.isMesh && c.visible) meshes.push(c); });
    const hits = raycaster.intersectObjects(meshes, false);

    deselectCurrent();

    if (hits.length > 0) {
      selectMesh(hits[0].object);
    }
  });

  window._deselectCurrent = deselectCurrent;
  window._selectMesh = selectMesh;

  function deselectCurrent() {
    if (selectedMesh && originalMaterials.has(selectedMesh)) {
      selectedMesh.material = originalMaterials.get(selectedMesh);
      originalMaterials.delete(selectedMesh);
      selectedMesh = null;
    }
  }

  function selectMesh(mesh) {
    deselectCurrent();
    selectedMesh = mesh;
    originalMaterials.set(mesh, mesh.material);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    mesh.material = hlMat;
  }

  // ── Right-click context menu ──────────────────────
  const ctxMenu    = document.getElementById('modelContextMenu');
  const ctxHide    = document.getElementById('ctxHidePart');
  const ctxShowOnly = document.getElementById('ctxShowOnly');
  const ctxShowAll = document.getElementById('ctxShowAll');
  let ctxTarget = null;

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

    const activeCam = useOrtho ? orthoCamera : camera;
    raycaster.setFromCamera(mouse, activeCam);

    const meshes = [];
    scene.traverse(c => { if (c.isMesh && c.visible) meshes.push(c); });
    const hits = raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      ctxTarget = hits[0].object;
      ctxHide.style.display = 'block';
      ctxShowOnly.style.display = 'block';
    } else {
      ctxTarget = null;
      ctxHide.style.display = 'none';
      ctxShowOnly.style.display = 'none';
    }
    const rect2 = canvas.parentElement.getBoundingClientRect();
    ctxMenu.style.left = (e.clientX - rect2.left) + 'px';
    ctxMenu.style.top  = (e.clientY - rect2.top)  + 'px';
    ctxMenu.removeAttribute('hidden');
  });

  ctxHide.addEventListener('click', () => {
    if (ctxTarget) {
      ctxTarget.visible = false;
      updateTreeCheckbox(ctxTarget, false);
    }
    ctxMenu.setAttribute('hidden', '');
    ctxTarget = null;
  });

  ctxShowOnly.addEventListener('click', () => {
    if (ctxTarget) {
      scene.traverse(c => {
        if (c.isMesh) {
          c.visible = (c === ctxTarget);
          updateTreeCheckbox(c, c.visible);
        }
      });
    }
    ctxMenu.setAttribute('hidden', '');
    ctxTarget = null;
  });

  ctxShowAll.addEventListener('click', () => {
    scene.traverse(c => { if (c.isMesh) c.visible = true; });
    // Update all tree checkboxes
    document.querySelectorAll('#modelTree input[type="checkbox"]').forEach(cb => { cb.checked = true; });
    ctxMenu.setAttribute('hidden', '');
    ctxTarget = null;
  });

  // Hide menu on any other click
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 2) ctxMenu.setAttribute('hidden', '');
  });

  function updateTreeCheckbox(mesh, visible) {
    // Find checkbox associated with this mesh by matching name
    const labels = document.querySelectorAll('#modelTree label');
    labels.forEach(label => {
      const span = label.querySelector('span');
      if (span && span.textContent === (mesh.name || mesh.type)) {
        const cb = label.querySelector('input');
        if (cb) cb.checked = visible;
      }
    });
  }
}

function loadModel(src) {
  const toRemove = [];
  scene.traverse(c => { if (c.userData.isModel) toRemove.push(c); });
  toRemove.forEach(c => scene.remove(c));

  const loader = new GLTFLoader();
  loader.load(src, gltf => {
    const model = gltf.scene;
    model.userData.isModel = true;

    // Disable back-face culling on all meshes
    model.traverse(c => {
      if (c.isMesh && c.material) {
        if (Array.isArray(c.material)) {
          c.material.forEach(m => { m.side = THREE.DoubleSide; });
        } else {
          c.material.side = THREE.DoubleSide;
        }
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    const size   = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    model.position.sub(center);
    scene.add(model);

    // Build tree view
    buildTree(model);

    const dist = maxDim * 2;
    lastModelSize = maxDim;

    // Default view: ortho + iso + fit
    useOrtho = true;
    isoView();
  }, undefined, err => console.error('GLB load error:', err));
}

function fitView() {
  const d = lastModelSize * 2;
  const activeCam = useOrtho ? orthoCamera : camera;

  activeCam.position.set(d, d * 0.6, d);
  activeCam.lookAt(0, 0, 0);

  if (useOrtho && viewerCanvas) {
    const w = viewerCanvas.clientWidth, h = viewerCanvas.clientHeight;
    const frustum = lastModelSize * 1.2;
    orthoCamera.left   = -frustum * (w/h);
    orthoCamera.right  =  frustum * (w/h);
    orthoCamera.top    =  frustum;
    orthoCamera.bottom = -frustum;
  }

  activeCam.updateProjectionMatrix();
  controls.object = activeCam;
  controls.target.set(0, 0, 0);
  controls.maxDistance = lastModelSize * 10;
  controls.reset();
}

function isoView() {
  const d = lastModelSize * 2;
  const iso = d / Math.sqrt(3);

  orthoCamera.position.set(iso, iso, iso);
  orthoCamera.lookAt(0, 0, 0);
  orthoCamera.up.set(0, 1, 0);

  if (viewerCanvas) {
    const w = viewerCanvas.clientWidth, h = viewerCanvas.clientHeight;
    const frustum = lastModelSize * 1.2;
    orthoCamera.left   = -frustum * (w/h);
    orthoCamera.right  =  frustum * (w/h);
    orthoCamera.top    =  frustum;
    orthoCamera.bottom = -frustum;
  }

  orthoCamera.updateProjectionMatrix();
  controls.object = orthoCamera;
  controls.target.set(0, 0, 0);
  controls.maxDistance = lastModelSize * 10;
  controls.reset();
}

function buildTree(model) {
  const container = document.getElementById('modelTree');
  if (!container) return;
  container.innerHTML = '';

  function createNode(obj, parent) {
    // Skip objects with no mesh and no children with meshes
    const hasMesh = obj.isMesh || obj.children.some(c => c.isMesh || c.children.length > 0);
    if (!hasMesh && obj.children.length === 0) return;

    const name = obj.name || obj.type || 'Object';
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = obj.visible;
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      obj.visible = checkbox.checked;
    });
    label.appendChild(checkbox);
    const span = document.createElement('span');
    span.textContent = name;
    span.style.cursor = 'pointer';
    span.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Find first mesh in this object or its children
      let target = null;
      if (obj.isMesh) target = obj;
      else obj.traverse(c => { if (c.isMesh && !target) target = c; });
      if (target && window._selectMesh) window._selectMesh(target);
    });
    label.appendChild(span);
    parent.appendChild(label);

    if (obj.children.length > 0) {
      const group = document.createElement('div');
      group.className = 'tree-group';
      obj.children.forEach(child => createNode(child, group));
      if (group.children.length > 0) parent.appendChild(group);
    }
  }

  model.children.forEach(child => createNode(child, container));

  // If tree is empty (single part), show the root
  if (container.children.length === 0) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => { model.visible = checkbox.checked; });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(model.name || 'Part'));
    container.appendChild(label);
  }
}

function destroyViewer() {
  if (animId) cancelAnimationFrame(animId);
  window.removeEventListener('resize', window._viewerResize);
  
  // Clean up canvas event listeners
  if (viewerCanvas) {
    const newCanvas = viewerCanvas.cloneNode(true);
    viewerCanvas.parentNode.replaceChild(newCanvas, viewerCanvas);
    viewerCanvas = null;
  }
  
  if (renderer) renderer.dispose();
  if (controls) controls.dispose();
  renderer = scene = camera = orthoCamera = controls = null;
}

// ── Modal wiring ──────────────────────────────────────
const modal    = document.getElementById('modelModal');
const canvas   = document.getElementById('modelCanvas');
const backdrop = document.getElementById('modelBackdrop');
const closeBtn = document.getElementById('modelClose');

if (modal) {
  window.openModel = function(src) {
    modal.removeAttribute('hidden');
    setTimeout(() => {
      if (!renderer) initViewer(canvas);
      else window._viewerResize();
      loadModel(src);
    }, 100);
  };

  function handleEscape(e) {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
      closeModel();
    }
  }

  function closeModel() {
    modal.setAttribute('hidden', '');
    destroyViewer();
    document.removeEventListener('keydown', handleEscape);
  }

  closeBtn.addEventListener('click', closeModel);
  backdrop.addEventListener('click', closeModel);
  
  // Add escape listener when modal opens
  const originalOpenModel = window.openModel;
  window.openModel = function(src) {
    document.addEventListener('keydown', handleEscape);
    originalOpenModel(src);
  };

  // Background swatches
  const bgColors = [0x1a1a1a, 0xffffff];
  const swatches = document.querySelectorAll('.model-modal__bg-swatch');
  swatches.forEach(sw => {
    sw.addEventListener('click', () => {
      const idx = parseInt(sw.dataset.bg);
      if (renderer) renderer.setClearColor(bgColors[idx]);
      swatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });

  // Camera toggle (perspective / orthographic)
  const camBtn = document.getElementById('modelCamToggle');
  if (camBtn) {
    camBtn.addEventListener('click', () => {
      if (!controls || !camera || !orthoCamera) return;
      useOrtho = !useOrtho;
      camBtn.textContent = useOrtho ? 'Perspective' : 'Orthographic';

      const activeCam = useOrtho ? orthoCamera : camera;
      // Sync position
      if (useOrtho) {
        orthoCamera.position.copy(camera.position);
        orthoCamera.quaternion.copy(camera.quaternion);
      } else {
        camera.position.copy(orthoCamera.position);
        camera.quaternion.copy(orthoCamera.quaternion);
      }

      controls.object = activeCam;
      controls.update();
    });
  }

  // Fit view
  const fitBtn = document.getElementById('modelFit');
  if (fitBtn) {
    fitBtn.addEventListener('click', () => {
      if (renderer) fitView();
    });
  }

  // Isometric view
  const isoBtn = document.getElementById('modelIso');
  if (isoBtn) {
    isoBtn.addEventListener('click', () => {
      if (!controls || !orthoCamera) return;
      if (!useOrtho) {
        useOrtho = true;
        camBtn.textContent = 'Persp';
      }
      isoView();
    });
  }
}

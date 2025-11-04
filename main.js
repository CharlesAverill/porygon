import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import porygonUrl from './porygon.glb?url';

const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0.2, 4, 11);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(1, 1, 2);
scene.add(directionalLight);
scene.add(new THREE.AmbientLight(0xffffff, 1));


// Animation system
const loader = new GLTFLoader();
let mixer = null;
let actions = {};
let activeAction = null;

// Create dropdown
const select = document.createElement('select');
select.style.position = 'absolute';
select.style.top = '10px';
select.style.left = '10px';
select.style.zIndex = '10';
select.style.padding = '5px';
select.style.background = 'rgba(255,255,255,0.9)';
document.body.appendChild(select);

// Load model
loader.load(
  porygonUrl,
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    mixer = new THREE.AnimationMixer(model);

    // Populate dropdown
    gltf.animations.forEach((clip) => {
      const option = document.createElement('option');
      option.value = clip.name;
      option.textContent = clip.name || 'Unnamed Clip';
      select.appendChild(option);

      actions[clip.name] = mixer.clipAction(clip);
    });

    // Play first animation by default
    if (gltf.animations.length > 0) {
      activeAction = actions[gltf.animations[0].name];
      activeAction.play();
    }

    // Change animation on dropdown selection
    select.addEventListener('change', (event) => {
      const selectedName = event.target.value;
      const nextAction = actions[selectedName];
      if (activeAction !== nextAction) {
        nextAction.reset().play();
        if (activeAction) {
          activeAction.crossFadeTo(nextAction, 0.5, false); // 0.5s smooth blend
        }
        activeAction = nextAction;
      }
    });
  },
  undefined,
  (error) => console.error(error)
);

// Clock and animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
  // console.log(camera.position);
}
animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

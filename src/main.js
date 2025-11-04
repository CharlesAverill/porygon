import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import porygonUrl from '../static/porygon.glb?url';
import { sceneSetup } from './scene';

const [scene, camera, renderer] = sceneSetup();

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Animation system
const loader = new GLTFLoader();
let mixer = null;
let actions = {};
let activeAction = null;

// --- Create button container ---
const buttonContainer = document.createElement('div');
buttonContainer.style.position = 'absolute';
buttonContainer.style.left = '10px';
buttonContainer.style.top = '50%';
buttonContainer.style.transform = 'translateY(-50%)';
buttonContainer.style.display = 'flex';
buttonContainer.style.flexDirection = 'column';
buttonContainer.style.gap = '6px';
buttonContainer.style.zIndex = '10';
buttonContainer.style.padding = '6px';
buttonContainer.style.background = 'rgba(255, 255, 255, 0.15)';
buttonContainer.style.backdropFilter = 'blur(6px)';
buttonContainer.style.borderRadius = '10px';
document.body.appendChild(buttonContainer);

// Responsive layout: bottom grid on mobile
const style = document.createElement('style');
style.textContent = `
@media (max-width: 768px) {
  div.animation-buttons {
    flex-direction: row !important;
    flex-wrap: wrap;
    justify-content: center;
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    bottom: 0 !important;
    transform: none !important;
    background: rgba(0, 0, 0, 0.4) !important;
    padding: 8px !important;
    border-radius: 0 !important;
  }
  div.animation-buttons button {
    flex: 1 1 30%;
    font-size: 12px;
    margin: 4px;
  }
}
`;
document.head.appendChild(style);
buttonContainer.classList.add('animation-buttons');

let shinyButton;
let isShiny;
function setupShiny() {
  let val = Math.random();
  isShiny = !(val < 0.1); // this will be inverted by the click below
  shinyButton.click();
}

// Load model
loader.load(
  porygonUrl,
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    let shinyBodyMat;
    let shinyEyeMat;
    let bodyMat;
    let eyeMat;
    gltf.parser.getDependencies( 'material' ).then( ( materials ) => {
      shinyBodyMat = materials.find(m => m.name === 'BodyShiny');
      shinyEyeMat = materials.find(m => m.name === 'EyeShiny');
      bodyMat = materials.find(m => m.name === 'BodyTexture');
      eyeMat = materials.find(m => m.name === 'EyeTexture');

      setupShiny();
    } );
    model.children = model.children.filter(c => c.name !== "ShinyMaterials");

    mixer = new THREE.AnimationMixer(model);

    // Populate buttons
    gltf.animations.forEach((clip) => {
      if (clip.name.includes("pm0137"))
        return;
      const btn = document.createElement('button');
      btn.textContent = clip.name || 'Unnamed';
      btn.style.padding = '6px 10px';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.style.background = 'rgba(255, 255, 255, 0.8)';
      btn.style.fontFamily = 'sans-serif';
      btn.style.fontWeight = 'bold';
      btn.style.transition = 'all 0.2s ease';
      btn.onmouseenter = () => (btn.style.background = 'white');
      btn.onmouseleave = () => (btn.style.background = 'rgba(255,255,255,0.8)');
      buttonContainer.appendChild(btn);

      actions[clip.name] = mixer.clipAction(clip);

      btn.addEventListener('click', () => {
        const nextAction = actions[clip.name];
        if (activeAction !== nextAction) {
          nextAction.reset().play();
          if (activeAction) {
            activeAction.crossFadeTo(nextAction, 0.5, false);
          }
          activeAction = nextAction;
        }
      });
    });

    // Play first animation by default
    if (gltf.animations.length > 0) {
      activeAction = actions["idle"];
      activeAction.play();
    }

    // --- MATERIAL SWAP BUTTON ---
    shinyButton = document.createElement('button');
    shinyButton.textContent = 'Toggle Shiny';
    shinyButton.style.display = 'block';
    shinyButton.style.marginTop = '10px';
    shinyButton.style.padding = '6px 10px';
    shinyButton.style.fontSize = '14px';
    shinyButton.style.borderRadius = '6px';
    shinyButton.style.border = '1px solid #ccc';
    shinyButton.style.background = '#fff';
    buttonContainer.appendChild(shinyButton);

    shinyButton.addEventListener('click', () => {
      isShiny = !isShiny;

      model.traverse((child) => {
        if (!child.isMesh) return; // only process meshes
        const mat = child.material;
        if (!mat) return; // safety check

        let newbody = isShiny ? shinyBodyMat : bodyMat;
        let neweye = isShiny ? shinyEyeMat : eyeMat;
        if (mat.name.includes("Body") && newbody) child.material = newbody;
        if (mat.name.includes("Eye") && neweye) child.material = neweye;
      });
    });

    // --- Center and frame the model automatically ---
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Re-center the model at the origin
    model.position.sub(center);

    // Compute a good distance: a bit further than the largest dimension
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = maxDim / (2 * Math.tan(fov / 2));

    // Add a little padding so the model isn’t clipped
    cameraZ *= 2.5;

    camera.position.set(0, maxDim * 0.5, cameraZ);
    camera.lookAt(0, 0, 0);

    controls.target.set(0, 0, 0);
    controls.update();
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
}
animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

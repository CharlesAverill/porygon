import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import porygonUrl from '../static/porygon.glb?url';
import { sceneSetup, defaultMarkerOpacity } from './scene';
import { Porygon } from './porygon.js';
import { AnimationStateMachine, IDLE, WALK, HAPPY, HATE, DAMAGE, TACKLE, SPECIAL } from './states.js';

const [scene, camera, renderer, groundPlane, clickMarker] = sceneSetup();

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
const buttonContainer = document.getElementById('buttonContainer');

let shinyButton;
let isShiny;
function setupShiny() {
  let val = Math.random();
  isShiny = !(val < 0.1); // this will be inverted by the click below
  shinyButton.click();
}

let porygon;

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
    gltf.parser.getDependencies('material').then((materials) => {
      shinyBodyMat = materials.find(m => m.name === 'BodyShiny');
      shinyEyeMat = materials.find(m => m.name === 'EyeShiny');
      bodyMat = materials.find(m => m.name === 'BodyTexture');
      eyeMat = materials.find(m => m.name === 'EyeTexture');

      setupShiny();
    });
    model.children = model.children.filter(c => c.name !== "ShinyMaterials");

    mixer = new THREE.AnimationMixer(model);

    // Get rid of motion during walk animation
    gltf.animations.forEach((clip) => {
      if (clip.name.toLowerCase().includes('walk')) {
        clip.tracks = clip.tracks.filter(track => {
          // Remove tracks that move the armature or root bone
          return !track.name.match(/\.position$/);
        });
      }
    });

    // Populate buttons
    gltf.animations.forEach((clip) => {
      if (clip.name.includes("pm0137"))
        return;
      const btn = document.createElement('button');
      btn.textContent = clip.name;
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

    porygon = new Porygon(model, mixer, actions);
  },
  undefined,
  (error) => console.error(error)
);

// --- Raycasting setup ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let isDragging = false;

window.addEventListener('mousedown', () => {
  isDragging = false;
});

window.addEventListener('mousemove', () => {
  isDragging = true;
});

window.addEventListener('mouseup', (event) => {
  if (isDragging) return; // Ignore click+drag

  // Ignore clicks on UI buttons
  if (event.target.tagName.toLowerCase() === 'button') return;

  // Get normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  // Update the raycaster from camera and mouse
  raycaster.setFromCamera(mouse, camera);

  if (porygon && porygon.model) {
    const intersects = raycaster.intersectObject(porygon.model, true);
    if (intersects.length > 0) {
      porygon.onClick();
      return;
    }
  }

  // Intersect with the y=0 plane
  const intersectionPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

  if (intersectionPoint) {
    clickMarker.position.copy(intersectionPoint);
    clickMarker.visible = true;
    clickMarker.material.opacity = defaultMarkerOpacity;
    console.log("Clicked world point:", intersectionPoint);
    if (porygon) {
      porygon.runToPos(intersectionPoint);
    }
  }
});

// Clock and animation loop
const clock = new THREE.Clock();
const CAMERA_FOLLOW_SPEED = 1.5;     // how quickly the camera catches up
const CAMERA_THRESHOLD = 10;          // start following when farther than this
const CAMERA_OFFSET = new THREE.Vector3(0, 10, 20); // relative position behind and above Porygon

let userIsControlling = false;
let userStopTimeout = null;

controls.addEventListener('start', () => {
  userIsControlling = true;
  if (userStopTimeout) {
    clearTimeout(userStopTimeout);
    userStopTimeout = null;
  }
});

controls.addEventListener('end', () => {
  if (userStopTimeout) clearTimeout(userStopTimeout);
  userStopTimeout = setTimeout(() => {
    userIsControlling = false;
  }, 5000); // 5 seconds after user stops interacting
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  if (porygon) {
    porygon.update(delta);
    controls.target.copy(porygon.position);
    if (porygon.asm.current === IDLE && clickMarker.visible) {
      clickMarker.material.opacity = Math.max(0, clickMarker.material.opacity - delta * 0.5);
      if (clickMarker.material.opacity <= 0) {
        clickMarker.visible = false;
        clickMarker.material.opacity = defaultMarkerOpacity;
      }
    }

    const desiredCameraPos = new THREE.Vector3().copy(porygon.position).add(CAMERA_OFFSET);
    const dist = camera.position.distanceTo(desiredCameraPos);
    if (!userIsControlling && dist > CAMERA_THRESHOLD) {
      camera.position.lerp(desiredCameraPos, delta * CAMERA_FOLLOW_SPEED);
    }
    camera.lookAt(porygon.position);
  }
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

// Create an FPS counter element
const fpsCounter = document.createElement('div');
fpsCounter.style.position = 'fixed';
fpsCounter.style.top = '10px';
fpsCounter.style.right = '10px';
fpsCounter.style.padding = '5px 10px';
fpsCounter.style.background = 'rgba(0, 0, 0, 0.5)';
fpsCounter.style.color = 'white';
fpsCounter.style.fontFamily = 'monospace';
fpsCounter.style.fontSize = '14px';
fpsCounter.style.zIndex = '1000';
document.body.appendChild(fpsCounter);

let lastFrameTime = performance.now();
let frames = 0;
let fps = 0;

function updateFPS() {
  const now = performance.now();
  frames++;

  if (now - lastFrameTime >= 1000) {
    fps = frames;
    frames = 0;
    lastFrameTime = now;
    fpsCounter.textContent = `FPS: ${fps}`;
  }

  requestAnimationFrame(updateFPS);
}

updateFPS();

import * as THREE from 'three';

export let globalWarmth = 0.5; // 0 = cold/blue, 1 = warm/orange
export const MEDIAN_WARMTH = 0.5;
export const WARMTH_DRIFT_SPEED = 0.01; // per second

export function warmthToColor(warmth) {
    // cold = #66aaff, warm = #ffbb66
    const cold = new THREE.Color(0x66aaff);
    const warmC = new THREE.Color(0xffbb66);
    return cold.lerp(warmC, THREE.MathUtils.clamp(warmth, 0, 1));
}

let directionalLight1, directionalLight2, hemiLight, scene;

export function setWarmth(w) {
    globalWarmth = THREE.MathUtils.clamp(w, 0, 1);
    const c = warmthToColor(globalWarmth);

    if (directionalLight1) directionalLight1.color.copy(c);
    if (directionalLight2) directionalLight2.color.copy(c);
    if (hemiLight) hemiLight.color.copy(c);

    if (scene)
        scene.background = c;
}

export const defaultMarkerOpacity = 0.6;

export function sceneSetup() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0.2, 4, 11);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Lighting
    directionalLight1 = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight1.position.set(1, 1, 2);
    scene.add(directionalLight1);
    directionalLight2 = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight2.position.set(-1, 1, 2);
    scene.add(directionalLight2);
    hemiLight = new THREE.HemisphereLight(0xffffff, 0xcccccc, 1.2);
    scene.add(hemiLight);

    // Ground grid
    const grid = new THREE.GridHelper(10000, 5000, 0xcccccc, 0xeeeeee);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    grid.material.opacity = 0.6;
    grid.material.transparent = true;
    scene.add(grid);

    // Click marker
    const circleGeometry = new THREE.CircleGeometry(2, 32);
    const circleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
    const clickMarker = new THREE.Mesh(circleGeometry, circleMaterial);

    // Rotate so it lies flat on the ground (XZ plane)
    clickMarker.rotation.x = -Math.PI / 2;
    clickMarker.visible = false; // hidden until used
    scene.add(clickMarker);

    setWarmth(globalWarmth);

    return [scene, camera, renderer, groundPlane, clickMarker];
}

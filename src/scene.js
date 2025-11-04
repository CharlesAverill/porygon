import * as THREE from 'three';

let directionalLight1, directionalLight2, hemiLight;

export function setLightColors(d1, d2, h) {
    directionalLight1.color = new THREE.Color(d1);
    directionalLight2.color = new THREE.Color(d2);
    hemiLight.color = new THREE.Color(h);
}

export function sceneSetup() {
    const scene = new THREE.Scene();
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
    grid.material.opacity = 0.6;
    grid.material.transparent = true;
    scene.add(grid);

    return [scene, camera, renderer];
}

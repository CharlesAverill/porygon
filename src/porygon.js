import * as THREE from 'three';
import { clamp } from 'three/src/math/MathUtils.js';
import { AnimationStateMachine, IDLE, WALK, HAPPY, HATE, DAMAGE, TACKLE, SPECIAL } from './states.js';
import { globalWarmth } from './scene.js';
import neutral_icon_url from "../static/images/happiness/neutral.png";
import happy_icon_url from "../static/images/happiness/happy.png";
import upset_icon_url from "../static/images/happiness/upset.png";

const [MIN_HAPPINESS, MAX_HAPPINESS] = [0, 100];
const [MIN_HEALTH, MAX_HEALTH] = [0, 100];

function selectPosInRadius(origin, radius) {
    let theta = 2 * Math.PI * Math.random();
    let r = radius * Math.sqrt(Math.random());
    return new THREE.Vector3(origin.x + r * Math.cos(theta), origin.y, origin.z + r * Math.sin(theta));
}

function makeTextTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

let imgTextureCache = {};
let imgLoadingCallbacks = {};  // for requests made before image finishes loading

function makeImgTexture(src, callback) {
    // If cached texture already exists → return immediately.
    if (imgTextureCache[src]) {
        callback(imgTextureCache[src]);
        return;
    }

    // If this image is STILL loading → queue the callback.
    if (imgLoadingCallbacks[src]) {
        imgLoadingCallbacks[src].push(callback);
        return;
    }

    // First request for this image → initialize callback queue
    imgLoadingCallbacks[src] = [callback];

    const img = new Image();
    img.src = src;
    img.crossOrigin = "anonymous";

    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;

        // Store in cache
        imgTextureCache[src] = tex;

        // Run ALL queued callbacks
        for (const cb of imgLoadingCallbacks[src]) {
            cb(tex);
        }

        // Cleanup loading queue
        delete imgLoadingCallbacks[src];
    };
}

const RUN_SPEED = 4;
const WALK_SPEED = 1.5;
const MAX_DISTANCE = 20;

export class Porygon {
    happiness;
    position;
    target_position;
    health;
    model;
    asm;
    running;
    timeSinceRandWalk;
    timeSinceHappy;
    danceCount;

    constructor(model, mixer, actions) {
        this.happiness = (MIN_HAPPINESS + MAX_HAPPINESS) / 2;
        this.position = new THREE.Vector3(0, 0, 0);
        this.target_position = null;
        this.health = MAX_HEALTH;
        this.model = model;
        this.asm = new AnimationStateMachine(mixer, actions, IDLE);
        this.running = false;
        this.preferredWarmth = Math.random();
        console.log("Preferred warmth: " + this.preferredWarmth);

        this.timeSinceRandWalk = 0;
        this.timeSinceHappy = 0;
        this.danceCount = 0;
        this.timeSinceUpdatedHappiness = 0;

        // --- Create happiness billboard ---
        const spriteMat = new THREE.SpriteMaterial({
            // temporary text, updated onClick
            map: makeTextTexture(""),
            transparent: true
        });

        this.happinessSprite = new THREE.Sprite(spriteMat);
        this.happinessSprite.visible = false;
        this.happinessSprite.material.opacity = 1.;
        this.happinessSprite.scale.multiplyScalar(2);

        this.model.add(this.happinessSprite);
        this.happinessSprite.position.set(0, 7, 0);
        
        mixer.addEventListener('loop', (event) => {
            this.onAnimationFinished();
        });
    }

    updateHappinessValue(delta) {
        this.happiness = clamp(this.happiness + delta, MIN_HAPPINESS, MAX_HAPPINESS);
        console.log(delta > 0 ? "I'm getting happier!" : "I'm getting sadder...");
    }

    updateHealth(delta) {
        this.health = clamp(this.health + delta, MIN_HEALTH, MAX_HEALTH);
    }

    runToPos(tpos) {
        this.target_position = tpos;
        this.running = true;
    }

    walkToPos(tpos) {
        this.target_position = tpos;
        this.running = false;
    }

    move(deltaTime) {
        if (!this.target_position) return;

        const direction = new THREE.Vector3().subVectors(this.target_position, this.position);
        const distance = direction.length();
        if (distance < 0.001) return;

        const step = RUN_SPEED * deltaTime;
        if (step >= distance) {
            this.position.copy(this.target_position);
            this.target_position = null;
            this.asm.transitionTo(IDLE);
        } else {
            direction.normalize();
            this.position.add(direction.multiplyScalar(step));
        }

        if (direction.lengthSq() > 0) {
            const targetRotation = Math.atan2(direction.x, direction.z);
            // Smoothly interpolate rotation (optional)
            let currentY = this.model.rotation.y;
            let deltaY = targetRotation - currentY;
            deltaY = THREE.MathUtils.euclideanModulo(deltaY + Math.PI, Math.PI * 2) - Math.PI;
            this.model.rotation.y = currentY + deltaY * 0.1; // 0.1 = turn speed factor
        }

        this.model.position.copy(this.position);
    }

    onClick() {
        const iconUrl = 
            this.happiness < (MAX_HAPPINESS - MIN_HAPPINESS) / 3 ? upset_icon_url :
            (this.happiness < 2 * (MAX_HAPPINESS - MIN_HAPPINESS) / 3 ? neutral_icon_url :
            happy_icon_url);

        makeImgTexture(iconUrl, (tex) => {
            this.happinessSprite.material.map = tex;
            this.happinessSprite.material.needsUpdate = true;
            this.happinessSprite.visible = true;
        });

        this._billboardTimer = 2.0;
    }


    updateTimers(delta) {
        this.timeSinceRandWalk += delta;
        this.timeSinceHappy += delta;
        this.timeSinceUpdatedHappiness += delta;

        if (this._billboardTimer !== undefined) {
            this._billboardTimer -= delta;

            if (this._billboardTimer <= 0) {
                this.happinessSprite.visible = false;
                this._billboardTimer = undefined;
            }
        }
    }

    randomTransitionCondition(timer, gap, threshold) {
        return Math.round(timer) >= gap && Math.round(timer) % gap == 0 && Math.random() < threshold;
    }

    onAnimationFinished() {
        switch (this.asm.current) {
            case HAPPY:
                console.log(this.danceCount);
                if (++this.danceCount >= 1) {
                    this.asm.transitionTo(IDLE);
                    this.danceCount = 0;
                    this.timeSinceHappy = 0;
                }
                break;
            case HATE:
                this.asm.transitionTo(IDLE);
            default:
                break;
        }
    }

    updateHappiness(deltaTime) {
        let delta = 0;
        // warmth
        const warmDist = Math.abs(globalWarmth - this.preferredWarmth);
        // warmDist = 0     -> +0.3
        // warmDist < 0.3   -> 0
        // warmDist > 0.3   -> negative
        delta += (0.3 - warmDist) * deltaTime;

        this.updateHappinessValue(delta);
        console.log(delta);
        if (Math.abs(delta) > 0.1 * deltaTime) {
            if (delta > 0) {
                this.asm.transitionTo(HAPPY);
            } else if (delta < 0) {
                this.asm.transitionTo(HATE);
            }
        }
    }

    update(deltaTime) {
        this.updateTimers(deltaTime);
        if (this.timeSinceUpdatedHappiness > 10) {
            this.updateHappiness(deltaTime);
            this.timeSinceUpdatedHappiness = 0;
        }


        switch (this.asm.current) {
            case IDLE:
                if (this.target_position && this.position !== this.target_position) {
                    this.asm.transitionTo(WALK, this.running ? 0.25 : 0.5);
                } else if (this.timeSinceRandWalk > 5 && this.randomTransitionCondition(this.timeSinceRandWalk, 3, 0.15)) {
                    this.walkToPos(selectPosInRadius(this.position, MAX_DISTANCE));
                } else if (this.happiness >= MAX_HAPPINESS * 0.85 && this.randomTransitionCondition(this.timeSinceHappy, 10, 0.3)) {
                    this.asm.transitionTo(HAPPY);
                } 
                break;
            case WALK:
                if (this.target_position && this.position.distanceTo(this.target_position) < 0.1) {
                    this.position = this.target_position;
                    this.target_position = null;
                    this.asm.transitionTo(IDLE);
                } else if (this.target_position) {
                    this.move((this.running ? RUN_SPEED : WALK_SPEED) * deltaTime);
                    this.timeSinceRandWalk = 0;
                }
                break;
            case HAPPY:
                break;
            case HATE:
                break;
            case DAMAGE:
                break;
            case TACKLE:
                break;
            case SPECIAL:
                break;
            default:
                console.log("Unknown state: " + this.asm.current);
        }
    }
}

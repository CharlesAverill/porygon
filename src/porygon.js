import * as THREE from 'three';
import { clamp } from 'three/src/math/MathUtils.js';
import { AnimationStateMachine, IDLE, WALK, HAPPY, HATE, DAMAGE, TACKLE, SPECIAL } from './states.js';

const [MIN_HAPPINESS, MAX_HAPPINESS] = [0, 100];
const [MIN_HEALTH, MAX_HEALTH] = [0, 100];

function selectPosInRadius(origin, radius) {
    let theta = 2 * Math.PI * Math.random();
    let r = radius * Math.sqrt(Math.random());
    return new THREE.Vector3(origin.x + r * Math.cos(theta), origin.y, origin.z + r * Math.sin(theta));
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

    constructor(model, mixer, actions) {
        this.happiness = 50;
        this.position = new THREE.Vector3(0, 0, 0);
        this.target_position = null;
        this.health = 100;
        this.model = model;
        this.asm = new AnimationStateMachine(mixer, actions, IDLE);
        this.running = false;
        this.timeSinceRandWalk = 0;
    }

    updateHappiness(delta) {
        this.happiness = clamp(this.happiness + delta, MIN_HAPPINESS, MAX_HAPPINESS);
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
        console.log("Clicked!");
    }

    updateTimers(delta) {
        this.timeSinceRandWalk += delta;
    }

    update(deltaTime) {
        this.updateTimers(deltaTime);

        switch(this.asm.current) {
            case IDLE:
                if (this.target_position && this.position !== this.target_position) {
                    this.asm.transitionTo(WALK, this.running ? 0.25 : 0.5);
                } else if (this.timeSinceRandWalk > 5 && Math.round(this.timeSinceRandWalk) % 3 == 0 && Math.random() < 0.15) {
                    this.walkToPos(selectPosInRadius(this.position, MAX_DISTANCE));
                }
                break;
            case WALK:
                if(this.target_position && this.position.distanceTo(this.target_position) < 0.1) {
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

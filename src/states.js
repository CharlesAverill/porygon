export const [IDLE, WALK, HAPPY, HATE, DAMAGE, TACKLE, SPECIAL] =
    ["idle", "walk", "happy", "hate", "damage", "tackle", "special"];

export const transitions = {
    [IDLE]: [IDLE, WALK, HATE, HAPPY, DAMAGE, TACKLE],
    [WALK]: [WALK, IDLE],
    [HAPPY]: [HAPPY, IDLE],
    [HATE]: [IDLE],
    [DAMAGE]: [IDLE],
    [TACKLE]: [IDLE],
};

export class AnimationStateMachine {
    constructor(mixer, actions, defaultAction) {
        this.mixer = mixer;
        this.actions = actions;
        this.current = defaultAction;
    }

    canTransitionTo(next) {
        if (!this.current) return true;
        return transitions[this.current]?.includes(next);
    }

    transitionTo(next, fade = 0.3) {
        if (!this.canTransitionTo(next)) return;

        const nextAction = this.actions[next];
        if (!nextAction) {
            console.warn(`No animation named "${next}"`);
            return;
        }

        const prevAction = this.actions[this.current];
        if (prevAction && prevAction !== nextAction) {
            prevAction.crossFadeTo(nextAction.reset().play(), fade, false);
        } else {
            nextAction.reset().play();
        }

        this.current = next;
    }

    update(delta) {
        this.mixer.update(delta);
    }
}

export const AnimationState = {
  IDLE: 'Idle',
  WALK: 'Walk',
  RUN: 'Run',
  ATTACK: 'Attack',
  HURT: 'Hurt',
};

export const transitions = {
  [AnimationState.IDLE]: [AnimationState.WALK, AnimationState.ATTACK],
  [AnimationState.WALK]: [AnimationState.IDLE, AnimationState.RUN],
  [AnimationState.RUN]: [AnimationState.WALK],
  [AnimationState.ATTACK]: [AnimationState.IDLE],
  [AnimationState.HURT]: [AnimationState.IDLE],
};

export class AnimationStateMachine {
  constructor(mixer, actions) {
    this.mixer = mixer;
    this.actions = actions;
    this.current = null;
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

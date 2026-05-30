import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_CONFIG, useStore, replaceStop } from './store';

function reset() {
  // Przywróć czysty config (deep clone, by testy się nie zazębiały).
  useStore.setState({
    config: structuredClone(DEFAULT_CONFIG),
    loadedModel: null,
    modelSize: [1, 1.4, 1],
    cameraApi: null,
  });
}

describe('DEFAULT_CONFIG', () => {
  it('domyślny tone mapping to NEUTRAL', () => {
    expect(DEFAULT_CONFIG.tone.mode).toBe('NEUTRAL');
  });

  it('ma 5 presetów kamery', () => {
    expect(Object.keys(DEFAULT_CONFIG.camera.presets).sort()).toEqual(
      ['detail', 'front', 'hero', 'side', 'top']
    );
  });
});

describe('replaceStop', () => {
  it('podmienia jeden stop bez mutacji wejścia', () => {
    const input: [string, string, string, string] = ['a', 'b', 'c', 'd'];
    const out = replaceStop(input, 2, 'X');
    expect(out).toEqual(['a', 'b', 'X', 'd']);
    expect(input).toEqual(['a', 'b', 'c', 'd']); // brak mutacji
    expect(out).not.toBe(input);
  });
});

describe('store setters', () => {
  beforeEach(reset);

  it('setKeyLight robi merge, nie nadpisuje całej sekcji', () => {
    useStore.getState().setKeyLight({ intensity: 1 });
    const kl = useStore.getState().config.keyLight;
    expect(kl.intensity).toBe(1);
    expect(kl.position).toEqual(DEFAULT_CONFIG.keyLight.position);
  });

  it('setOrbit zmienia tylko wskazane pole orbity', () => {
    useStore.getState().setOrbit({ minDist: 2 });
    const orbit = useStore.getState().config.camera.orbit;
    expect(orbit.minDist).toBe(2);
    expect(orbit.maxDist).toBe(DEFAULT_CONFIG.camera.orbit.maxDist);
  });

  it('capturePreset nadpisuje wskazany preset', () => {
    useStore.getState().capturePreset('hero', {
      position: [1, 2, 3],
      target: [0, 0, 0],
      fov: 35,
    });
    expect(useStore.getState().config.camera.presets.hero).toEqual({
      position: [1, 2, 3],
      target: [0, 0, 0],
      fov: 35,
    });
    // inne presety nietknięte
    expect(useStore.getState().config.camera.presets.front).toEqual(
      DEFAULT_CONFIG.camera.presets.front
    );
  });

  it('setBackground podmienia stops jako nową tablicę', () => {
    const next: [string, string, string, string] = ['#000', '#111', '#222', '#333'];
    useStore.getState().setBackground({ stops: next });
    expect(useStore.getState().config.background.stops).toEqual(next);
  });
});

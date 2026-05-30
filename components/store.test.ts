import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_CONFIG, useStore, replaceStop } from './store';

function reset() {
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

  it('ma 5 kamer w domyślnej kolejności', () => {
    expect(DEFAULT_CONFIG.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'front',
      'side',
      'top',
      'detail',
    ]);
  });

  it('każda kamera ma name i showInFinalBar=true', () => {
    for (const c of DEFAULT_CONFIG.camera.cameras) {
      expect(typeof c.name).toBe('string');
      expect(c.showInFinalBar).toBe(true);
    }
  });
});

describe('replaceStop', () => {
  it('podmienia jeden stop bez mutacji wejścia', () => {
    const input: [string, string, string, string] = ['a', 'b', 'c', 'd'];
    const out = replaceStop(input, 2, 'X');
    expect(out).toEqual(['a', 'b', 'X', 'd']);
    expect(input).toEqual(['a', 'b', 'c', 'd']);
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

  it('setBackground podmienia stops jako nową tablicę', () => {
    const next: [string, string, string, string] = ['#000', '#111', '#222', '#333'];
    useStore.getState().setBackground({ stops: next });
    expect(useStore.getState().config.background.stops).toEqual(next);
  });
});

describe('camera operations', () => {
  beforeEach(reset);

  it('updateCamera(id, patch) aktualizuje wskazaną kamerę po id', () => {
    useStore.getState().updateCamera('hero', { position: [1, 2, 3], fov: 50 });
    const hero = useStore.getState().config.camera.cameras.find((c) => c.id === 'hero')!;
    expect(hero.position).toEqual([1, 2, 3]);
    expect(hero.fov).toBe(50);
    expect(hero.target).toEqual(DEFAULT_CONFIG.camera.cameras[0].target);
  });

  it('renameCamera zmienia name', () => {
    useStore.getState().renameCamera('hero', 'Bohater');
    const hero = useStore.getState().config.camera.cameras.find((c) => c.id === 'hero')!;
    expect(hero.name).toBe('Bohater');
  });

  it('setCameraVisible przełącza showInFinalBar', () => {
    useStore.getState().setCameraVisible('hero', false);
    const hero = useStore.getState().config.camera.cameras.find((c) => c.id === 'hero')!;
    expect(hero.showInFinalBar).toBe(false);
  });

  it('moveCamera up przesuwa kamerę o jedno miejsce w górę', () => {
    useStore.getState().moveCamera('side', 'up');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'side',
      'front',
      'top',
      'detail',
    ]);
  });

  it('moveCamera down przesuwa o jedno w dół', () => {
    useStore.getState().moveCamera('front', 'down');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'side',
      'front',
      'top',
      'detail',
    ]);
  });

  it('moveCamera na krawędzi nic nie zmienia', () => {
    useStore.getState().moveCamera('hero', 'up');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'front',
      'side',
      'top',
      'detail',
    ]);
    useStore.getState().moveCamera('detail', 'down');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'hero',
      'front',
      'side',
      'top',
      'detail',
    ]);
  });

  it('addCamera dodaje nową kamerę z unikalnym id i widoczną w finalnym pasku', () => {
    const before = useStore.getState().config.camera.cameras.length;
    useStore.getState().addCamera();
    const after = useStore.getState().config.camera.cameras;
    expect(after.length).toBe(before + 1);
    const last = after[after.length - 1];
    expect(last.id).toMatch(/^cam_/);
    expect(last.showInFinalBar).toBe(true);
    expect(typeof last.name).toBe('string');
  });

  it('removeCamera usuwa kamerę i nie usuwa ostatniej', () => {
    useStore.getState().removeCamera('hero');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual([
      'front',
      'side',
      'top',
      'detail',
    ]);
    // usuń aż do jednej
    useStore.getState().removeCamera('front');
    useStore.getState().removeCamera('side');
    useStore.getState().removeCamera('top');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual(['detail']);
    // ostatnia — no-op
    useStore.getState().removeCamera('detail');
    expect(useStore.getState().config.camera.cameras.map((c) => c.id)).toEqual(['detail']);
  });

  it('removeCamera aktywnej przełącza active na pierwszą pozostałą', () => {
    useStore.getState().setCamera({ active: 'side' });
    useStore.getState().removeCamera('side');
    expect(useStore.getState().config.camera.active).toBe('hero');
  });

  it('capturePreset aktualizuje pozycję/target/fov kamery po id', () => {
    useStore.getState().capturePreset('hero', {
      position: [1, 2, 3],
      target: [0, 0, 0],
      fov: 35,
    });
    const hero = useStore.getState().config.camera.cameras.find((c) => c.id === 'hero')!;
    expect(hero.position).toEqual([1, 2, 3]);
    expect(hero.target).toEqual([0, 0, 0]);
    expect(hero.fov).toBe(35);
  });
});

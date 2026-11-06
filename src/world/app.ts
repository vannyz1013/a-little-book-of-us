import * as THREE from 'three';
import { createLightbox } from '../components/Lightbox';
import { createMusicPlayer } from '../components/MusicPlayer';
import type { Memory } from '../data/birthdayContent';
import { goTo, onRoute, type PageId } from '../router';
import { Director } from './core/director';
import { Engine } from './core/engine';
import { Interaction } from './core/interaction';
import { rendererName } from './core/quality';
import { softDot } from './core/textures';
import { easeSoft } from './core/tween';
import { Atmosphere } from './env/lighting';
import { createCursorMagic } from './env/cursorMagic';
import { createParticles } from './env/particles';
import { createSky } from './env/sky';
import { createTerrain } from './env/terrain';
import { startWind } from './env/vegetation';
import { ORDER, sceneState } from './layout';
import type { PhotoFrame } from './objects/photoFrame';
import { createBeginning } from './scenes/beginning';
import { createBirthdayGarden } from './scenes/birthdayGarden';
import type { WorldContext } from './scenes/context';
import { createMemoryGarden } from './scenes/memoryGarden';
import { createHud } from './ui/hud';
import { createLetterPanel } from './ui/panels';
import { BirthdayCinematicUI, type SurpriseMode } from './ui/birthdayCinematic';

async function loadFonts(): Promise<void> {
  // Canvas text is drawn only once, so the fonts must be ready first.
  await Promise.allSettled([
    document.fonts.load('600 64px "Cormorant Garamond"'),
    document.fonts.load('italic 500 64px "Cormorant Garamond"'),
    document.fonts.load('500 64px Caveat'),
    document.fonts.load('600 30px Nunito'),
  ]);
}

export async function startWorld(root: HTMLElement): Promise<void> {
  const shell = document.createElement('div');
  shell.className = 'world';
  const stage = document.createElement('div');
  stage.className = 'world-stage';
  const loading = document.createElement('p');
  loading.className = 'world-loading';
  loading.textContent = 'A Little Book for You';
  shell.append(stage, loading);
  root.append(shell);

  const engine = new Engine(stage);
  const director = new Director(engine);
  const interaction = new Interaction(engine, director, engine.renderer.domElement);
  const atmosphere = new Atmosphere(engine, director);
  createSky(engine, atmosphere);
  createTerrain(engine);
  startWind(engine);
  const particles = createParticles(engine, interaction);
  const magic = createCursorMagic(engine, director, interaction);

  await loadFonts();
  const context: WorldContext = {
    engine,
    director,
    interaction,
    dot: softDot(engine),
  };

  const music = createMusicPlayer();
  // The soft opening theme starts on the visitor's first tap or key press, anywhere.
  music.listenForFirstGesture();
  const lightbox = createLightbox('Back to the garden');
  let reading = false;
  const setReading = (value: boolean): void => {
    reading = value;
    // While a letter or a photo is open, the scene's own controls step back.
    shell.classList.toggle('is-reading', value);
    interaction.blocked = value;
    engine.dimmed = value;
    if (value) interaction.reset();
    refreshCandleHint();
  };

  // ---- Birthday scene state ----
  let letterState: 'waiting' | 'lit' | 'opening' | 'opened' = 'waiting';
  let surpriseMode: SurpriseMode = 'hidden';
  /** Set once the birthday scene exists, before which nothing here can be asked about it. */
  let birthdayReady = false;

  /**
   * "Tap the candle" is shown only while it can be acted on: resting in the birthday garden
   * (not flying past the other scenes on the way), the candle still unlit, no surprise
   * playing and nothing open over the scene.
   */
  const refreshCandleHint = (): void => {
    if (!birthdayReady) return;
    hud.candleHint.hidden = !(
      director.current === 'letter' &&
      !director.flying &&
      !birthday.candle.lit &&
      surpriseMode === 'hidden' &&
      !reading
    );
  };

  const refreshLetterHud = (): void => {
    refreshCandleHint();
    hud.openLetter.hidden = letterState !== 'lit' && letterState !== 'opened';
    hud.openLetter.textContent = letterState === 'opened' ? 'Read Your Letter' : 'Open Your Letter';
    hud.openLetter.disabled = false;
    // Until the letter is out, tall screens keep the music controls up in the sky, off the pair.
    hud.musicSlots.letter.closest('.hud')?.classList.toggle('is-letter-opened', letterState === 'opened');
    hud.setActions(interaction.items.filter((item) => item.page === director.current));
  };

  const lightCandle = async (): Promise<void> => {
    if (birthday.candle.lit) return;
    // Still inside the tap, so the browser lets the birthday song begin.
    music.celebrate();
    const glowing = birthday.candle.ignite((warmth) => {
      atmosphere.warmth = warmth;
      particles.warmth.value = warmth;
      birthday.swarm.excited.value = Math.sin(warmth * Math.PI) * 0.9 + warmth * 0.1;
      birthday.gazebo.lightUp(easeSoft(Math.min(warmth * 1.6, 1)));
      birthday.cake.warm(warmth);
    });
    refreshCandleHint(); // The candle counts as lit from the tap.
    // A few sparkles drift up around the cake as its warmth spreads.
    magic.rise(birthday.cakeCentre.clone().setY(birthday.cakeCentre.y - 1.4), 2.4, 2.6, 16, 2.4);
    await engine.tweens.wait(1.1);
    letterState = 'lit';
    await birthday.envelope.reveal();
    refreshLetterHud();
    await glowing;
  };

  const openEnvelope = async (): Promise<void> => {
    if (letterState === 'opened') {
      letterPanel.open();
      setReading(true);
      return;
    }
    if (letterState !== 'lit') return;
    letterState = 'opening';
    hud.openLetter.disabled = true;
    // This click is what browsers require before they will allow sound.
    music.unlock();
    await birthday.envelope.open();
    letterState = 'opened';
    music.begin();
    if (director.current === 'letter') {
      refreshLetterHud();
      letterPanel.open();
      setReading(true);
    }
  };

  const letterPanel = createLetterPanel(music.element, () => {
    setReading(false);
    placeMusic();
    // Back at the cake, the letter stays out of its envelope, unfolded on the stand.
    if (letterState === 'opened' && !birthday.envelope.unfolded) {
      sceneState.letterOpen = true;
      birthday.layout(true);
      void director.reframe();
      void birthday.envelope.unfold();
    }
  });

  const chooseMemory = async (memory: Memory, frame: PhotoFrame): Promise<void> => {
    setReading(true);
    await director.closeUp(frame.standpoint(6.4), frame.centre());
    lightbox.open(memory);
  };
  lightbox.element.addEventListener('close', () => {
    setReading(false);
    void director.backOut();
  });

  // ---- Scene 1 ----
  let opening = false;
  let arrivingFromBook = false;
  const openBook = async (): Promise<void> => {
    if (opening || director.flying) return;
    opening = true;
    hud.openBook.disabled = true;
    interaction.reset();
    const pageCentre = new THREE.Vector3();
    await beginning.book.open();
    beginning.book.pageCentre(pageCentre);
    const inside = pageCentre.clone().add(new THREE.Vector3(0, 0.05, 2.4));
    void beginning.book.pageGlow(1.1);
    // Soft light and a few sparkles rise from the open pages.
    magic.burst(pageCentre, 12, 0.9);
    await director.closeUp(inside, pageCentre, 1.3);
    arrivingFromBook = true;
    await veil(1, 0.32);
    goTo('memories');
  };

  const veil = (value: number, seconds: number): Promise<void> => {
    hud.veil.style.transitionDuration = engine.reducedMotion ? '0ms' : `${seconds}s`;
    hud.veil.classList.toggle('is-on', value > 0);
    return engine.tweens.wait(seconds);
  };

  const hud = createHud(shell, () => void openBook(), () => void openEnvelope());
  /** The music controls sit in the current scene, once there is music to control. */
  const placeMusic = (id: PageId = director.current): void => {
    if (letterPanel.element.open) return; // The letter keeps them while it is open.
    hud.musicSlots[id].append(music.element);
  };
  const showMusic = (): void => {
    for (const slot of Object.values(hud.musicSlots)) slot.hidden = !music.started;
  };
  music.onChange(showMusic);
  shell.append(lightbox.element);

  const cinematic = new BirthdayCinematicUI(shell, (mode) => {
    surpriseMode = mode;
    refreshCandleHint();
    // Opening the gift moves to the birthday song too (once; a replay keeps it going).
    if (mode === 'playing') music.celebrate();
    const active = mode !== 'hidden';
    interaction.blocked = active;
    if (active) interaction.reset();
    else if (director.current === 'letter') hud.setActions(interaction.items.filter((item) => item.page === director.current));
  });

  const beginning = await createBeginning(context, () => void openBook());
  const garden = await createMemoryGarden(context, (memory, frame) => void chooseMemory(memory, frame));
  const birthday = createBirthdayGarden(context, () => void lightCandle(), () => void openEnvelope(), () => hud.letterBounds(), cinematic);
  birthdayReady = true;
  cinematic.skip.addEventListener('click', () => birthday.surprise.skip());
  cinematic.replay.addEventListener('click', () => birthday.surprise.replay());
  cinematic.back.addEventListener('click', () => birthday.surprise.backToCake());
  shell.append(letterPanel.element);

  // Only the places near the camera are drawn at all.
  const groups: Record<PageId, THREE.Object3D> = {
    home: beginning.group,
    memories: garden.group,
    letter: birthday.group,
  };
  engine.add(() => {
    for (const id of ORDER) groups[id].visible = Math.abs(director.progress - director.stopOf(id)) < 0.34;
  });

  const arrive = (id: PageId): void => {
    hud.show(id);
    placeMusic(id);
    if (id === 'letter') {
      music.prepare();
      refreshLetterHud();
      // The hint waits until the camera has landed in the garden.
      void director.arrived().then(refreshCandleHint);
      // The screen may have turned while elsewhere: refit once the camera has arrived.
      if (sceneState.letterOpen) {
        void director.arrived().then(() => {
          if (director.current === 'letter') birthday.layout();
        });
      }
    } else {
      hud.setActions(interaction.items.filter((item) => item.page === id));
      refreshCandleHint();
    }
  };

  let first = true;
  onRoute((id) => {
    if (id === director.current && !first) return;
    if (birthday.surprise.state !== 'hidden') birthday.surprise.backToCake(0);
    for (const dialogElement of shell.querySelectorAll('dialog')) {
      if (dialogElement.open) dialogElement.close();
    }

    if (first) {
      first = false;
      director.jump(id);
      arrive(id);
      return;
    }

    if (id === 'home') {
      opening = false;
      hud.openBook.disabled = false;
      void director.flyTo('home').then(() => beginning.book.close());
      beginning.book.close();
    } else if (arrivingFromBook) {
      arrivingFromBook = false;
      director.startFrom(0.19, id);
      void director.flyTo(id, 2.8);
      void veil(0, 0.7);
      beginning.book.close();
      opening = false;
      hud.openBook.disabled = false;
    } else {
      void director.flyTo(id);
    }
    arrive(id);
    hud.focusHeading(id);
  });

  if (new URLSearchParams(location.search).has('qa')) {
    (window as unknown as Record<string, unknown>).__world = {
      state: () => ({
        page: director.current,
        flying: director.flying,
        progress: director.progress,
        reading,
        letterState,
        envelopeOpened: birthday.envelope.opened,
        letterUnfolded: birthday.envelope.unfolded,
        candleLit: birthday.candle.lit,
        surprise: birthday.surprise.state,
        surpriseCharactersVisible: birthday.surprise.characters.visible,
        surpriseGiftVisible: birthday.gift.root.visible,
        warmth: atmosphere.warmth,
        tier: engine.tier.name,
        density: engine.tier.density,
        shadowMap: engine.tier.shadows,
        pixelRatio: engine.renderer.getPixelRatio(),
        renderer: rendererName(engine.renderer.getContext() as WebGL2RenderingContext),
        calls: engine.drawCalls,
        triangles: engine.triangles,
        averageFrame: engine.averageFrame(),
        qualitySteps: engine.qualitySteps(),
        geometries: engine.renderer.info.memory.geometries,
        textures: engine.renderer.info.memory.textures,
        interactables: interaction.items.length,
      }),
      project: (id: string) => interaction.project(id),
      characters: () => ({
        visible: birthday.surprise.characters.visible,
        roots: birthday.surprise.characters.children.map((root, index) => ({
          role: index === 0 ? 'Mun Yi' : 'Zi Nor',
          visible: root.visible,
          position: root.position.toArray(),
          yaw: root.rotation.y,
        })),
      }),
      characterShadows: (enabled: boolean) => birthday.surprise.characters.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) (object as THREE.Mesh).castShadow = enabled;
      }),
      characterVisibility: (visible: boolean) => { birthday.surprise.characters.visible = visible; },
      playSurprise: () => birthday.surprise.begin(),
      skipSurprise: () => birthday.surprise.skip(),
      replaySurprise: () => birthday.surprise.replay(),
      backToCake: () => birthday.surprise.backToCake(0),
      magic: () => magic.stats(),
      letterRect: () => ({ ...birthday.onScreen(), bounds: hud.letterBounds(), fit: sceneState.fit }),
      /** Triangles per visible mesh (one camera pass, before shadows), largest first. */
      breakdown: () => {
        const rows: { name: string; triangles: number; instances: number; shadow: boolean }[] = [];
        engine.scene.traverseVisible((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          const g = mesh.geometry;
          const perCopy = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
          const instances = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
          let name = mesh.name;
          for (let p: THREE.Object3D | null = mesh; !name && p; p = p.parent) name = p.name;
          rows.push({ name: name || g.type, triangles: perCopy * instances, instances, shadow: mesh.castShadow });
        });
        return rows.sort((a, b) => b.triangles - a.triangles);
      },
    };
  }

  engine.renderer.domElement.addEventListener('webglcontextlost', (event) => {
    // If the GPU gives up, fall back to the flat book rather than a blank page.
    event.preventDefault();
    engine.dispose();
    location.replace(`${location.pathname}?flat${location.hash}`);
  });

  // Compile before showing, so the first flight has no stutter.
  await engine.renderer.compileAsync(engine.scene, engine.camera);
  engine.start();
  requestAnimationFrame(() => {
    loading.classList.add('is-done');
    window.setTimeout(() => loading.remove(), 900);
  });
}

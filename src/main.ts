import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/caveat/latin-500.css';
import './styles/global.css';
import './styles/nav.css';
import './styles/cover.css';
import './styles/scrapbook.css';
import './styles/letter.css';
import './styles/animations.css';
import './styles/world.css';

function canRenderWorld(): boolean {
  if (new URLSearchParams(location.search).has('flat')) return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

async function startFlat(root: HTMLElement): Promise<void> {
  root.replaceChildren();
  const { startFlatBook } = await import('./flatBook');
  startFlatBook(root);
}

async function start(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app')!;
  // A review stage for the two characters, loaded only when asked for.
  if (new URLSearchParams(location.search).has('characters') && canRenderWorld()) {
    const { startCharacterPreview } = await import('./world/characterPreview');
    return startCharacterPreview(root);
  }
  if (!canRenderWorld()) return startFlat(root);
  try {
    // Three.js loads only here, so the flat book never pays for it.
    const { startWorld } = await import('./world/app');
    await startWorld(root);
  } catch (error) {
    console.warn('Falling back to the flat book:', error);
    await startFlat(root);
  }
}

void start();

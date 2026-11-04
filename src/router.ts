export const pages = ['home', 'memories', 'letter'] as const;
export type PageId = (typeof pages)[number];

export const pageTitles: Record<PageId, string> = {
  home: 'Home',
  memories: 'Our Memories',
  letter: 'Birthday Letter',
};

const fromHash = (): PageId => {
  const id = location.hash.replace(/^#\/?/, '');
  return (pages as readonly string[]).includes(id) ? (id as PageId) : 'home';
};

export const hrefFor = (id: PageId): string => (id === 'home' ? '#/' : `#/${id}`);

export const goTo = (id: PageId): void => {
  location.hash = hrefFor(id);
};

/** Hash routing needs no server rules, so refreshing works on GitHub Pages. */
export function onRoute(listener: (id: PageId) => void): void {
  window.addEventListener('hashchange', () => listener(fromHash()));
  listener(fromHash());
}

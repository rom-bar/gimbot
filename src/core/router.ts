export type Route =
  | { type: 'home' }
  | { type: 'about' }
  | { type: 'game'; id: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'about') return { type: 'about' };
  if (parts[0] === 'play' && parts[1]) return { type: 'game', id: decodeURIComponent(parts[1]) };
  return { type: 'home' };
}

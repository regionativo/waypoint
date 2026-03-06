import { get, set } from './storage.js';

export const THEMES = [
  { id: 'default', name: 'Clean', description: 'Light and minimal with soft shadows' },
  { id: 'forge', name: 'Forge', description: 'Neo-brutalist with hard edges and offset shadows' },
  { id: 'cinco', name: 'Cinco de Mayo', description: 'Festive vibes with warm, vibrant Mexican colors' },
];

export async function getTheme() {
  const { theme = 'default' } = await get('theme');
  return theme;
}

export async function setTheme(themeId) {
  await set({ theme: themeId });
  applyTheme(themeId);
}

export function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
}

export async function loadTheme() {
  const theme = await getTheme();
  applyTheme(theme);
}

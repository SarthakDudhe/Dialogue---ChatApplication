/**
 * Room Theme Manager
 * Manages per-channel custom wallpapers, background gradients, and accent themes.
 */

export const ROOM_THEMES = [
  {
    id: 'smoke-white',
    name: 'Smoke White (Default)',
    bgClass: 'bg-[#F5F5F0]',
    borderClass: 'border-[#E8E8E2]',
    headerBg: 'bg-[#F5F5F0]',
    preview: '#F5F5F0'
  },
  {
    id: 'ink-blue',
    name: 'Ink Blue Glass',
    bgClass: 'bg-gradient-to-br from-[#1C2B3A] via-[#14202C] to-[#0A121A]',
    borderClass: 'border-white/10',
    headerBg: 'bg-[#14202C]',
    preview: '#1C2B3A'
  },
  {
    id: 'deep-emerald',
    name: 'Deep Emerald',
    bgClass: 'bg-gradient-to-br from-[#064E3B] via-[#022C22] to-[#011B14]',
    borderClass: 'border-emerald-500/20',
    headerBg: 'bg-[#022C22]',
    preview: '#064E3B'
  },
  {
    id: 'midnight-dark',
    name: 'Midnight Onyx',
    bgClass: 'bg-[#0F0F0F]',
    borderClass: 'border-white/10',
    headerBg: 'bg-[#141414]',
    preview: '#0F0F0F'
  }
];

export function getRoomTheme(roomId) {
  if (!roomId) return ROOM_THEMES[0];
  const themeId = localStorage.getItem("room_theme_" + roomId);
  return ROOM_THEMES.find((t) => t.id === themeId) || ROOM_THEMES[0];
}

export function setRoomTheme(roomId, themeId) {
  if (!roomId) return;
  localStorage.setItem("room_theme_" + roomId, themeId);
}

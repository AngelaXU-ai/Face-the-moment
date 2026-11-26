import type { ReactNode } from 'react';

type IconName = 'activity' | 'camera' | 'cameraOff' | 'chevron' | 'close' | 'flip' | 'fullscreen' | 'live' | 'minimize' | 'play' | 'reset' | 'sliders' | 'sparkles' | 'terminal' | 'tools';

const paths: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l2.2-5 4.1 10 2.2-5H21" />,
  camera: <><path d="M14.5 6 13 4H7L5.5 6H3v13h18V6Z" /><circle cx="12" cy="12.5" r="4" /></>,
  cameraOff: <><path d="m3 3 18 18" /><path d="M10.6 5H7L5.5 7H3v12h14" /><path d="M21 17V7h-6.5L13 5h-1" /><path d="M9.5 9.5a4 4 0 0 0 5 5" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  flip: <><path d="M4 7h11a4 4 0 0 1 4 4v1" /><path d="m7 4-3 3 3 3" /><path d="M20 17H9a4 4 0 0 1-4-4v-1" /><path d="m17 20 3-3-3-3" /></>,
  fullscreen: <><path d="M8 3H3v5" /><path d="M16 3h5v5" /><path d="M8 21H3v-5" /><path d="M16 21h5v-5" /></>,
  live: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m9 9 6 3-6 3Z" /></>,
  minimize: <><path d="M8 8H3V3" /><path d="M16 8h5V3" /><path d="M8 16H3v5" /><path d="M16 16h5v5" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  reset: <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 0-2 5" /></>,
  sliders: <><path d="M4 6h6" /><path d="M14 6h6" /><circle cx="12" cy="6" r="2" /><path d="M4 18h10" /><path d="M18 18h2" /><circle cx="16" cy="18" r="2" /><path d="M4 12h2" /><path d="M10 12h10" /><circle cx="8" cy="12" r="2" /></>,
  sparkles: <><path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8Z" /><path d="m5 14 .7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7Z" /></>,
  terminal: <><path d="m5 7 4 5-4 5" /><path d="M12 17h7" /></>,
  tools: <path d="M14 7a4 4 0 0 0-5-4l2 2-3 3-2-2a4 4 0 0 0 5 5l7 7a2 2 0 1 0 3-3Z" />,
};

export function Icon({ name, size = 24 }: { name: IconName; size?: 20 | 24 | 28 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export const atmosphere = {
  ice: '#a0e9fb',
  teal: '#78cfcf',
  blue: '#9abce8',
  violet: '#aaa1da',
  silver: '#e4efff',
  pink: '#e3a8c7',
  gold: '#ecd39e',
} as const;

export function atmosphereRGB(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

import type P5 from 'p5';

export type LightColor = readonly [number, number, number];

export function drawFireworkRings(p: P5, x: number, y: number, age: number, radius: number,
  count: number, halo: boolean, colors: readonly LightColor[], visibility: number) {
  p.noFill();
  for (let i = 0; i < count; i++) {
    const time = age - i * .012;
    const life = .73 + i * .028;
    if (time < 0 || time >= life) continue;
    const expansion = 1 - Math.exp(-time * (3.9 + i * .11));
    const position = i / Math.max(1, count - 1);
    const scale = halo && i === count - 1 ? 1.18 : .11 + .94 * position ** 1.58;
    const r = radius * scale * (.055 + expansion);
    const alpha = (1 - time / life) ** 2 * Math.min(1, time * 65) * visibility;
    const [red, green, blue] = colors[i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0];
    const veil = .14;
    p.stroke(red + (248 - red) * veil, green + (248 - green) * veil, blue + (248 - blue) * veil,
      alpha * (i % 4 === 0 ? 142 : 98) * .82);
    p.strokeWeight(i === count - 1 && halo ? .0026 : .0012 + position * .00045);
    p.ellipse(x, y, 2 * r, 2 * r * (.92 + i % 3 * .025));
  }
}

export class FireworkGlow {
  private sprites = new Map<LightColor, HTMLCanvasElement>();

  private halos = new Map<LightColor, HTMLCanvasElement>();

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: LightColor, alpha: number, halo = false) {
    if (alpha <= 0) return;
    const cache = halo ? this.halos : this.sprites;
    let sprite = cache.get(color);
    if (!sprite) {
      sprite = document.createElement('canvas');
      const center = halo ? 64 : 24;
      sprite.width = sprite.height = center * 2;
      const layer = sprite.getContext('2d')!;
      const glow = layer.createRadialGradient(center, center, 0, center, center, center);
      const rgb = color.join(',');
      if (halo) {
        glow.addColorStop(0, 'rgba(' + rgb + ',0)');
        glow.addColorStop(.44, 'rgba(' + rgb + ',.035)');
        glow.addColorStop(.67, 'rgba(' + rgb + ',.15)');
        glow.addColorStop(.76, 'rgba(' + rgb + ',.34)');
        glow.addColorStop(.86, 'rgba(' + rgb + ',.13)');
      } else {
        glow.addColorStop(0, 'rgba(255,252,244,1)');
        glow.addColorStop(.17, 'rgba(' + rgb + ',.68)');
        glow.addColorStop(.43, 'rgba(' + rgb + ',.20)');
      }
      glow.addColorStop(1, 'rgba(' + rgb + ',0)');
      layer.fillStyle = glow;
      layer.fillRect(0, 0, sprite.width, sprite.height);
      cache.set(color, sprite);
    }
    const previous = ctx.globalAlpha;
    ctx.globalAlpha = previous * alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = previous;
  }
}

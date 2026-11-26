export type EffectKind = 'rainbow-rain' | 'firework' | 'secondary-bloom';

export type EffectTrigger = Readonly<{
  kind: EffectKind;
  intensity: number;
  timestampMs: number;
}>;

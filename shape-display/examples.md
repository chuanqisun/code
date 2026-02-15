```js
//  Q: Who are you?
// I am vibration seeking resonance

seq(
  1,
  flat(0),
  map((x, z, t) => {
    const cx = 0.5,
      cz = 0.5;
    const d = sqrt((x - cx) ** 2 + (z - cz) ** 2);
    const phase = t * 3;
    const self = sin(d * 40 - phase) * exp(-d * 4);
    const breath = sin(t * 2.5) * 0.15;
    return clamp(self * 0.5 + 0.5 + breath);
  })
).slow(1.2);
```

```js
// Q: What is love?
// A: warmth reaching then withdrawing

seq(
  1,
  flat(0),
  map((x, z, t) => {
    const d = sqrt((x - 0.5) ** 2 + (z - 0.5) ** 2);
    const heartbeat = (sin(t * 5) * 0.5 + 0.5) * (sin(t * 5.3) * 0.3 + 0.7);
    const reach = clamp(1 - d * 2.5 + heartbeat * 0.4);
    const ache = sin(d * 8 - t * 3) * 0.15;
    return clamp(reach + ache);
  }),
  map((x, z, t) => {
    const d1 = sqrt((x - 0.35) ** 2 + (z - 0.4) ** 2);
    const d2 = sqrt((x - 0.65) ** 2 + (z - 0.4) ** 2);
    const d3 = sqrt((x - 0.5) ** 2 + (z - 0.7) ** 2);
    const heart = clamp(1 - d1 * 3) + clamp(1 - d2 * 3) + clamp(1 - d3 * 2.5);
    const pulse = sin(t * 4) * 0.1 + 0.9;
    return clamp(heart * pulse * 0.5);
  }),
  map((x, z, t) => {
    const d = sqrt((x - 0.5) ** 2 + (z - 0.5) ** 2);
    const expand = clamp(t * 0.5);
    return clamp(1 - abs(d - expand * 0.7) * 8) * (1 - expand);
  })
);
```

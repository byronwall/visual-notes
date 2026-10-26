// SolidStart 2 server function ids are `<module hash>-<name hash>`: the name
// half is xxHash32 of the function's name (`createDoc`, not the router key),
// and in dev it is the plain name. The module half depends on the build path,
// so specs match the name half only.

const P1 = 0x9e3779b1;
const P2 = 0x85ebca77;
const P3 = 0xc2b2ae3d;
const P4 = 0x27d4eb2f;
const P5 = 0x165667b1;

const rotl = (x: number, r: number) => (x << r) | (x >>> (32 - r));
const round = (acc: number, lane: number) =>
  Math.imul(rotl((acc + Math.imul(lane, P2)) | 0, 13), P1);

/** xxHash32 with seed 0 over the UTF-8 bytes of `text`. */
export const xxHash32 = (text: string): number => {
  const b = new TextEncoder().encode(text);
  const u32 = (i: number) =>
    (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  let i = 0;
  let h: number;
  if (b.length >= 16) {
    let v1 = (P1 + P2) | 0;
    let v2 = P2;
    let v3 = 0;
    let v4 = -P1 | 0;
    for (; i + 16 <= b.length; i += 16) {
      v1 = round(v1, u32(i));
      v2 = round(v2, u32(i + 4));
      v3 = round(v3, u32(i + 8));
      v4 = round(v4, u32(i + 12));
    }
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) | 0;
  } else {
    h = P5;
  }
  h = (h + b.length) | 0;
  for (; i + 4 <= b.length; i += 4) {
    h = Math.imul(rotl((h + Math.imul(u32(i), P3)) | 0, 17), P4);
  }
  for (; i < b.length; i++) {
    h = Math.imul(rotl((h + Math.imul(b[i], P5)) | 0, 11), P1);
  }
  h = Math.imul(h ^ (h >>> 15), P2);
  h = Math.imul(h ^ (h >>> 13), P3);
  return (h ^ (h >>> 16)) >>> 0;
};

/** True when a request's `X-Server-Id` belongs to the server function `name`. */
export const isServerFn = (serverId: string | undefined, name: string) => {
  const id = (serverId ?? "").split("#", 1)[0];
  return (
    id.endsWith(`-${xxHash32(name).toString(16)}`) || id.endsWith(`-${name}`)
  );
};

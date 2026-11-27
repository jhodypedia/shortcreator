export function frameDigest(frames: Uint8Array[]) {
  let hash = 2166136261;
  for (const frame of frames) for (const byte of frame) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function isIdenticalRender(first: Uint8Array[], second: Uint8Array[]) {
  return first.length === second.length && frameDigest(first) === frameDigest(second);
}

import type {Camera, Pt } from "@/lib/modelspace/types";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function snapWorldXToPixelCenter(xIn: number, cam: { x: number; scale: number }) {
  const sx = xIn * cam.scale + cam.x;
  const snappedSx = Math.round(sx) + 0.5;
  return (snappedSx - cam.x) / cam.scale;
}

export function snapWorldYToPixelCenter(yIn: number, cam: { y: number; scale: number }) {
  const sy = yIn * cam.scale + cam.y;
  const snappedSy = Math.round(sy) + 0.5;
  return (snappedSy - cam.y) / cam.scale;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function pickGridStepIn(pxPerIn: number) {
  const targetPx = 60;
  const rawIn = targetPx / pxPerIn;
  const steps = [4, 12, 36, 108, 324, 972];
  for (const s of steps) {
    if (s >= rawIn) return s;
  }
  return steps[steps.length - 1];
}

export function screenToWorld(cam: Camera, sx: number, sy: number) {
  return { x: (sx - cam.x) / cam.scale, y: (sy - cam.y) / cam.scale };
}

export function worldToScreen(cam: Camera, wx: number, wy: number) {
  return {
    x: cam.x + wx * cam.scale,
    y: cam.y + wy * cam.scale,
  };
}

export function dist(a: Pt, b: Pt) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalizeDeg(d: number) {
  let x = d % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

export function snapHV(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const SNAP_DEG = 10; // tweak: 8–15 feels good
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax === 0 && ay === 0) return b;

  const t = Math.tan((SNAP_DEG * Math.PI) / 180);

  // near horizontal => |dy/dx| small
  if (ax > 0 && ay / ax < t) return { x: b.x, y: a.y };

  // near vertical => |dx/dy| small
  if (ay > 0 && ax / ay < t) return { x: a.x, y: b.y };

  return b;
}

export function pointerAngleDeg(clientX: number, clientY: number, cx: number, cy: number) {
  const rad = Math.atan2(clientY - cy, clientX - cx);
  return rad * (180 / Math.PI);
}
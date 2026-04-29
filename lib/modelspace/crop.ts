import type { Pt, CropRectPx } from "@/lib/modelspace/types";
import { clamp } from "@/lib/modelspace/math";

export type CropDragMode =
    | "new"
    | "move"
    | "resize-n"
    | "resize-s"
    | "resize-e"
    | "resize-w"
    | "resize-nw"
    | "resize-ne"
    | "resize-sw"
    | "resize-se";

export function normalizeCropRectFromCorners(
  x1: number, 
  y1: number, 
  x2: number, 
  y2: number
): CropRectPx {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.max(1, Math.abs(x2 - x1)),
      h: Math.max(1, Math.abs(y2 - y1)),
    };
  }

export function hitCropHandle(
  pt: Pt, 
  r: CropRectPx, 
  tolPx: number
): CropDragMode | null {
  const left = r.x;
  const right = r.x + r.w;
  const top = r.y;
  const bottom = r.y + r.h;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;

  const near = (a: number, b: number) => Math.abs(a - b) <= tolPx;
  const withinX = pt.x >= left - tolPx && pt.x <= right + tolPx;
  const withinY = pt.y >= top - tolPx && pt.y <= bottom + tolPx;

  if (near(pt.x, left) && near(pt.y, top)) return "resize-nw";
  if (near(pt.x, right) && near(pt.y, top)) return "resize-ne";
  if (near(pt.x, left) && near(pt.y, bottom)) return "resize-sw";
  if (near(pt.x, right) && near(pt.y, bottom)) return "resize-se";

  if (near(pt.y, top) && withinX) return "resize-n";
  if (near(pt.y, bottom) && withinX) return "resize-s";
  if (near(pt.x, left) && withinY) return "resize-w";
  if (near(pt.x, right) && withinY) return "resize-e";

  if (pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom) return "move";

  return null;
}

export function resizeCropRect(startRect: CropRectPx, mode: CropDragMode, dx: number, dy: number, boundsW: number, boundsH: number): CropRectPx {
  let left = startRect.x;
  let top = startRect.y;
  let right = startRect.x + startRect.w;
  let bottom = startRect.y + startRect.h;

  switch (mode) {
    case "resize-n":
      top += dy;
      break;
    case "resize-s":
      bottom += dy;
      break;
    case "resize-w":
      left += dx;
      break;
    case "resize-e":
      right += dx;
      break;
    case "resize-nw":
      left += dx;
      top += dy;
      break;
    case "resize-ne":
      right += dx;
      top += dy;
      break;
    case "resize-sw":
      left += dx;
      bottom += dy;
      break;
    case "resize-se":
      right += dx;
      bottom += dy;
      break;
    default:
      break;
  }

  const next = normalizeCropRectFromCorners(left, top, right, bottom);
  return clampCropRect(next, boundsW, boundsH);
}

export function moveCropRect(startRect: CropRectPx, dx: number, dy: number, boundsW: number, boundsH: number): CropRectPx {
  const w = startRect.w;
  const h = startRect.h;
  return {
    x: clamp(startRect.x + dx, 0, boundsW - w),
    y: clamp(startRect.y + dy, 0, boundsH - h),
    w,
    h,
  };
}

export function clampCropRect(
  r: CropRectPx, 
  boundsW: number, 
  boundsH: number
): CropRectPx {
  const x1 = clamp(r.x, 0, boundsW);
  const y1 = clamp(r.y, 0, boundsH);
  const x2 = clamp(r.x + r.w, 0, boundsW);
  const y2 = clamp(r.y + r.h, 0, boundsH);

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.max(1, Math.abs(x2 - x1)),
    h: Math.max(1, Math.abs(y2 - y1)),
  };
}
import { formatImperialFromInches } from "@/lib/modelspace/parsing";
import {RAL} from "@/lib/modelspace/constants"

export function ScaleBar({ pxPerIn, targetPx = 120 }: { pxPerIn: number; targetPx?: number }) {
  function pickScaleBarLengthIn(pxPerIn: number, targetPx = 120, minPx = 80, maxPx = 160) {
    const candidatesIn = [4, 8, 12, 36, 72, 108, 240, 600, 1200, 2400, 4800];
    let best = candidatesIn[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const lenIn of candidatesIn) {
      const px = lenIn * pxPerIn;
      if (px < minPx || px > maxPx) continue;
      const score = Math.abs(px - targetPx);
      if (score < bestScore) {
        bestScore = score;
        best = lenIn;
      }
    }

    if (bestScore === Number.POSITIVE_INFINITY) {
      best = candidatesIn.reduce((a, b) =>
        Math.abs(a * pxPerIn - targetPx) < Math.abs(b * pxPerIn - targetPx) ? a : b
      );
    }

    return best;
  }

  const barIn = pickScaleBarLengthIn(pxPerIn);
  const barPx = barIn * pxPerIn;
  const t1 = barPx / 3;
  const t2 = (2 * barPx) / 3;

  return (
    <div
      style={{
        position: "fixed",
        left: 20,
        bottom: 20,
        fontFamily: "Futura, sans-serif",
        fontSize: 12,
        color: RAL.black,
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "relative", width: barPx, height: 16 }}>
        <div style={{ position: "absolute", left: 0, top: 20, width: barPx, borderTop: "1px solid" }} />
        <div style={{ position: "absolute", left: 0, top: 11, height: 10, borderLeft: "1px solid" }} />
        <div style={{ position: "absolute", left: barPx, top: 11, height: 10, borderLeft: "1px solid" }} />
        <div style={{ position: "absolute", left: t1, top: 16, height: 4, borderLeft: "1px solid" }} />
        <div style={{ position: "absolute", left: t2, top: 16, height: 4, borderLeft: "1px solid" }} />
      </div>
      <div style={{ marginTop: 4 }}>{formatImperialFromInches(barIn)}</div>
    </div>
  );
}
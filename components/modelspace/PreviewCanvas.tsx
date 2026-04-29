import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Group, Line, Rect, Image as KonvaImage} from "react-konva";
import Konva from "konva";
import { RAL } from "@/lib/modelspace/constants";
import type {Draft, Camera, Pt } from "@/lib/modelspace/types";
import { clamp, screenToWorld, snapHV } from "@/lib/modelspace/math";
import DimMark from "@/components/modelspace/DimMark";

type PreviewCanvasProps = {
  isOpen: boolean;
  draft: Draft | null;
  setDraft: (next: Draft) => void;
  
  calibInputRef: React.RefObject<HTMLInputElement | null>;

  isCropping: boolean;
  handleCropMouseDown: (pt: Pt, tolPx: number) => void;
  handleCropMouseMove: (pt: Pt) => void;
  handleCropMouseUp: () => void;

  calibInlineOpen: boolean;
  setCalibInlineOpen: React.Dispatch<React.SetStateAction<boolean>>;

  isCalibrating: boolean;
  setIsCalibrating: React.Dispatch<React.SetStateAction<boolean>>;
  calibInputRaw: string;
  setCalibInputRaw: React.Dispatch<React.SetStateAction<string>>;
  calibInputErr: string | null;
  setCalibInputErr: React.Dispatch<React.SetStateAction<string | null>>;

  applyCalibrationFromPrompt: () => boolean;
  clearCalibrationPoints: () => void;
};

export default function PreviewCanvas({
  isOpen,
  draft,
  setDraft,  
  calibInputRef,
  isCropping,
  handleCropMouseDown,
  handleCropMouseMove,
  handleCropMouseUp,
  calibInlineOpen,
  setCalibInlineOpen,
  isCalibrating,
  setIsCalibrating,
  calibInputRaw,
  setCalibInputRaw,
  calibInputErr,
  setCalibInputErr,
  applyCalibrationFromPrompt,
  clearCalibrationPoints,

  }: PreviewCanvasProps) {

  const hasImage = !!draft?.img;
  const cropViewPxW = isCropping ? (draft?.originalPxW ?? 1) : (draft?.pxW ?? 1);
  const cropViewPxH = isCropping ? (draft?.originalPxH ?? 1) : (draft?.pxH ?? 1);
  const previewImg = isCropping ? (draft?.originalImg ?? null) : (draft?.img ?? null);
  const previewStageRef = useRef<Konva.Stage>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const [previewSize, setPreviewSize] = useState({ w: 800, h: 600 });
  const [pCam, setPCam] = useState<Camera>({ x: 40, y: 40, scale: 1 }); // px per image-px
  const isPreviewPanningRef = useRef(false);
  const lastPreviewPointerRef = useRef<Pt | null>(null);
  const [calibLiveB, setCalibLiveB] = useState<Pt | null>(null);
  const A = draft?.calibA ?? null;
  const B = (draft?.calibB ?? calibLiveB) ?? null;
  const angleRad = A && B ? Math.atan2(B.y - A.y, B.x - A.x) : 0;
    
  // Preview size: fit viewport when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const el = previewPaneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setPreviewSize({ w: Math.max(1, Math.floor(rect.width)), h: Math.max(1, Math.floor(rect.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
    }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (calibInlineOpen) {
          setCalibInlineOpen(false);
          setIsCalibrating(false);
          setCalibLiveB(null);
          clearCalibrationPoints();
          return;
        }
        if (isCalibrating) {
          setIsCalibrating(false);
          setCalibLiveB(null);
          clearCalibrationPoints();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calibInlineOpen, isCalibrating, draft]);

  useEffect(() => {
    if (calibInlineOpen) {
      // focus after render
      requestAnimationFrame(() => calibInputRef.current?.focus());
      requestAnimationFrame(() => calibInputRef.current?.select());
    }
  }, [calibInlineOpen]);

  useEffect(() => {
  if (!isOpen || !draft) return;
  fitPreviewToImage(cropViewPxW, cropViewPxH);
}, [isOpen, draft?.img, cropViewPxW, cropViewPxH, previewSize.w, previewSize.h]);

  function fitPreviewToImage(pxW: number, pxH: number) {
    const stage = previewStageRef.current;
    if (!stage) return;
    const vw = previewSize.w;
    const vh = previewSize.h;

    // scale so image fits within 90% of viewport
    const s = Math.min((vw * 0.9) / pxW, (vh * 0.9) / pxH);
    const scale = clamp(s, 0.05, 20);

    // center image
    const x = (vw - pxW * scale) / 2;
    const y = (vh - pxH * scale) / 2;

    setPCam({ x, y, scale });
  }

  // Preview camera events (zoom/pan within preview mini-canvas)
  function handlePreviewWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    if (isCropping) return;
    const stage = previewStageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const ZOOM = 1.08;
    const MIN = 0.05;
    const MAX = 20;

    const zoomFactor = e.evt.deltaY > 0 ? 1 / ZOOM : ZOOM;

    setPCam((prev) => {
      const nextScale = clamp(prev.scale * zoomFactor, MIN, MAX);
      const worldPos = screenToWorld(prev, pointer.x, pointer.y); // here "world" = image px
      return {
        x: pointer.x - worldPos.x * nextScale,
        y: pointer.y - worldPos.y * nextScale,
        scale: nextScale,
      };
    });
  }

  function handlePreviewMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    // In preview: left click places calibration points; right click / space drag not implemented.
    // We pan with middle mouse or when holding Alt.
    const stage = previewStageRef.current;
    if (!stage) return;
    const isMiddle = (e.evt as MouseEvent).button === 1;
    const isAlt = (e.evt as MouseEvent).altKey;

    if (isMiddle || isAlt) {
      isPreviewPanningRef.current = true;
      const p = stage.getPointerPosition();
      if (p) lastPreviewPointerRef.current = p;
      return;
    }

    if (!draft) return;

    const p = stage.getPointerPosition();
    if (!p) return;

    const imgPt = screenToWorld(pCam, p.x, p.y); // image pixel space

    if (isCropping) {
      const tolPx = 10 / Math.max(pCam.scale, 0.0001);
      handleCropMouseDown(imgPt, tolPx);
      return;
    }

    if (calibInlineOpen) return;
    if (!isCalibrating) return;
    
    const shift = e.evt.shiftKey;
    const lockedPt = !shift && draft.calibA ? snapHV(draft.calibA, imgPt) : imgPt;
    // set A then B; once B is set, prompt for distance immediately
    if (!draft.calibA || (draft.calibA && draft.calibB)) {
      setDraft({ ...draft, calibA: imgPt, calibB: null });
      setCalibLiveB(imgPt);
      return;
    }

    if (draft.calibA && !draft.calibB) {
      setDraft({ ...draft, calibB: lockedPt });
      setCalibLiveB(null);
      // open prompt AFTER B is set
      setCalibInputRaw("36in");
      setCalibInputErr(null);
      setCalibInlineOpen(true);
      return;
    }
  }

  function handlePreviewMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = previewStageRef.current;
    if (!stage) return;
    const p = stage.getPointerPosition();
    if (!p) return;

    if (isCropping && !isPreviewPanningRef.current) {
      const imgPt = screenToWorld(pCam, p.x, p.y);
      handleCropMouseMove(imgPt);
      return;
    }

    if ( isCalibrating && draft && draft.calibA && !draft.calibB && !calibInlineOpen && !isPreviewPanningRef.current) 
      {
      let imgPt = screenToWorld(pCam, p.x, p.y); // image pixel space
      const shift = e.evt.shiftKey;
      if (!shift) imgPt = snapHV(draft.calibA, imgPt);
      setCalibLiveB(imgPt);
      return;
      }

    if (!isPreviewPanningRef.current) return;
    const last = lastPreviewPointerRef.current;
    if (!last) return;
    
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    lastPreviewPointerRef.current = p;
    setPCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
  }

  function handlePreviewMouseUp() {
    isPreviewPanningRef.current = false;
    lastPreviewPointerRef.current = null;
    if (isCropping) handleCropMouseUp();
  }

  function worldToScreenFromPCam(world: {x: number; y: number }) {
    const stage = previewStageRef.current;
    if (!stage) return null;
    const rect = stage.container().getBoundingClientRect();
    return {
      x: rect.left + (pCam.x + world.x * pCam.scale), 
      y: rect.top + (pCam.y + world.y * pCam.scale)
    };
  }

  if (!isOpen) return null;

  return(
  <div ref={previewPaneRef} style={{ position: "relative", background: RAL.white, minWidth: 0, overflow: "hidden" }}>
        <Stage 
          ref={previewStageRef} 
          width={previewSize.w} 
          height={previewSize.h}
          x={0}
          y={0}
          scaleX={1}
          scaleY={1}
          onWheel={handlePreviewWheel}
          onMouseDown={(e) => {
            handlePreviewMouseDown(e);
            }}
          onMouseMove={handlePreviewMouseMove}
          onMouseUp={handlePreviewMouseUp}
          onMouseLeave={handlePreviewMouseUp}
          style={{ width: "100%", height: "100%", cursor: isCropping? "move" : isCalibrating ? "crosshair" : "default" }}
        >
          <Layer>
            <Group x={pCam.x} y={pCam.y} scaleX={pCam.scale} scaleY={pCam.scale}>
              {previewImg && (
                <KonvaImage
                  image={previewImg}
                  x={0}
                  y={0}
                  width={cropViewPxW}
                  height={cropViewPxH}
                  listening={false}
                />
              )}

              {isCropping && draft?.cropPx && (
                <>
                <Rect 
                  x={0} 
                  y={0} 
                  width={draft.originalPxW} 
                  height={draft.cropPx.y} 
                  fill="rgba(0,0,0,0.3)" 
                  listening={false} 
                />
                <Rect 
                  x={0} 
                  y={draft.cropPx.y + draft.cropPx.h} 
                  width={draft.originalPxW} 
                  height={Math.max(0, draft.originalPxH - (draft.cropPx.y + draft.cropPx.h))} 
                  fill="rgba(0,0,0,0.3)" 
                  listening={false} 
                />
                <Rect
                  x={0}
                  y={draft.cropPx.y}
                  width={draft.cropPx.x}
                  height={draft.cropPx.h}
                  fill="rgba(0,0,0,0.3)"
                  listening={false}
                />
                <Rect
                  x={draft.cropPx.x + draft.cropPx.w}
                  y={draft.cropPx.y}
                  width={Math.max(0, draft.originalPxW - (draft.cropPx.x + draft.cropPx.w))}
                  height={draft.cropPx.h}
                  fill="rgba(0,0,0,0.3)"
                  listening={false}
                />
                <Rect
                  x={draft.cropPx.x}
                  y={draft.cropPx.y}
                  width={draft.cropPx.w}
                  height={draft.cropPx.h}
                  stroke={RAL.red}
                  strokeWidth={1 / pCam.scale}
                  dash={[4 / pCam.scale, 4 / pCam.scale]}
                  listening={false}
                />

                <Line
                  points={[
                    draft.cropPx.x + draft.cropPx.w / 3, draft.cropPx.y,
                    draft.cropPx.x + draft.cropPx.w / 3, draft.cropPx.y + draft.cropPx.h,
                  ]}
                  stroke={RAL.red}
                  opacity={0.45}
                  strokeWidth={1 / pCam.scale}
                  listening={false}
                />
                <Line
                  points={[
                    draft.cropPx.x + (2 * draft.cropPx.w) / 3, draft.cropPx.y,
                    draft.cropPx.x + (2 * draft.cropPx.w) / 3, draft.cropPx.y + draft.cropPx.h,
                  ]}
                  stroke={RAL.red}
                  opacity={0.45}
                  strokeWidth={1 / pCam.scale}
                  listening={false}
                />
                <Line
                  points={[
                    draft.cropPx.x, draft.cropPx.y + draft.cropPx.h / 3,
                    draft.cropPx.x + draft.cropPx.w, draft.cropPx.y + draft.cropPx.h / 3,
                  ]}
                  stroke={RAL.red}
                  opacity={0.45}
                  strokeWidth={1 / pCam.scale}
                  listening={false}
                />
                <Line
                  points={[
                    draft.cropPx.x, draft.cropPx.y + (2 * draft.cropPx.h) / 3,
                    draft.cropPx.x + draft.cropPx.w, draft.cropPx.y + (2 * draft.cropPx.h) / 3,
                  ]}
                  stroke={RAL.red}
                  opacity={0.45}
                  strokeWidth={1 / pCam.scale}
                  listening={false}
                />
                {/*handles*/}
                {(() => {
                  const r = draft.cropPx;
                  const s = pCam.scale;

                  const len = 8 / s;
                  const t = 2 / s;
                  const left = r.x;
                  const right = r.x + r.w;
                  const top = r.y;
                  const bottom = r.y + r.h;
                  const cx = r.x + r.w / 2;
                  const cy = r.y + r.h / 2;

                  const stroke = RAL.red;

                  return (
                    <> 
                    {/* Corner handles */}
                    <Line points={[left, top, left + len, top]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>
                    <Line points={[left, top, left, top + len]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>

                    <Line points={[right - len, top, right, top]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>
                    <Line points={[right, top, right, top + len]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>

                    <Line points={[left, bottom, left + len, bottom]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>
                    <Line points={[left, bottom - len, left, bottom]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>

                    <Line points={[right - len, bottom, right, bottom]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>
                    <Line points={[right, bottom - len, right, bottom]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>

                    {/* Edge handles */}
                    <Line points={[cx - len / 2, top, cx + len / 2, top]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>
                    <Line points={[cx - len / 2, bottom, cx + len / 2, bottom]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>
                    <Line points={[left, cy - len / 2, left, cy + len / 2]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>
                    <Line points={[right, cy - len / 2, right, cy + len / 2]} stroke={stroke} strokeWidth={t} lineCap="square" listening={false}/>
                    </>
                  );
                })()}
                </>
              )}

              {/* Calibration points in image pixel space */}
              {A && (
                <DimMark x={A.x} y={A.y} angleRad={angleRad} size={12 / pCam.scale} stroke={RAL.red} strokeWidth={1 / pCam.scale} flip={true}/>
              )}
              {B && (
                <DimMark  x={B.x} y={B.y} angleRad={angleRad} size={12 / pCam.scale} stroke={RAL.red} strokeWidth={1 / pCam.scale} flip={false}/>
                )}

              {A && B && (
                <Line
                  points={[A.x, A.y, B.x, B.y]}
                  stroke={RAL.red}
                  strokeWidth={1 / pCam.scale}
                  listening={false}
                />
              )}
            </Group>
          </Layer>
        </Stage>

        
    {/* Calibration prompt overlay */}
    
    {draft?.calibA && draft?.calibB && calibInlineOpen && (() => {
      const mid = {
        x: (draft.calibA.x + draft.calibB.x) / 2,
        y: (draft.calibA.y + draft.calibB.y) / 2,
      };
      const screenPos = worldToScreenFromPCam(mid);
      if (!screenPos) return null;
      
      return (
      <input
        ref={calibInputRef}
        className={`calibration-input ${calibInputErr ? "error" : ""}`}
        value={calibInputRaw}
        onChange={(e) => {
          setCalibInputRaw(e.target.value);
          setCalibInputErr(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            applyCalibrationFromPrompt();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setCalibInlineOpen(false);
            clearCalibrationPoints();
            setIsCalibrating(true);
          }
        }}

        onBlur={() => applyCalibrationFromPrompt()}
        placeholder="36 in"
        style={{
          position: "fixed",
          left: screenPos.x,
          top: screenPos.y,
          transform: "translate(-50%, -140%)",
          width: 60,
          zIndex: 9999,
        }}
      />
      );
    })()}
  </div>
  );
}
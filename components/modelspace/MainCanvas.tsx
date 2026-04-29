import React, { useEffect, useMemo, useRef, useState, } from "react";
import { Stage, Layer, Transformer, Line, Image as KonvaImage } from "react-konva";
import Konva from "konva";
import type { Asset, Draft, Camera, Pt} from "@/lib/modelspace/types";
import { clamp, screenToWorld, worldToScreen, pickGridStepIn, snapWorldXToPixelCenter, snapWorldYToPixelCenter } from "@/lib/modelspace/math";
import { RAL } from "@/lib/modelspace/constants";
import AssetInspector from "./AssetInspector";
import { ScaleBar } from "./scalebar";

type MainCanvasProps = {
  assets: Asset[];
  selected: Asset | null;
  selectedId: string | null;

  draft: Draft | null;
  isPlacing: boolean;
  ghostWorld: Pt | null;
  setGhostWorld: React.Dispatch<React.SetStateAction<Pt | null>>;

  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFileInPreview: (e: React.ChangeEvent<HTMLInputElement>) => void;

  commitPlacement: (x: number, y: number) => void;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;

  openPreviewForNew: () => void;
  openPreviewForEdit: (asset: Asset) => void;  
};

export default function MainCanvas({
  assets,
  selected,
  selectedId,
  draft,
  isPlacing,
  ghostWorld,
  setGhostWorld,
  commitPlacement,
  setSelectedId,
  setAssets,
  openPreviewForNew,
  openPreviewForEdit,
  fileInputRef,
  onPickFileInPreview,

  }: MainCanvasProps) {
  
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [cam, setCam] = useState<Camera>({ x: 200, y: 200, scale: 5 });
  
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef<Pt | null>(null);

  const selectedPanelPos = useMemo(() => {
  if (!selected) return null;
      const p = worldToScreen(cam, selected.x, selected.y);
      const rawLeft = p.x + (selected.wIn * cam.scale) / 2 + 12;
      const rawTop = p.y - (selected.hIn * cam.scale) / 2;

      const panelW = 260;
      const panelH = 180;

      return {
        left: Math.max(12, Math.min(rawLeft, size.w - panelW - 12)),
        top: Math.max(12, Math.min(rawTop, size.h - panelH - 12)),
      };
    }, [selected, cam, size.w, size.h]);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Attach transformer for selection outline only (no resize/rotate)
  useEffect(() => {
    const stage = stageRef.current;
    const tr = trRef.current;
    if (!stage || !tr) return;

    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const node = stage.findOne(`#asset-${selectedId}`);
    if (node) {
      tr.nodes([node as any]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, assets]);


  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
  const stage = stageRef.current;
  if (!stage) return;

  // Only pan when clicking on empty stage (not on an asset)
  const clickedOnEmpty = e.target === stage;
  if (!clickedOnEmpty) return;

  isPanningRef.current = true;
  const p = stage.getPointerPosition();
  if (p) lastPointerRef.current = p;
}

  function handleMouseMove() {
    const stage = stageRef.current;
    if (!stage) return;

    if (isPlacing && ghostWorld && draft) {
      const p = stage.getPointerPosition();
      if (p) setGhostWorld(screenToWorld(cam, p.x, p.y));
    }

    if (!isPanningRef.current) return;

    const p = stage.getPointerPosition();
    const last = lastPointerRef.current;
    if (!p || !last) return;

    const dx = p.x - last.x;
    const dy = p.y - last.y;

    lastPointerRef.current = p;
    setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
  }

  function handleMouseUp() {
    isPanningRef.current = false;
    lastPointerRef.current = null;
  }

  function onStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = stageRef.current;
    if (!stage) return;

    if (isPlacing && draft) {
      const p = stage.getPointerPosition();
      if (!p) return;
      const w = screenToWorld(cam, p.x, p.y);
      void commitPlacement(w.x, w.y);
      return;
    }

    if (e.target === stage) setSelectedId(null);
  }

  // Grid bounds
  const worldBounds = useMemo(() => {
    const topLeft = screenToWorld(cam, 0, 0);
    const bottomRight = screenToWorld(cam, size.w, size.h);
    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxY: Math.max(topLeft.y, bottomRight.y),
    };
  }, [cam, size]);

  const gridStepIn = useMemo(() => pickGridStepIn(cam.scale), [cam.scale]);

  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const minor = gridStepIn;
    const major = gridStepIn * 3;
    const { minX, maxX, minY, maxY } = worldBounds;

    const pad = minor * 2;
    const x0 = Math.floor((minX - pad) / minor) * minor;
    const x1 = Math.ceil((maxX + pad) / minor) * minor;
    const y0 = Math.floor((minY - pad) / minor) * minor;
    const y1 = Math.ceil((maxY + pad) / minor) * minor;

    const xAxisY = snapWorldYToPixelCenter(0, cam);
    const yAxisX = snapWorldXToPixelCenter(0, cam);
    
    for (let x = x0; x <= x1 + 1e-9; x += minor) {
      const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-9;
      const xs = snapWorldXToPixelCenter(x, cam);
      lines.push(
        <Line
          key={`vx-${x}`}
          points={[xs, y0, xs, y1]}
          stroke={isMajor ? "#d0d0d0" : "#e8e8e8"}
          strokeWidth={1 / cam.scale}
          listening={false}
          perfectDrawEnabled={false}
          hitStrokeWidth={0}
        />
      );
    }

    for (let y = y0; y <= y1 + 1e-9; y += minor) {
      const isMajor = Math.abs(y / major - Math.round(y / major)) < 1e-9;
      const ys = snapWorldYToPixelCenter(y, cam);
      lines.push(
        <Line
          key={`hy-${y}`}
          points={[x0, ys, x1, ys]}
          stroke={isMajor ? "#d0d0d0" : "#e8e8e8"}
          strokeWidth={1 / cam.scale}
          listening={false}
          perfectDrawEnabled={false}
          hitStrokeWidth={0}
        />
      );
    }

    lines.push(
      <Line
        key="axis-x"
        points={[x0, xAxisY, x1, xAxisY]}
        stroke={RAL.grey}
        strokeWidth={1 / cam.scale}
        listening={false}
        perfectDrawEnabled={false}
        hitStrokeWidth={0}
      />,
      <Line
        key="axis-y"
        points={[yAxisX, y0, yAxisX, y1]}
        stroke={RAL.grey}
        strokeWidth={1 / cam.scale}
        listening={false}
        perfectDrawEnabled={false}
        hitStrokeWidth={0}
      />
    );

    return lines;
  }, [worldBounds, gridStepIn, cam]);

  // ---------- Main canvas camera controls ----------
  const MIN_SCALE = 0.02;
  const MAX_SCALE = 60;
  const ZOOM_STEP = 1.08;

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const deltaY = e.evt.deltaY;
    if (Math.abs(deltaY) < 0.5) return;

    const zoomFactor = deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;

    setCam((prev) => {
      const nextScale = clamp(prev.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
      const worldPos = screenToWorld(prev, pointer.x, pointer.y);
      return {
        x: pointer.x - worldPos.x * nextScale,
        y: pointer.y - worldPos.y * nextScale,
        scale: nextScale,
      };
    });
  }

 // ---------- Render ----------

return (
  <div style={{ width: "100vw", height: "100vh", background: RAL.white }}>
    <div
      style={{
        position: "fixed",
        left: 16,
        top: 16,
        zIndex: 10,
        display: "flex",
        gap: 0,
        alignItems: "center",
      }}
    >
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*,application/pdf"
      style={{ display: "none" }}
      onChange={onPickFileInPreview}
      />
      <div
      onClick={openPreviewForNew}
      className={"link-primary"}
      style={{ fontSize: 22 }}>
        ✛
      </div>

      {isPlacing && (
        <div className="info"
        style={{marginLeft: 8}}>
          Click canvas to drop (Esc to cancel)
        </div>
      )}
    </div>

   <AssetInspector
  selected={selected}
  selectedPanelPos={selectedPanelPos}
  onEdit={openPreviewForEdit}
  />

  <Stage
    ref={stageRef}
    width={size.w}
    height={size.h}
    x={cam.x}
    y={cam.y}
    scaleX={cam.scale}
    scaleY={cam.scale}
    onWheel={handleWheel}
    onMouseDown={handleMouseDown}
    onMouseMove={handleMouseMove}
    onMouseUp={handleMouseUp}
    onMouseLeave={handleMouseUp}
    onClick={onStageClick}
    >
    <Layer listening={false}>{gridLines}</Layer>

    <Layer>
      {assets.map((a) => (
        <KonvaImage
          key={a.id}
          id={`asset-${a.id}`}
          image={a.img}
          x={a.x}
          y={a.y}
          width={a.wIn}
          height={a.hIn}
          offsetX={a.wIn / 2}
          offsetY={a.hIn / 2}
          rotation={a.rotationDeg}
          draggable
          onClick={(ev) => {
            ev.cancelBubble = true;
            setSelectedId(a.id);
          }}
          onTap={(ev) => {
            ev.cancelBubble = true;
            setSelectedId(a.id);
          }}
          onDragEnd={(ev) => {
            const node = ev.target;
            setAssets((prev) => prev.map((p) => (p.id === a.id ? { ...p, x: node.x(), y: node.y() } : p)));
          }}
        />
      ))}

      {isPlacing && draft && ghostWorld && (
        <KonvaImage
          image={draft.img}
          x={ghostWorld.x}
          y={ghostWorld.y}
          width={draft.wIn}
          height={draft.hIn}
          offsetX={draft.wIn / 2}
          offsetY={draft.hIn / 2}
          rotation={draft.rotationDeg}
          opacity={0.45}
          listening={false}
        />
      )}
    </Layer>

    <Layer>
      <Transformer ref={trRef} rotateEnabled={false} enabledAnchors={[]} borderStroke="#111" borderDash={[4, 4]} ignoreStroke />
    </Layer>
  </Stage>

  <ScaleBar pxPerIn={cam.scale} />
  
</div>
);

}
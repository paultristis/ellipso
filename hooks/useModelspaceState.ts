import React, { useState, useEffect, useMemo, useRef } from "react";
import type { Pt, Draft, Asset, CropRectPx } from "@/lib/modelspace/types";
import { savePlacedAsset } from "@/lib/modelspace/asset-service";
import { parseDistanceToInches, formatScale1toX, parsePdfScale } from "@/lib/modelspace/parsing";
import { normalizeDeg, dist, uid } from "@/lib/modelspace/math";
import {RAL} from "@/lib/modelspace/constants";
import { 
  loadFileAsImage, 
  loadPdfFirstPageAsImage, 
  rebuildDraftBitmapFromOriginal, 
  makeImageFromDataUrl,
  stripExt
} from "@/lib/modelspace/file-processing";
import {
  clampCropRect,
  normalizeCropRectFromCorners,
  hitCropHandle,
  resizeCropRect,
  moveCropRect,
  type CropDragMode,
} from "@/lib/modelspace/crop";

type UseModelspaceStateArgs = {
  profileId: string;
  workspaceId: string;
};

export function useModelspaceState({ 
  profileId,
  workspaceId,
}: UseModelspaceStateArgs) {
  // Assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => assets.find((a) => a.id === selectedId) ?? null, [assets, selectedId]);

  // Placement
  const [isPlacing, setIsPlacing] = useState(false);
  const [ghostWorld, setGhostWorld] = useState<Pt | null>(null);

  // Preview modal + preview stage
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [removeBgEnabled, setRemoveBgEnabled] = useState(false);
  const [tintColor, setTintColor] = useState<string>(RAL.black);

  // Calibration prompt
  const [calibInlineOpen, setCalibInlineOpen] = useState(false);
  const [calibInputRaw, setCalibInputRaw] = useState<string>("36");
  const [calibInputErr, setCalibInputErr] = useState<string | null>(null);
  const calibInputRef = useRef<HTMLInputElement | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const pdfScaleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isPlacing) {
          setIsPlacing(false);
          setGhostWorld(null);
          return;
        }
        if (isPreviewOpen) {
          setIsPreviewOpen(false);
          setDraft(null);
          setCalibInlineOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPlacing, isPreviewOpen, draft]);


  // ---------- Preview modal controls ----------

  function openPreviewForNew() {
    setDraft(null);
    setCalibInlineOpen(false);
    setIsPlacing(false);
    setGhostWorld(null);
    fileInputRef.current?.click();
  }

  function openPreviewForEdit(asset: Asset) {
    setIsPreviewOpen(true);
    const seededName  = (asset.meta?.name ?? "").trim().length > 0
    ? asset.meta!.name : stripExt(asset.fileName ?? "");
    const oImg = asset.originalImg ?? asset.img;
    const oDataUrl = asset.originalFilePath ?? asset.filePath;
    const oPxW = asset.originalPxW ?? asset.pxW;
    const oPxH = asset.originalPxH ?? asset.pxH;
    const source: "image" | "pdf" = (asset.source as any) ?? "image";
    const baseInPerPx = asset.baseInPerPx ?? (source === "pdf" ? asset.inPerPx : undefined);
    const inPerPx = asset.inPerPx;
    const isCalibrated = Number.isFinite(inPerPx) && inPerPx > 0;

    setDraft({
      fileName: asset.fileName,
      dataUrl: asset.filePath,
      img: asset.img,
      pxW: asset.pxW,
      pxH: asset.pxH,
      originalDataUrl: oDataUrl,
      originalImg: oImg,
      originalPxW: oPxW,
      originalPxH: oPxH,
      cropPx: asset.cropPx,
      source,
      inPerPx,
      baseInPerPx,
      scaleRaw: asset.scaleRaw ?? (source === "pdf" ? "1:1" : undefined),
      wIn: asset.wIn,
      hIn: asset.hIn,
      rotationDeg: asset.rotationDeg,
      meta: { ...asset.meta, name: seededName},
      calibA: null,
      calibB: null,
      isCalibrated,
    });
    setCalibInlineOpen(false);
    setIsPlacing(false);
    setGhostWorld(null);
  }

  async function onPickFileInPreview(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    openPreviewForNew();
    
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const { img, dataUrl, pxW, pxH, pageWIn, pageHIn } = await loadPdfFirstPageAsImage(file, { dpi: 250, pageNumber: 1 });
        const inPerPx = pageWIn / pxW; 
        const next: Draft = {
          fileName: file.name,
          dataUrl,
          file,
          img, 
          pxW,
          pxH,
          originalDataUrl: dataUrl,
          originalImg: img,
          originalPxW: pxW,
          originalPxH: pxH,
          cropPx: null,
          source: "pdf",
          scaleRaw: "1:1",
          inPerPx,
          baseInPerPx: inPerPx,
          isCalibrated: false,
          wIn: pageWIn,
          hIn: pageHIn,
          rotationDeg: 0,
          meta: { name: stripExt(file.name), desc: "" },
          calibA: null,
          calibB: null,
          bgRemoved: false,
          tintColor: null,
        };

        setDraft(next);
        setRemoveBgEnabled(next.bgRemoved ?? false);
        setTintColor(next.tintColor ?? RAL.black);
        setCalibInlineOpen(false);
        setIsPlacing(false);
        setGhostWorld(null);
        setIsPreviewOpen(true);
        return;
      }

      const { img, dataUrl, pxW, pxH } = await loadFileAsImage(file);
      const defaultWIn = 36;
      const inPerPx = defaultWIn / pxW;

      const next: Draft = {
        fileName: file.name,
        dataUrl,
        file,
        img,
        pxW,
        pxH,
        originalDataUrl: dataUrl,
        originalImg: img,
        originalPxW: pxW,
        originalPxH: pxH,
        cropPx: null,
        source: "image",
        baseInPerPx: inPerPx,
        inPerPx,
        isCalibrated: false,
        wIn: pxW * inPerPx,
        hIn: pxH * inPerPx,
        rotationDeg: 0,
        meta: { name: stripExt(file.name), desc: "" },
        calibA: null,
        calibB: null,
        bgRemoved:false,
        tintColor: null,
      };

      setDraft(next);
      setRemoveBgEnabled(next.bgRemoved ?? false);
      setTintColor(next.tintColor ?? RAL.black);
      setCalibInlineOpen(false);
      setIsPlacing(false);
      setGhostWorld(null);
      setIsPreviewOpen(true);

    } catch (err) {
      console.error(err);
      alert("Could not load that file. Try PNG/JPG/SVG.");
    }
  }

  function setDraftInPerPx(nextInPerPx: number, patch?: Partial<Draft>) {
    setDraft((d) => {
      if (!d) return d;

      const inPerPx = Math.max(nextInPerPx, 1e-12);

      return {
      ...d,
      ...patch,
      inPerPx,
      wIn: d.pxW * inPerPx,
      hIn: d.pxH * inPerPx,
      isCalibrated: true,
      };
    });
  }

  const [pdfScaleText, setPdfScaleText] = useState("1:1");
  const [pdfScaleErr, setPdfScaleErr] = useState<string | null>(null);
  useEffect(() => {
    if (!draft) return;
    if (draft.source === "pdf") {
    setPdfScaleText(draft.scaleRaw ?? "1:1");
    setPdfScaleErr(null);
    } else {
      setPdfScaleText("");
      setPdfScaleErr(null);
    }
  }, [draft?.source, draft?.scaleRaw]);

  function commitPdfScaleText(raw: string): boolean {
    if (!draft || draft.source !== "pdf") return false;
    if (draft.baseInPerPx == null) return false;

    const parsed = parsePdfScale(raw);
    if ("error" in parsed) {
      setPdfScaleErr(parsed.error);
      return false;
    }

    setPdfScaleErr(null);

    const nextInPerPx = draft.baseInPerPx * parsed.ratio;
    setDraft({
      ...draft,
      scaleRaw: raw,
      calibA: null,
      calibB: null,
    });

    setIsCalibrating(false);
    setCalibInlineOpen(false);
    setDraftInPerPx(nextInPerPx);
    return true;
  }

  function onDraftRotationChange(nextDeg: number) {
    const n = normalizeDeg(nextDeg);
    const snapped = Math.abs(n) < 1 ? 0 : n;
    setDraft((d) => (d ? { ...d, rotationDeg: snapped } : d));
  }

  function applyCalibrationFromPrompt(): boolean {
    if (!draft || !draft.calibA || !draft.calibB) return false;

    const pxLen = dist(draft.calibA, draft.calibB);
    if (pxLen < 1e-6) return false;

    const parsed = parseDistanceToInches(calibInputRaw);
    if ("error" in parsed) {
      setCalibInputErr(parsed.error);
      return false;
    }
    
    const realIn = Math.max(parsed.inches,0.01);
    const inPerPx = realIn / pxLen;
    if (draft.source === "pdf" && draft.baseInPerPx != null) {
      const ratio = inPerPx / draft.baseInPerPx;
      const nextScaleText = formatScale1toX(ratio);
      setPdfScaleText(nextScaleText);
      setDraftInPerPx(inPerPx, { scaleRaw: nextScaleText });
    } else {
      setDraftInPerPx(inPerPx);
    }
    setCalibInlineOpen(false);
    setIsCalibrating(false);
    clearCalibrationPoints();
    return true;
  }

  function clearCalibrationPoints() {
    setDraft((d) => { 
      if (!d) return d;
      return { 
      ...d, 
      calibA: null, 
      calibB: null };
    });

    setCalibInlineOpen(false);
    setIsCalibrating(false);
  }

  function startCalibration() {
    if (!draft) return;
    setCalibInlineOpen(false);
    setCalibInputErr(null);
    setIsCalibrating(true);
    setDraft({ ...draft, calibA: null, calibB: null });
  }

  const [isCropping, setIsCropping] = useState(false);

  const cropDragRef = useRef<{
    mode: CropDragMode;
    startPt: Pt;              // in original-image px
    startRect: CropRectPx;    // in original-image px
  } | null>(null);

  // ---------- Commit edits / placement ----------

  function beginPlacementFromPreview() {
    if (!draft) return;
    setIsPreviewOpen(false);
    setIsPlacing(true);
    setGhostWorld({ x: 0, y: 0 });
  }

  async function commitPlacement(worldX: number, worldY: number) {
    if (!draft) return;

    const saved = await savePlacedAsset({
      draft,
      profileId,
      workspaceId,
      x: worldX,
      y: worldY,
    });

    const newAsset: Asset = {
      id: saved.row.id,
      workspace_id: workspaceId,
      owner_profile_id: profileId,

      fileName: draft.fileName,
      filePath: saved.filePath,
      originalFilePath: saved.originalFilePath,

      img: draft.img,
      originalImg: draft.originalImg,

      pxW: draft.pxW,
      pxH: draft.pxH,
      originalPxW: draft.originalPxW,
      originalPxH: draft.originalPxH,

      cropPx: draft.cropPx,
      source: draft.source,

      inPerPx: draft.inPerPx,
      baseInPerPx: draft.baseInPerPx,
      scaleRaw: draft.scaleRaw,
      wIn: draft.wIn,
      hIn: draft.hIn,
      x: worldX,
      y: worldY,
      rotationDeg: draft.rotationDeg,

      bgRemoved: draft.bgRemoved,
      tintColor: draft.tintColor,

      meta: { 
        name: draft.meta?.name,
        desc: draft.meta?.desc,
        uploadedBy: draft.meta?.uploadedBy?.trim() || "Unknown",
        date: draft.meta?.date?.trim() || new Date().toLocaleDateString(),
        },
    };

    setAssets((prev) => [...prev, newAsset]);
    setSelectedId(newAsset.id);
    setIsPlacing(false);
    setGhostWorld(null);
  }

  function applyEditsToSelected() {
    if (!draft || !selected) return;

    setAssets((prev) =>
      prev.map((a) =>
        a.id === selected.id
          ? {
              ...a,
              fileName: draft.fileName,
              dataUrl: draft.dataUrl,
              img: draft.img,
              pxW: draft.pxW,
              pxH: draft.pxH,
              originalDataUrl: draft.originalDataUrl,
              originalImg: draft.originalImg,
              originalPxW: draft.originalPxW,
              originalPxH: draft.originalPxH,
              cropPx: draft.cropPx,
              source: draft.source,
              inPerPx: draft.inPerPx,
              baseInPerPx: draft.baseInPerPx,
              scaleRaw: draft.scaleRaw,
              wIn: draft.wIn,
              hIn: draft.hIn,
              rotationDeg: draft.rotationDeg,
              meta: { ...draft.meta },              
            }
          : a
      )
    );

    setIsPreviewOpen(false);
    setDraft(null);
    setCalibInlineOpen(false);
  }

  async function refreshDraftProcessedView(
    enabled: boolean,
    color: string
  ) {
    if (!draft) return;

    const next = await rebuildDraftBitmapFromOriginal(draft, {
      removeBgEnabled: enabled,
      tintColor: color,
    });

    setDraft((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        dataUrl: next.dataUrl,
        img: next.img,
        pxW: next.pxW,
        pxH: next.pxH,
        wIn: next.pxW * curr.inPerPx,
        hIn: next.pxH * curr.inPerPx,
        bgRemoved: enabled,
        tintColor: enabled ? color : null,
        calibA: null,
        calibB: null,
      };
    });
  }

  async function handleToggleRemoveBg(nextChecked: boolean) {
    setRemoveBgEnabled(nextChecked);
    await refreshDraftProcessedView(nextChecked, tintColor);
  }

  async function handlePickTint(nextColor: string) {
    setTintColor(nextColor);
    if (!removeBgEnabled) return;
    await refreshDraftProcessedView(true, nextColor);
  }

  function beginCrop() {
    if (!draft) return;

    setIsCropping(true);
    setCalibInlineOpen(false);
    setIsCalibrating(false);

    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        cropPx:
          d.cropPx ??
          {
            x: 0,
            y: 0,
            w: d.originalPxW,
            h: d.originalPxH,
          },
      };
    });

  }

  function cancelCrop() {
    if (!draft) return;
    setIsCropping(false);
    cropDragRef.current = null;
  }

  async function applyCrop() {
    if (!draft || !draft.cropPx) return;

    const crop = clampCropRect(draft.cropPx, draft.originalPxW, draft.originalPxH);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.w));
    canvas.height = Math.max(1, Math.round(crop.h));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      draft.originalImg,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const croppedDataUrl = canvas.toDataURL("image/png");
    const croppedImg = await makeImageFromDataUrl(croppedDataUrl);

    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        dataUrl: croppedDataUrl,
        img: croppedImg,
        pxW: croppedImg.width,
        pxH: croppedImg.height,
        cropPx: crop,
        wIn: croppedImg.width * d.inPerPx,
        hIn: croppedImg.height * d.inPerPx,
        calibA: null,
        calibB: null,
      };
    });

    setIsCropping(false);
    cropDragRef.current = null;
    setCalibInlineOpen(false);
    setIsCalibrating(false);

  }

  function handleCropMouseDown(imgPt: Pt, tolPx: number) {
    if (!draft) return;

    const boundsW = draft.originalPxW;
    const boundsH = draft.originalPxH;

    const existing = draft.cropPx;
    const hit = existing ? hitCropHandle(imgPt, existing, tolPx) : null;

    if (existing && hit) {
      cropDragRef.current = {
        mode: hit,
        startPt: imgPt,
        startRect: existing,
      };
      return;
    }

    const fresh: CropRectPx = {
      x: imgPt.x,
      y: imgPt.y,
      w: 1,
      h: 1,
    };

    const clamped = clampCropRect(fresh, boundsW, boundsH);

    setDraft((d) => (d ? { ...d, cropPx: clamped } : d));
    cropDragRef.current = {
      mode: "new",
      startPt: imgPt,
      startRect: clamped,
    };
  }

  function handleCropMouseMove(imgPt: Pt) {
    if (!draft || !cropDragRef.current) return;

    const { mode, startPt, startRect } = cropDragRef.current;
    const boundsW = draft.originalPxW;
    const boundsH = draft.originalPxH;

    const dx = imgPt.x - startPt.x;
    const dy = imgPt.y - startPt.y;

    let next: CropRectPx;

    if (mode === "new") {
      next = normalizeCropRectFromCorners(startPt.x, startPt.y, imgPt.x, imgPt.y);
      next = clampCropRect(next, boundsW, boundsH);
    } else if (mode === "move") {
      next = moveCropRect(startRect, dx, dy, boundsW, boundsH);
    } else {
      next = resizeCropRect(startRect, mode, dx, dy, boundsW, boundsH);
    }

    setDraft((d) => (d ? { ...d, cropPx: next } : d));
  }

  function handleCropMouseUp() {
    cropDragRef.current = null;
  }
  return {
    assets,
    setAssets,
    selectedId,
    setSelectedId,
    selected,

    isPlacing,
    setIsPlacing,
    ghostWorld,
    setGhostWorld,

    isPreviewOpen,
    setIsPreviewOpen,
    draft,
    setDraft,

    fileInputRef,
    calibInputRef,
    pdfScaleInputRef,

    removeBgEnabled,
    tintColor,

    calibInlineOpen,
    setCalibInlineOpen,
    calibInputRaw,
    setCalibInputRaw,
    calibInputErr,
    setCalibInputErr,
    isCalibrating,
    setIsCalibrating,

    pdfScaleText,
    setPdfScaleText,
    pdfScaleErr,
    setPdfScaleErr,

    isCropping,

    openPreviewForNew,
    openPreviewForEdit,
    onPickFileInPreview,
    commitPdfScaleText,
    onDraftRotationChange,
    applyCalibrationFromPrompt,
    clearCalibrationPoints,
    startCalibration,
    beginPlacementFromPreview,
    commitPlacement,
    applyEditsToSelected,
    handleToggleRemoveBg,
    handlePickTint,
    beginCrop,
    cancelCrop,
    applyCrop,
    handleCropMouseDown,
    handleCropMouseMove,
    handleCropMouseUp,
  };
}
import React, {useRef, useEffect } from "react"
import { RAL } from "@/lib/modelspace/constants";
import type {Draft, Asset, Pt} from "@/lib/modelspace/types";
import { pointerAngleDeg } from "@/lib/modelspace/math";
import PreviewCanvas from "@/components/modelspace/PreviewCanvas"

type AssetEditorModalProps = {
  isOpen: boolean;
  selected: Asset | null;
  draft: Draft | null;

  calibInlineOpen: boolean;
  calibInputRaw: string;
  calibInputErr: string | null;

  pdfScaleText: string;
  pdfScaleErr: string | null;
  pdfScaleInputRef: React.RefObject<HTMLInputElement | null>;

  isCalibrating: boolean;
  isCropping: boolean;
  removeBgEnabled: boolean;
  tintColor: string;

  setDraft: (next: Draft) => void;

  setPdfScaleText: React.Dispatch<React.SetStateAction<string>>;
  setPdfScaleErr: React.Dispatch<React.SetStateAction<string | null>>;
  commitPdfScaleText:(raw: string) => boolean;

  onClose: () => void;

  setCalibInputRaw: React.Dispatch<React.SetStateAction<string>>;
  setCalibInputErr: React.Dispatch<React.SetStateAction<string | null>>;

  applyCalibrationFromPrompt: () => boolean;
  startCalibration: () => void;
  clearCalibrationPoints: () => void;
 
  beginCrop: () => void;
  cancelCrop: () => void;
  applyCrop: () => void;
  onDraftRotationChange: (deg: number) => void;
  handleToggleRemoveBg: (checked: boolean) => Promise<void> | void;
  handlePickTint: (color: string) => Promise<void> | void;
  
  applyEditsToSelected: () => void;
  beginPlacementFromPreview: () => void;

  calibInputRef: React.RefObject<HTMLInputElement | null>;

  handleCropMouseDown: (pt: Pt, tolPx: number) => void;
  handleCropMouseMove: (pt: Pt) => void;
  handleCropMouseUp: () => void;

  setCalibInlineOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCalibrating: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function AssetEditorModal({
  isOpen,
  selected,
  draft,
  calibInlineOpen,
  calibInputRaw,
  calibInputErr,
  pdfScaleText,
  pdfScaleErr,
  pdfScaleInputRef,
  isCalibrating,
  isCropping,
  removeBgEnabled,
  tintColor,
  setDraft,
  onClose,
  setCalibInputRaw,
  setCalibInputErr,
  applyCalibrationFromPrompt,
  clearCalibrationPoints,
  startCalibration,
  setPdfScaleText,
  setPdfScaleErr,
  commitPdfScaleText,
  beginCrop,
  cancelCrop,
  applyCrop,
  onDraftRotationChange,
  handleToggleRemoveBg,
  handlePickTint,
  applyEditsToSelected,
  beginPlacementFromPreview,
  calibInputRef,
  handleCropMouseDown,
  handleCropMouseMove,
  handleCropMouseUp,
  setCalibInlineOpen,
  setIsCalibrating,
  }: AssetEditorModalProps) {

  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const rotDragRef = useRef<{ startPointerAngleDeg: number; startRotationDeg: number; cx: number; cy: number;} | null>(null);

  useEffect(() => {
    autoGrowTextarea(titleRef.current);
  }, [draft?.meta.name]);

  useEffect(() => {
    if (draft?.source === "pdf") {
      setPdfScaleText(draft.scaleRaw ?? "1:1");
    }
  }, [draft?.fileName, draft?.source]);
  
  function onRotWidgetPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!draft) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startPointerAngle = pointerAngleDeg(e.clientX, e.clientY, cx, cy);

    rotDragRef.current = {
      startPointerAngleDeg: startPointerAngle,
      startRotationDeg: draft.rotationDeg,
      cx,
      cy,
    };
  }

  function onRotWidgetPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draft || !rotDragRef.current) return;
    const { startPointerAngleDeg, startRotationDeg, cx, cy } = rotDragRef.current;
    const currentPointerAngleDeg = pointerAngleDeg(e.clientX, e.clientY, cx, cy);
    const delta = currentPointerAngleDeg - startPointerAngleDeg;
    onDraftRotationChange(startRotationDeg - delta);
  }

  function onRotWidgetPointerUp() {
    rotDragRef.current = null;
  }

  function autoGrowTextarea(el: HTMLTextAreaElement | null) {
    if (!el) return;

    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const maxHeight = lineHeight * 5;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        // click outside closes if not calibrating
        if (e.target === e.currentTarget) onClose();
      }}  
    >
      <div
        style={{
          width: "min(1400px, calc(100vw - 32px))",
          height: "min(900px, calc(100vh - 32px))",
          background: RAL.white,
          borderRadius: "3px",
          border: `1px solid ${RAL.grey}`,
          boxShadow: "0 20px 70px rgba(0,0,0,0.25)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) min(420px, 28vw)",
        }}
      >
        <PreviewCanvas
          isOpen={isOpen}
          draft={draft}
          setDraft={setDraft}
          calibInputRef={calibInputRef}
          isCropping={isCropping}
          handleCropMouseDown={handleCropMouseDown}
          handleCropMouseMove={handleCropMouseMove}
          handleCropMouseUp={handleCropMouseUp}
          calibInlineOpen={calibInlineOpen}
          setCalibInlineOpen={setCalibInlineOpen}
          isCalibrating={isCalibrating}
          setIsCalibrating={setIsCalibrating}
          calibInputRaw={calibInputRaw}
          setCalibInputRaw={setCalibInputRaw}
          calibInputErr={calibInputErr}
          setCalibInputErr={setCalibInputErr}
          applyCalibrationFromPrompt={applyCalibrationFromPrompt}
          clearCalibrationPoints={clearCalibrationPoints} />

        {/* Inspector */}
        <div className="asset-inspector">
          <div className="asset-close">
            <div onClick={onClose} className={"link-secondary asset-close"}>
              CLOSE
            </div>
          </div>

          {draft && (
            <>
              <div className="asset-field">
                <div className={"info"}>TITLE</div>
                <textarea
                  ref={titleRef}
                  className={"title-input"}
                  rows={2}
                  value={draft.meta.name ?? ""}
                  onInput={(e) => autoGrowTextarea(e.currentTarget)}
                  onFocus={(e) => autoGrowTextarea(e.currentTarget)}
                  onChange={(e) => 
                    setDraft({ ...draft, meta: { ...draft.meta, name: e.target.value } })
                  }
                  onBlur={() => {
                  const trimmed = (draft.meta.name ?? "").trim();
                  const fallback = draft.fileName.replace(/\.[^/.]+$/, "");
                    setDraft({
                       ...draft, 
                       meta: { ...draft.meta, name: trimmed || fallback } 
                    });
                  }}
                />
              </div>

              <div className={"asset-field"}>
                <label className={"info"}>
                  DESCRIPTION
                </label>
                <textarea
                  className={"desc-input"}
                  rows={2}
                  placeholder=" . . . "
                  value={draft.meta.desc ?? ""}
                  onInput={(e) => autoGrowTextarea(e.currentTarget)}
                  onFocus={(e) => autoGrowTextarea(e.currentTarget)}
                  onChange={(e) => 
                    setDraft({ ...draft, meta: { ...draft.meta, desc: e.target.value } })
                  }
                />
              </div>
                
              <div className="asset-section">
                <div className="info">{draft.pxW}×{draft.pxH}px</div>
                <div className="scale-row">
                  <div className="info">SCALE:</div>
                  {draft.source === "pdf" ? (
                    <div>
                      <input
                        ref={pdfScaleInputRef}
                        className={`scale-input ${draft.isCalibrated ? "active" : ""}`}
                        value={pdfScaleText}
                        onChange ={(e) => {
                          setPdfScaleText(e.target.value);
                          setPdfScaleErr(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const ok = commitPdfScaleText(pdfScaleText);
                            if (ok) pdfScaleInputRef.current?.blur();
                          } 
                          else if (e.key === "Escape") {
                            e.preventDefault();
                            setPdfScaleText(draft.scaleRaw ?? "1:1");
                            setPdfScaleErr(null);
                            pdfScaleInputRef.current?.blur();
                          }
                        }}
                        placeholder="1:1"
                      />
                      {!draft.isCalibrated && (
                        <div className={"info error"}>NOT CALIBRATED</div>
                      )}
                    </div>
                  ) : (
                  <div className={`info ${!draft.isCalibrated ? "error" : ""}`}>
                    {!draft.isCalibrated ? "NOT CALIBRATED" : `1 in = ${(1 / draft.inPerPx).toFixed(2)} px`}
                  </div>
                  )}
                </div>
              
                {draft.source === "pdf" && pdfScaleErr && (
                  <div className="info error">{pdfScaleErr}</div>
                )}
                <div className="asset-row">
                    <div 
                    onClick={!draft || isCropping ? undefined : startCalibration} 
                    aria-disabled={!draft || isCropping}
                    className={`link-secondary ${isCalibrating ? "active" : ""}`} 
                    >
                    CALIBRATE
                  </div>

                  {isCalibrating && (
                    <>
                    <div className={"info"}>
                      Click on two points in the preview.
                    </div>
                    <div onClick={clearCalibrationPoints} className={"link-secondary"}>
                    CLEAR
                    </div>
                    </>
                  )}
                </div>
              </div>
              <div className="asset-row">
                  <div 
                    className={`link-secondary ${isCropping ? "active" : ""}`} 
                    onClick={draft && !isCropping ? beginCrop : undefined}
                    aria-disabled={!draft || isCalibrating}
                  >
                    CROP
                  </div>

                {isCropping && (
                  <>
                  <div className={"link-secondary"} onClick={cancelCrop}>
                    CANCEL
                  </div>
                  <div 
                    className={"link-secondary"} 
                    onClick={async () => { 
                      void applyCrop();
                      if (removeBgEnabled) {
                        await handleToggleRemoveBg(true);
                      }
                    }}>
                    APPLY CROP
                  </div>
                  </>
                )}
                </div>
              <div className={"asset-row remove-bg-row"}>
                <div
                  className={`link-secondary ${removeBgEnabled ? "active" : ""} ${isCropping || isCalibrating ? "disabled" : ""}`}
                  onClick={() => void handleToggleRemoveBg(!removeBgEnabled)}
                >
                  REMOVE BACKGROUND
                </div>

                {removeBgEnabled && (
                  <div className={"color-chip-row-inline"}>
                    {[
                      ["Yellow", RAL.yellow],
                      ["Orange", RAL.orange],
                      ["Red", RAL.red],
                      ["Purple", RAL.purple],
                      ["Blue", RAL.blue],
                      ["Green", RAL.green],
                      ["Black", RAL.black],
                    ].map(([label, color]) => {
                      const selected = tintColor === color;
                      return (
                        <button
                          key={label}
                          type="button"
                          title={label}
                          className={`color-chip ${selected ? "active" : ""}`}
                          style={{ "--chip-color": color } as React.CSSProperties}
                          onClick={() => {
                            void handlePickTint(color as string);
                          }}
                         />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="rotation-row">
                  <div
                    className="north-arrow"
                    onPointerDown={onRotWidgetPointerDown}
                    onPointerMove={onRotWidgetPointerMove}
                    onPointerUp={onRotWidgetPointerUp}
                    onPointerCancel={onRotWidgetPointerUp}
                    title="drag to rotate"
                    >
                    <svg viewBox="0 0 100 100" width={60} height={60} style={{ overflow: "visible" }}>
                      <circle cx="50" cy="50" r="35" fill="none" stroke={RAL.black} strokeWidth={1} />
                      <g transform={`rotate(${-draft.rotationDeg} 50 50)`}>
                        <line x1="15" y1="50" x2="85" y2="50" stroke={RAL.black} strokeWidth={1} />
                        <line x1="50" y1="50" x2="50" y2="85" stroke={RAL.black} strokeWidth={1} />
                        <line x1="50" y1="15" x2="50" y2="50" stroke={RAL.black} strokeWidth={3} strokeLinecap="butt" />
                        <text 
                          x="50" 
                          y="8" 
                          textAnchor="middle" 
                          className="header"
                          transform={`rotate(${draft.rotationDeg} 50 3)`}
                        >
                          N
                        </text>
                       </g>
                     </svg> 
                   </div>
                   {Math.abs(draft.rotationDeg) > 0.01 && (
                    <div className="rotation-reset">
                      <div className="link-secondary" onClick={() => onDraftRotationChange(0)}>
                        RESET
                      </div>
                    </div>
                   )}
                 </div>
              <div className="asset-action-right">
                <div
                  onClick={ !draft || calibInlineOpen
                    ? undefined
                    : () => {
                    if (selected) {
                      applyEditsToSelected();
                    } else {
                      beginPlacementFromPreview();
                    }
                  }}
                  className="link-primary"
                  aria-disabled={!draft || calibInlineOpen}
                  title={calibInlineOpen ? "Finish calibration first" : ""}
                >
                  {selected ? "APPLY EDITS" : "PLACE"}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
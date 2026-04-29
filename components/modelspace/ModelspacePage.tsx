"use client";

import MainCanvas from "@/components/modelspace/MainCanvas";
import AssetEditorModal from "@/components/modelspace/AssetEditorModal";
import { useModelspaceState } from "@/hooks/useModelspaceState";

type ModelspacePageProps = {
  profileId: string;
  workspaceId: string;
};

export default function ModelspacePage({
  profileId,
  workspaceId,
}: ModelspacePageProps) {
  const state = useModelspaceState({
    profileId,
    workspaceId,
  });

  return (
    <>
      <MainCanvas
        assets={state.assets}
        selected={state.selected}
        selectedId={state.selectedId}
        draft={state.draft}
        isPlacing={state.isPlacing}
        ghostWorld={state.ghostWorld}
        setGhostWorld={state.setGhostWorld}
        fileInputRef={state.fileInputRef}
        onPickFileInPreview={state.onPickFileInPreview}
        commitPlacement={state.commitPlacement}
        setSelectedId={state.setSelectedId}
        setAssets={state.setAssets}
        openPreviewForNew={state.openPreviewForNew}
        openPreviewForEdit={state.openPreviewForEdit}
      />

      <AssetEditorModal
        isOpen={state.isPreviewOpen}
        selected={state.selected}
        draft={state.draft}
        calibInlineOpen={state.calibInlineOpen}
        calibInputRaw={state.calibInputRaw}
        calibInputErr={state.calibInputErr}
        pdfScaleText={state.pdfScaleText}
        pdfScaleErr={state.pdfScaleErr}
        pdfScaleInputRef={state.pdfScaleInputRef}
        isCalibrating={state.isCalibrating}
        isCropping={state.isCropping}
        removeBgEnabled={state.removeBgEnabled}
        tintColor={state.tintColor}
        setDraft={state.setDraft}
        setPdfScaleText={state.setPdfScaleText}
        setPdfScaleErr={state.setPdfScaleErr}
        commitPdfScaleText={state.commitPdfScaleText}
        onClose={() => {
          state.setIsPreviewOpen(false);
          state.setDraft(null);
          state.setCalibInlineOpen(false);
        }}
        setCalibInputRaw={state.setCalibInputRaw}
        setCalibInputErr={state.setCalibInputErr}
        applyCalibrationFromPrompt={state.applyCalibrationFromPrompt}
        startCalibration={state.startCalibration}
        clearCalibrationPoints={state.clearCalibrationPoints}
        beginCrop={state.beginCrop}
        cancelCrop={state.cancelCrop}
        applyCrop={state.applyCrop}
        onDraftRotationChange={state.onDraftRotationChange}
        handleToggleRemoveBg={state.handleToggleRemoveBg}
        handlePickTint={state.handlePickTint}
        applyEditsToSelected={state.applyEditsToSelected}
        beginPlacementFromPreview={state.beginPlacementFromPreview}
        calibInputRef={state.calibInputRef}
        handleCropMouseDown={state.handleCropMouseDown}
        handleCropMouseMove={state.handleCropMouseMove}
        handleCropMouseUp={state.handleCropMouseUp}
        setCalibInlineOpen={state.setCalibInlineOpen}
        setIsCalibrating={state.setIsCalibrating}
      />
    </>
  );
}
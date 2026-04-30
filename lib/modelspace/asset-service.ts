import { createClient } from "@/lib/supabase/client";
import type { Draft } from "@/lib/modelspace/types";

type SaveAssetArgs = {
  draft: Draft;
  profileId: string;
  workspaceId: string;
  x: number;
  y: number;
};

function extFromFileName(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "bin";
}

async function dataUrlToBlob(dataUrl: string) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export async function savePlacedAsset({
  draft,
  profileId,
  workspaceId,
  x,
  y,
}: SaveAssetArgs) {
  if (!draft.file) {
    throw new Error("No source file found on draft.");
  }

  const supabase = createClient();

  const assetId = crypto.randomUUID();
  const originalExt = extFromFileName(draft.fileName);

  const originalPath = `${profileId}/${assetId}/original.${originalExt}`;
  const visiblePath = `${profileId}/${assetId}/visible.png`;

  const originalUpload = await supabase.storage
    .from("asset-files")
    .upload(originalPath, draft.file, {
      upsert: false,
      contentType: draft.file.type,
    });

  if (originalUpload.error) throw originalUpload.error;

  const visibleBlob = await dataUrlToBlob(draft.dataUrl);

  const visibleUpload = await supabase.storage
    .from("asset-files")
    .upload(visiblePath, visibleBlob, {
      upsert: false,
      contentType: "image/png",
    });

  if (visibleUpload.error) throw visibleUpload.error;

  const inserted = await supabase 
    .from ("assets")
    .insert({
      id:assetId,
      workspace_id: workspaceId,
      owner_profile_id: profileId,

      file_name: draft.fileName,
      file_path: visiblePath,
      original_file_path: originalPath,

      title: draft.meta?.name ?? null,
      description: draft.meta?.desc ?? null,
      source: draft.source,

      px_w: draft.pxW,
      px_h: draft.pxH,
      original_px_w: draft.originalPxW,
      original_px_h: draft.originalPxH,

      crop_px: draft.cropPx,
      in_per_px: draft.inPerPx,
      base_in_per_px: draft.baseInPerPx ?? null,
      scale_raw: draft.scaleRaw ?? null,
      w_in: draft.wIn,
      h_in: draft.hIn,

      x,
      y,
      rotation_deg: draft.rotationDeg,

      bg_removed: draft.bgRemoved ?? false,
      tint_color: draft.tintColor ?? null,
    })
    .select("*")
    .single();

  if (inserted.error) throw inserted.error;

  return {
    row: inserted.data,
    filePath: visiblePath,
    originalFilePath: originalPath,
  };
}
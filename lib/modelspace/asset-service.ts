import { createClient } from "@/lib/supabase/client";
import type { Asset, Draft } from "@/lib/modelspace/types";

type SaveAssetArgs = {
  draft: Draft;
  profileId: string;
  workspaceId: string;
  x: number;
  y: number;
};

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

  const ext = draft.fileName.split(".").pop() || "bin";
  const storagePath = `${profileId}/${crypto.randomUUID()}.${ext}`;

  const upload = await supabase.storage
    .from("asset-files")
    .upload(storagePath, draft.file, {
      upsert: false,
      contentType: draft.file.type,
    });

  if (upload.error) throw upload.error;

  const row = {
    workspace_id: workspaceId,
    owner_profile_id: profileId,

    file_name: draft.fileName,
    file_path: storagePath,
    original_file_path: storagePath,

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
  };

  const inserted = await supabase
    .from("assets")
    .insert(row)
    .select("*")
    .single();

  if (inserted.error) throw inserted.error;

  return {
    dbAsset: inserted.data,
    storagePath,
  };
}
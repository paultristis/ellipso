export type Camera = {
  x: number; // stage position in px
  y: number; // stage position in px
  scale: number; // px per world unit (in)
};

export type Pt = { x: number; y: number };
export type CropRectPx = { x: number; y: number; w: number; h: number }; // in image pixels, origin at top-left of image
export type SourceKind = "image" | "pdf";

export type Draft = {
  fileName: string;
  dataUrl: string;
  img: HTMLImageElement;
  pxW: number;
  pxH: number;
  originalDataUrl: string;
  originalImg: HTMLImageElement;
  originalPxW: number;
  originalPxH: number;
  cropPx: CropRectPx | null;
  source: SourceKind;
  inPerPx: number; // inches per pixel
  baseInPerPx?: number; // for PDFs, the inPerPx derived from PDF geometry
  scaleRaw?: string;
  isCalibrated: boolean;
  wIn: number;
  hIn: number;
  rotationDeg: number; // relative to north
  bgRemoved?: boolean;
  tintColor?: string | null;
  meta: {
  name?: string;
  desc?: string;
  uploadedBy?: string;
  date?: string;
    };
  // calibration points in image pixel space
  calibA: Pt | null;
  calibB: Pt | null;
  file?: File;
};

export type Asset = {
  id: string;
  fileName: string;
  dataUrl: string;
  workspace_id: string;
  owner_profile_id: string;
  img: HTMLImageElement;
  pxW: number;
  pxH: number;
  originalDataUrl: string;
  originalImg: HTMLImageElement;
  originalPxW: number;
  originalPxH: number;
  cropPx: CropRectPx | null;
  source: SourceKind;
  inPerPx: number;
  baseInPerPx?: number;
  scaleRaw?: string;
  wIn: number;
  hIn: number;
  x: number; // center in inches
  y: number; // center in inches
  rotationDeg: number; // relative to north
  bgRemoved?: boolean;
  tintColor?: string | null;
  meta: {
  name?: string;
  desc?: string;
  uploadedBy?: string;
  date?: string;
    };
};

// from database
export type AssetRow = {
  id: string;
  file_name: string;
  file_path: string;
  original_file_path: string | null;
  title: string | null;
  description: string | null;
  source: "image" | "pdf";
  px_w: number;
  px_h: number;
  original_px_w: number;
  original_px_h: number;
  crop_px: CropRectPx | null;
  in_per_px: number;
  base_in_per_px: number | null;
  scale_raw: string | null;
  w_in: number;
  h_in: number;
  x: number;
  y: number;
  rotation_deg: number;
  bg_removed: boolean;
  tint_color: string | null;
};

// browser/canvas version
export type CanvasAsset = AssetRow & {
  img: HTMLImageElement;
  originalImg: HTMLImageElement;
};


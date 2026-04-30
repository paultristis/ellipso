import type { Draft } from "@/lib/modelspace/types";

export async function loadFileAsImage(file: File): Promise<{ img: HTMLImageElement; dataUrl: string; pxW: number; pxH: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => resolve({ img, dataUrl, pxW: img.width, pxH: img.height });
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

  return img;
}

export async function loadPdfFirstPageAsImage(
  file: File,
  opts?: { dpi?: number; pageNumber?: number }
): Promise<{
  img: HTMLImageElement;
  dataUrl: string;
  pxW: number;
  pxH: number;
  // physical page size (inches) derived from PDF geometry
  pageWIn: number;
  pageHIn: number;
}> {
  const dpi = opts?.dpi ?? 300;     
  const pageNumber = opts?.pageNumber ?? 1;

  const pdfjs = await import("pdfjs-dist");
  // @ts-ignore: worker module has no type declarations in this project
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  // PDF units: points. viewport@scale=1 gives size in points.
  const vpPts = page.getViewport({ scale: 1 });
  const pageWIn = vpPts.width / 72;
  const pageHIn = vpPts.height / 72;

  // Render scale from desired DPI: dpi/72 since 72pt per inch
  const renderScale = dpi / 72;
  const vp = page.getViewport({ scale: renderScale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(vp.width));
  canvas.height = Math.max(1, Math.floor(vp.height));

  const ctx = canvas.getContext("2d", { alpha: true});
  if (!ctx) throw new Error("Failed to get canvas 2D context");

  await page.render({ canvas, viewport: vp }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load rendered PDF image"));
    img.src = dataUrl;
  });

  return { img, dataUrl, pxW: img.width, pxH: img.height, pageWIn, pageHIn };
}

export async function makeImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load cropped image"));
        img.src = dataUrl;
    });
    return img;
}

export function hexToRgb(hex: string) {
    const clean = hex.replace("#", "");
    const full =
      clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;

    const num = parseInt(full, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }
  
export async function rebuildDraftBitmapFromOriginal(
  d: Draft,
  opts: {
    removeBgEnabled: boolean;
    tintColor: string;
    whiteCutoff?: number;
    alphaGamma?: number;
  }
): Promise<{
  dataUrl: string;
  img: HTMLImageElement;
  pxW: number;
  pxH: number;
}> {
  const whiteCutoff = opts.whiteCutoff ?? 245;
  const alphaGamma = opts.alphaGamma ?? 1.0;

  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = d.originalPxW;
  fullCanvas.height = d.originalPxH;

  const fullCtx = fullCanvas.getContext("2d");
  if (!fullCtx) throw new Error("Could not get 2D context");

  fullCtx.clearRect(0, 0, fullCanvas.width, fullCanvas.height);
  fullCtx.drawImage(d.originalImg, 0, 0, d.originalPxW, d.originalPxH);

  if (opts.removeBgEnabled) {
    const { r: tintR, g: tintG, b: tintB } = hexToRgb(opts.tintColor);
    const imageData = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const srcR = data[i];
      const srcG = data[i + 1];
      const srcB = data[i + 2];
      const srcA = data[i + 3];

      if (srcA === 0) continue;

      const lum = 0.2126 * srcR + 0.7152 * srcG + 0.0722 * srcB;

      // White -> alpha 0
      // Black -> alpha 1
      // Antialiased edge grays -> fractional alpha
      let alpha01 = clamp01((whiteCutoff - lum) / whiteCutoff);

      // Slight curve to keep linework crisp but still feather edges
      alpha01 = Math.pow(alpha01, alphaGamma);

      // Respect any source alpha too
      alpha01 *= srcA / 255;

      const outA = Math.round(alpha01 * 255);

      if (outA <= 0) {
        data[i + 3] = 0;
        continue;
      }

      // Important: use pure tint RGB, and encode softness in alpha only.
      // This prevents gray halos.
      data[i] = tintR;
      data[i + 1] = tintG;
      data[i + 2] = tintB;
      data[i + 3] = outA;
    }

    fullCtx.putImageData(imageData, 0, 0);
  }

  let outCanvas = fullCanvas;

  if (d.cropPx) {
    const crop = d.cropPx;
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = Math.max(1, Math.round(crop.w));
    croppedCanvas.height = Math.max(1, Math.round(crop.h));

    const croppedCtx = croppedCanvas.getContext("2d");
    if (!croppedCtx) throw new Error("Could not get cropped 2D context");

    croppedCtx.clearRect(0, 0, croppedCanvas.width, croppedCanvas.height);
    croppedCtx.drawImage(
      fullCanvas,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      0,
      0,
      croppedCanvas.width,
      croppedCanvas.height
    );

    outCanvas = croppedCanvas;
  }

  const dataUrl = outCanvas.toDataURL("image/png");
  const img = await makeImageFromDataUrl(dataUrl);

  return {
    dataUrl,
    img,
    pxW: img.width,
    pxH: img.height,
  };
}

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function stripExt(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}
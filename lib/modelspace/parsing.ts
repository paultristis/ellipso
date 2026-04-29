
export function formatImperialFromInches(inches: number) {
  if (inches < 12) return `${inches.toFixed(inches < 1 ? 2 : 1)} in`;
  const feet = inches / 12;
  return `${feet.toFixed(feet < 10 ? 2 : 1)} ft`;
}

export function formatScale1toX(ratio: number): string {
  if (!isFinite(ratio) || ratio <= 0) return "1:1"; 
  const roundedInt = Math.round(ratio); 
  if (Math.abs(ratio - roundedInt) < 0.01) return `1:${roundedInt}`;
  return `1:${ratio.toFixed(2)}`;
}

export function parseDistanceToInches(raw: string): { inches: number } | { error: string } {
  const s0 = (raw ?? "").trim();
  if (!s0) return { error: "Enter a distance." };

  // Normalize: lowercase, remove commas, collapse spaces
  const s = s0.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();

  // 1) Metric: cm / m
  // examples: "180cm", "180 cm", "1.8m", "1.8 m"
  const mMetric = s.match(/^([+-]?\d*\.?\d+)\s*(cm|m)$/);
  if (mMetric) {
    const val = Number(mMetric[1]);
    if (!isFinite(val)) return { error: "Invalid number." };
    const unit = mMetric[2];
    const inches = unit === "cm" ? val / 2.54 : (val * 100) / 2.54;
    if (inches <= 0) return { error: "Distance must be > 0." };
    return { inches };
  }

  // 2) Feet/Inches: support a bunch of common forms
  // - 6'2"   6' 2"   6ft 2in   6 ft 2 in
  // - 6'     2"      74" / 74in
  // Also handle weird user ordering like 0" 6' (we'll still catch inches-only or feet-only)
  let feet: number | null = null;
  let inchesPart: number | null = null;

  // feet
  const mFt = s.match(/([+-]?\d*\.?\d+)\s*(?:ft|feet|')/);
  if (mFt) {
    feet = Number(mFt[1]);
    if (!isFinite(feet)) return { error: "Invalid feet value." };
  }

  // inches
  const mIn = s.match(/([+-]?\d*\.?\d+)\s*(?:in|inch|inches|")/);
  if (mIn) {
    inchesPart = Number(mIn[1]);
    if (!isFinite(inchesPart)) return { error: "Invalid inches value." };
  }

  // If we found any ft/in markers, compute from them
  if (feet !== null || inchesPart !== null) {
    const total = (feet ?? 0) * 12 + (inchesPart ?? 0);
    if (total <= 0) return { error: "Distance must be > 0." };
    return { inches: total };
  }

  // 3) Plain number -> inches (default)
  // examples: "36", "36.25"
  if (/^[+-]?\d*\.?\d+$/.test(s)) {
    const val = Number(s);
    if (!isFinite(val)) return { error: "Invalid number." };
    if (val <= 0) return { error: "Distance must be > 0." };
    return { inches: val };
  }

  return {
    error: `Couldn't parse "${raw}". Try in, ft, cm, or m.`,
  };
}

export function parseFractionNumber(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const mMixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/); // mixed fraction, e.g. "1 1/2"
  if (mMixed) {
    const whole = Number(mMixed[1]);
    const num = Number(mMixed[2]);
    const den = Number(mMixed[3]);
    if (!isFinite(whole) || !isFinite(num) || !isFinite(den) || den === 0) return null;
    return whole + num / den;
  }
  const mFrac = t.match(/^(\d+)\/(\d+)$/); // simple fraction, e.g. "3/4"
  if (mFrac) {
    const num = Number(mFrac[1]);
    const den = Number(mFrac[2]);
    if (!isFinite(num) || !isFinite(den) || den === 0) return null;
    return num / den;
  }

  if (/^[+-]?\d*\.?\d+$/.test(t)) {
    const val = Number(t);
    return isFinite(val) ? val : null;
  }
  return null;
}

export function parseImperialLenWithFractionsToInches(raw: string): { inches: number } | { error: string } {
  const s0 = (raw ?? "").trim();
  if (!s0) return { error: "Enter length." };
  const s = s0.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();

  let feet = 0;
  const mFt = s.match(/(\d+)\s*(?:ft|feet|')/);
  if (mFt) feet = Number(mFt[1]);

  let inches = 0;
  const mIn = s.match(/([\d.\s\/]+)\s*(?:in|inch|inches|")/);
  if (mIn) {
    const val = parseFractionNumber(mIn[1]);
    if (val === null) return { error: `Couldn't parse inches: "${mIn[1]}"` };
    inches = val;
  }
  if (!mFt && !mIn) {
    const val= parseFractionNumber(s);
    if (val === null) return { error: `Couldn't parse length: "${raw}"` };
    inches = val;
  }
  const total = feet * 12 + inches;
  if (!(total > 0)) return { error: "Length must be > 0." };
  return { inches: total };
}

export function parsePdfScale(raw: string): {ratio: number } | { error: string } {
  const s0 = (raw ?? "").trim();
  if (!s0) return { ratio: 1 }; // default to 1:1 if empty
  const s = s0.replace(/[“”]/g, '"').replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
  const mRatio = s.match(/^(\d*\.?\d+)\s*:\s*(\d*\.?\d+)$/);
  if (mRatio) {
    const a = Number(mRatio[1]);
    const b = Number(mRatio[2]);
    if (!isFinite(a) || !isFinite(b) || a <= 0 || b <= 0) return { error: "Invalid ratio" };
    return { ratio: b / a };
  }

  const parts = s.split("=");
  if (parts.length === 2) {
    const left = parseImperialLenWithFractionsToInches(parts[0]);
    if ("error" in left) return { error: left.error };
    const right = parseImperialLenWithFractionsToInches(parts[1]);
    if ("error" in right) return { error: right.error };
    const ratio = right.inches / left.inches;
    if (!(ratio > 0) || !isFinite(ratio)) return { error: "Invalid scale." };
    return { ratio };
  }
  return { error: `Couldn't parse "${raw}"` };
}
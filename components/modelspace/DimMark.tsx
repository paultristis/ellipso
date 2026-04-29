import { Line, Group } from "react-konva";

type DimMarkProps = {
  x: number;
  y: number;
  angleRad: number;     // rotation to align with segment direction
  size: number;         // in world px (you’ll pass ~10 / pCam.scale)
  stroke: string;
  strokeWidth: number;
  flip?: boolean;
};

export default function DimMark({
  x,
  y,
  angleRad,
  size,
  stroke,
  strokeWidth,
  flip = false,
  }: DimMarkProps) {

  // Cross size
  const half = size * 0.9;

  // 45° tick length
  const tickLen = size * 1.2;

  // We'll draw in local coords around (0,0), then position/rotate with Group.
  // Rotation in Konva Group is in DEGREES.
  const rotDeg = (angleRad * 180) / Math.PI;

  // 45° tick in local coords (from -tickLen/2 to +tickLen/2)
  const t = tickLen / 2;
  const dir = flip ? -1 : 1;

  return (
    <Group x={x} y={y} rotation={rotDeg} listening={false}>
      {/*inline */}
      <Line points={[0, 0, dir *half, 0]} stroke={stroke} strokeWidth={strokeWidth} />
      {/*crossline*/}
      <Line points={[0, -half, 0, half]} stroke={stroke} strokeWidth={strokeWidth} />
      {/* 45° tick */}
      <Line points={[-t, -t, t, t]} stroke={stroke} strokeWidth={2 * strokeWidth} />
    </Group>
  );
}
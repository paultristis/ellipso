import type { Asset } from "@/lib/modelspace/types";

type AssetInspectorProps = {
  selected: Asset | null;
  selectedPanelPos: { left: number; top: number } | null;
  onEdit: (asset: Asset) => void;
};

function stripExt(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

export default function AssetInspector({ 
  selected, 
  selectedPanelPos, 
  onEdit 
}: AssetInspectorProps) {
  if (!selected || !selectedPanelPos) return null;

  return (
    <div
      className="asset-popup"
      style={{
        left: selectedPanelPos.left,
        top: selectedPanelPos.top,
      }}
    >
      <div>
        <div className={"info"}>TITLE</div>
        <div className="asset-read-title">
          {selected.meta?.name?.trim() || stripExt(selected.fileName)}
        </div>
      </div>

      <div className="asset-field"> 
        <div className="info">DESCRIPTION</div>
        <div className="asset-read-text">
          {selected.meta?.desc?.trim() || "—"}
        </div>
      </div>

      <div className="asset-field">
        <div className={"info"}>UPLOADED BY</div>
        <div className="asset-read-text">
          {selected.meta?.uploadedBy?.trim() || "—"}
        </div>
      </div>

      <div className="asset-field">
        <div className={"info"}>DATE</div>
        <div className="asset-read-text">
          {selected.meta?.date?.trim() || "—"}
        </div>
      </div>

      <div className="asset-action-right">
        <div onClick={() => onEdit(selected)} className={"link-primary"}>
          EDIT
        </div>
      </div>
    </div>
  );
}
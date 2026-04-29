// Colors
export const RAL = {
  yellow: "#f4c300", //1023 Traffic Yellow
  orange: "#f75e25", //2009 Traffic Orange
  red: "#c1121c", //3020 Traffic Red
  purple: "#903372", //4006 Traffic Purple
  blue: "#0057b8", //5005 Signal Blue
  green: "#008f39", //6024 Traffic Green
  white: "#fbfbf7", //9016 Traffic White 
  black: "#2a292a", //9005 Traffic Black
  grey: "#9b9b9b", //9003 Traffic Grey
};

export function btnStyle(primary = false, overrides?: React.CSSProperties): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: "0.5em",
    border: primary ? `1px solid ${RAL.blue}` : `1px solid ${RAL.grey}`,
    background: primary ? RAL.blue : "transparent",
    color: primary ? RAL.white : RAL.blue,
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
  };
}
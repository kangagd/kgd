export const GST_RATE = 0.10;
export const GST_MODE = "EXCLUSIVE";

// Standard helper text for all pricing fields
export const GST_HELPER_TEXT = "All prices in KangarooGD are GST exclusive";
export const GST_TOOLTIP = "All figures shown are GST exclusive unless otherwise stated";

export function exToGstAmount(ex) {
  if (!ex || isNaN(ex)) return 0;
  return Number((ex * GST_RATE).toFixed(2));
}

export function exToInc(ex) {
  if (!ex || isNaN(ex)) return 0;
  return Number((ex * (1 + GST_RATE)).toFixed(2));
}

export function incToEx(inc) {
  if (!inc || isNaN(inc)) return 0;
  return Number((inc / (1 + GST_RATE)).toFixed(2));
}
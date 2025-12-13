export const GST_RATE = 0.10;

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
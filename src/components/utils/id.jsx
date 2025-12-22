export const toId = (v) => (v === null || v === undefined) ? '' : String(v);

export const sameId = (a,b) => toId(a) !== '' && toId(a) === toId(b);

export const safeId = (v) => toId(v).trim();
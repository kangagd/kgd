export const DEV_LOG = import.meta.env?.DEV ?? false;

export const devLog = (...args) => DEV_LOG && console.log(...args);
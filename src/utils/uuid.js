import { randomUUID } from 'node:crypto';

/** Generate a RFC4122 v4 UUID. */
export const newUuid = () => randomUUID();

const RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** @param {string} v */
export const isUuid = (v) => typeof v === 'string' && RE.test(v);

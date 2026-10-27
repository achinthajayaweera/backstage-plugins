export type Row = Record<string, any>;

export function getPath(row: Row, path: string): any {
  let cur: any = row;
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object')
      return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Output column name for an aggregate "by" field: explicit alias, else last path segment. */
export const outName = (field: string, as?: string) =>
  as ?? field.split('.').pop()!;

const UNIT_MS: Record<string, number> = {
  m: 60e3,
  h: 3600e3,
  d: 86400e3,
  w: 7 * 86400e3,
};
export function agoToMs(ago: string): number {
  return parseInt(ago, 10) * UNIT_MS[ago[ago.length - 1]];
}

/** Compile-time exhaustiveness check; throws if an unvalidated value slips through at runtime. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}

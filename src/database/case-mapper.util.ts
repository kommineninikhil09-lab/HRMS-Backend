/**
 * Converts a Postgres row (snake_case columns) into a camelCase-keyed object
 * matching the shape of our TypeScript domain interfaces.
 *
 * This is a SHALLOW transformation only — it renames top-level keys and does
 * NOT recurse into nested values. JSONB columns (e.g. audit_logs.old_value)
 * store arbitrary application data that is already camelCase at the JS layer
 * and must be preserved exactly as stored.
 */
export function toCamelCaseRow<T = any>(row: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_match, char: string) =>
      char.toUpperCase(),
    );
    result[camelKey] = row[key];
  }
  return result as T;
}

export function toCamelCaseRows<T = any>(rows: Record<string, any>[]): T[] {
  return rows.map((row) => toCamelCaseRow<T>(row));
}

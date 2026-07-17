import type { FieldSchema, FormValues } from './schema';

/** Fields without `visibleWhen` are always visible. Equality is strict (`===`). */
export function isFieldVisible(field: FieldSchema, values: FormValues): boolean {
  if (!field.visibleWhen) {
    return true;
  }
  const { field: dependency, equals } = field.visibleWhen;
  return values[dependency] === equals;
}

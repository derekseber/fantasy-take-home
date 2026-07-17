import type { ComponentType } from 'react';

import type { FieldSchema } from './schema';
import { isBuiltinFieldType } from './schema';

export type FieldComponentProps = {
  field: FieldSchema;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
};

export type FieldComponent = ComponentType<FieldComponentProps>;

const registry = new Map<string, FieldComponent>();

/**
 * Registers (or replaces) a field renderer for a type string.
 * Soft-warns when replacing a known built-in type; does not hard-reject.
 */
export function registerFieldType(
  type: string,
  component: FieldComponent,
): { warned: boolean } {
  let warned = false;
  if (isBuiltinFieldType(type) && registry.has(type)) {
    console.warn(
      `[form-engine] Replacing built-in field type "${type}" via registerFieldType`,
    );
    warned = true;
  }
  registry.set(type, component);
  return { warned };
}

export function unregisterFieldType(type: string): boolean {
  return registry.delete(type);
}

export function getFieldType(type: string): FieldComponent | undefined {
  return registry.get(type);
}

export function clearRegistry(): void {
  registry.clear();
}

export function listRegisteredTypes(): string[] {
  return [...registry.keys()];
}

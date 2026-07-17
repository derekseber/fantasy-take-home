import { DateField } from './fields/DateField';
import { MultiSelectField } from './fields/MultiSelectField';
import { SelectField } from './fields/SelectField';
import { TextField } from './fields/TextField';
import { registerFieldType } from './registry';

let builtinsRegistered = false;

/** Registers built-in field types on the shared registry (idempotent). */
export function registerBuiltinFieldTypes(): void {
  if (builtinsRegistered) {
    return;
  }
  registerFieldType('text', TextField);
  registerFieldType('select', SelectField);
  registerFieldType('date', DateField);
  registerFieldType('multiSelect', MultiSelectField);
  builtinsRegistered = true;
}

/** Test helper to allow re-registration after clearRegistry. */
export function resetBuiltinRegistrationFlag(): void {
  builtinsRegistered = false;
}

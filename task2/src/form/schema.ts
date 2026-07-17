/** Built-in field type literals used for narrowing and boot registration. */
export type BuiltinFieldType = 'text' | 'select' | 'date' | 'multiSelect';

export type VisibleWhen = {
  field: string;
  equals: unknown;
};

export type RequiredRule = { type: 'required'; message?: string };
export type MinLengthRule = { type: 'minLength'; value: number; message?: string };
export type MaxLengthRule = { type: 'maxLength'; value: number; message?: string };
export type RegexRule = {
  type: 'regex';
  pattern: string;
  flags?: string;
  message?: string;
};
export type CustomRule = { type: 'custom'; name: string; message?: string };

export type ValidationRule =
  | RequiredRule
  | MinLengthRule
  | MaxLengthRule
  | RegexRule
  | CustomRule;

type BaseField = {
  name: string;
  label: string;
  validation?: ValidationRule[];
  visibleWhen?: VisibleWhen;
};

export type SelectOption = { label: string; value: string };

export type TextFieldSchema = BaseField & {
  type: 'text';
  initialValue?: string;
};

export type SelectFieldSchema = BaseField & {
  type: 'select';
  options: SelectOption[];
  initialValue?: string;
};

/** Date values are ISO YYYY-MM-DD strings; no native picker in scope. */
export type DateFieldSchema = BaseField & {
  type: 'date';
  initialValue?: string;
};

export type MultiSelectFieldSchema = BaseField & {
  type: 'multiSelect';
  options: SelectOption[];
  initialValue?: string[];
};

export type BuiltinFieldSchema =
  | TextFieldSchema
  | SelectFieldSchema
  | DateFieldSchema
  | MultiSelectFieldSchema;

/**
 * Custom fields use a runtime `type: string`. Kept separate from
 * BuiltinFieldSchema so the built-in discriminant is not collapsed by `string`.
 */
export type CustomFieldSchema = BaseField & {
  type: string;
  initialValue?: unknown;
  config?: Record<string, unknown>;
};

export type FieldSchema = BuiltinFieldSchema | CustomFieldSchema;

export type FormSchema = {
  id: string;
  title?: string;
  fields: FieldSchema[];
};

export type FormValues = Record<string, unknown>;
export type FormErrors = Record<string, string>;

export const BUILTIN_FIELD_TYPES: ReadonlySet<string> = new Set<BuiltinFieldType>([
  'text',
  'select',
  'date',
  'multiSelect',
]);

/** ISO calendar date as text (YYYY-MM-DD). */
export const ISO_DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

export function isBuiltinFieldType(type: string): type is BuiltinFieldType {
  return BUILTIN_FIELD_TYPES.has(type);
}

export function isBuiltinField(field: FieldSchema): field is BuiltinFieldSchema {
  return isBuiltinFieldType(field.type);
}

import type {
  FormErrors,
  FormSchema,
  FormValues,
  ValidationRule,
} from './schema';
import { isFieldVisible } from './visibility';

export type ValidationContext = {
  fieldName: string;
  values: FormValues;
  validators: Record<string, CustomValidator>;
};

/** Named custom validators; registered outside JSON schemas. */
export type CustomValidator = (
  value: unknown,
  context: ValidationContext,
) => string | undefined;

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

function valueLength(value: unknown): number | undefined {
  if (typeof value === 'string') {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  return undefined;
}

function runRule(
  value: unknown,
  rule: ValidationRule,
  context: ValidationContext,
): string | undefined {
  switch (rule.type) {
    case 'required':
      return isEmptyValue(value)
        ? (rule.message ?? 'This field is required')
        : undefined;
    case 'minLength': {
      const length = valueLength(value);
      if (length === undefined) {
        return undefined;
      }
      return length < rule.value
        ? (rule.message ?? `Must be at least ${rule.value} characters`)
        : undefined;
    }
    case 'maxLength': {
      const length = valueLength(value);
      if (length === undefined) {
        return undefined;
      }
      return length > rule.value
        ? (rule.message ?? `Must be at most ${rule.value} characters`)
        : undefined;
    }
    case 'regex': {
      if (isEmptyValue(value)) {
        return undefined;
      }
      if (typeof value !== 'string') {
        return rule.message ?? 'Invalid value';
      }
      try {
        const re = new RegExp(rule.pattern, rule.flags);
        return re.test(value)
          ? undefined
          : (rule.message ?? 'Invalid format');
      } catch {
        return rule.message ?? 'Invalid format';
      }
    }
    case 'custom': {
      const validator = context.validators[rule.name];
      if (!validator) {
        return rule.message ?? `Unknown validator: ${rule.name}`;
      }
      return validator(value, context);
    }
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

/** Runs rules in order; first failure wins. */
export function validateField(
  value: unknown,
  rules: ValidationRule[] | undefined,
  context: ValidationContext,
): string | undefined {
  if (!rules?.length) {
    return undefined;
  }
  for (const rule of rules) {
    const error = runRule(value, rule, context);
    if (error !== undefined) {
      return error;
    }
  }
  return undefined;
}

/** Validates only visible fields; hidden fields are skipped. */
export function validateForm(
  schema: FormSchema,
  values: FormValues,
  validators: Record<string, CustomValidator> = {},
): FormErrors {
  const errors: FormErrors = {};
  for (const field of schema.fields) {
    if (!isFieldVisible(field, values)) {
      continue;
    }
    const error = validateField(values[field.name], field.validation, {
      fieldName: field.name,
      values,
      validators,
    });
    if (error !== undefined) {
      errors[field.name] = error;
    }
  }
  return errors;
}

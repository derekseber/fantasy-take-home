import type { FieldSchema, FormErrors, FormSchema, FormValues } from './schema';
import { isFieldVisible } from './visibility';

export type FormStatus =
  | 'pristine'
  | 'dirty'
  | 'validating'
  | 'submitting'
  | 'success'
  | 'error';

export type FormState = {
  status: FormStatus;
  values: FormValues;
  errors: FormErrors;
  submitError?: string;
};

export type FormEvent =
  | { type: 'CHANGE'; name: string; value: unknown }
  | { type: 'SUBMIT' }
  | { type: 'VALIDATION_PASSED' }
  | { type: 'VALIDATION_FAILED'; errors: FormErrors }
  | { type: 'SUBMIT_RESOLVED' }
  | { type: 'SUBMIT_REJECTED'; message?: string }
  | { type: 'RESET' };

function defaultInitialValue(field: FieldSchema): unknown {
  if (field.initialValue !== undefined) {
    return field.initialValue;
  }
  if (field.type === 'multiSelect') {
    return [];
  }
  if (
    field.type === 'text' ||
    field.type === 'select' ||
    field.type === 'date'
  ) {
    return '';
  }
  return '';
}

export function createInitialValues(schema: FormSchema): FormValues {
  const values: FormValues = {};
  for (const field of schema.fields) {
    values[field.name] = defaultInitialValue(field);
  }
  return values;
}

export function createInitialState(schema: FormSchema): FormState {
  return {
    status: 'pristine',
    values: createInitialValues(schema),
    errors: {},
  };
}

/** Hidden fields are omitted from the submit payload. */
export function buildSubmitPayload(
  schema: FormSchema,
  values: FormValues,
): FormValues {
  const payload: FormValues = {};
  for (const field of schema.fields) {
    if (!isFieldVisible(field, values)) {
      continue;
    }
    payload[field.name] = values[field.name];
  }
  return payload;
}

export function canSubmit(status: FormStatus): boolean {
  return status === 'dirty' || status === 'error';
}

/**
 * Pure form FSM reducer.
 * Submit is allowed from dirty | error. Reset is ignored while submitting.
 */
export function formReducer(
  state: FormState,
  event: FormEvent,
  schema: FormSchema,
): FormState {
  switch (event.type) {
    case 'CHANGE': {
      if (state.status === 'submitting') {
        return state;
      }
      const nextErrors = { ...state.errors };
      delete nextErrors[event.name];
      return {
        ...state,
        status: 'dirty',
        values: { ...state.values, [event.name]: event.value },
        errors: nextErrors,
        submitError: undefined,
      };
    }
    case 'SUBMIT': {
      if (!canSubmit(state.status)) {
        return state;
      }
      return {
        ...state,
        status: 'validating',
        submitError: undefined,
      };
    }
    case 'VALIDATION_PASSED': {
      if (state.status !== 'validating') {
        return state;
      }
      return {
        ...state,
        status: 'submitting',
        errors: {},
      };
    }
    case 'VALIDATION_FAILED': {
      if (state.status !== 'validating') {
        return state;
      }
      return {
        ...state,
        status: 'error',
        errors: event.errors,
      };
    }
    case 'SUBMIT_RESOLVED': {
      if (state.status !== 'submitting') {
        return state;
      }
      return {
        ...state,
        status: 'success',
        submitError: undefined,
      };
    }
    case 'SUBMIT_REJECTED': {
      if (state.status !== 'submitting') {
        return state;
      }
      return {
        ...state,
        status: 'error',
        submitError: event.message ?? 'Submission failed',
      };
    }
    case 'RESET': {
      if (state.status === 'submitting') {
        return state;
      }
      return createInitialState(schema);
    }
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

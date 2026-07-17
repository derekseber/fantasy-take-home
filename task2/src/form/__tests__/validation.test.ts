import { ISO_DATE_PATTERN } from '../schema';
import {
  validateField,
  validateForm,
  type CustomValidator,
} from '../validation';

describe('validateField', () => {
  const ctx = {
    fieldName: 'x',
    values: {},
    validators: {} as Record<string, CustomValidator>,
  };

  it('returns undefined when there are no rules', () => {
    expect(validateField('a', undefined, ctx)).toBeUndefined();
    expect(validateField('a', [], ctx)).toBeUndefined();
  });

  it('required fails on empty string and empty array', () => {
    expect(
      validateField('', [{ type: 'required', message: 'need it' }], ctx),
    ).toBe('need it');
    expect(validateField([], [{ type: 'required' }], ctx)).toBe(
      'This field is required',
    );
    expect(validateField('ok', [{ type: 'required' }], ctx)).toBeUndefined();
  });

  it('min/max length and first-failure-wins', () => {
    const rules = [
      { type: 'minLength' as const, value: 3, message: 'too short' },
      { type: 'maxLength' as const, value: 5, message: 'too long' },
      { type: 'regex' as const, pattern: '^[a-z]+$', message: 'letters' },
    ];
    expect(validateField('ab', rules, ctx)).toBe('too short');
    expect(validateField('abcdef', rules, ctx)).toBe('too long');
    expect(validateField('abcd1', rules, ctx)).toBe('letters');
    expect(validateField('abcd', rules, ctx)).toBeUndefined();
  });

  it('regex validates ISO dates and skips empty', () => {
    const rules = [
      {
        type: 'regex' as const,
        pattern: ISO_DATE_PATTERN,
        message: 'bad date',
      },
    ];
    expect(validateField('', rules, ctx)).toBeUndefined();
    expect(validateField('2024-01-01', rules, ctx)).toBeUndefined();
    expect(validateField('01-01-2024', rules, ctx)).toBe('bad date');
  });

  it('custom validator by name; missing name is an error', () => {
    const validators: Record<string, CustomValidator> = {
      even: (value) =>
        typeof value === 'number' && value % 2 === 0
          ? undefined
          : 'must be even',
    };
    const withValidators = { ...ctx, validators };

    expect(
      validateField(3, [{ type: 'custom', name: 'even' }], withValidators),
    ).toBe('must be even');
    expect(
      validateField(4, [{ type: 'custom', name: 'even' }], withValidators),
    ).toBeUndefined();
    expect(
      validateField(1, [{ type: 'custom', name: 'missing' }], ctx),
    ).toBe('Unknown validator: missing');
  });
});

describe('validateForm', () => {
  it('collects errors only for visible fields', () => {
    const schema = {
      id: 'f',
      fields: [
        {
          type: 'text' as const,
          name: 'a',
          label: 'A',
          validation: [{ type: 'required' as const, message: 'a req' }],
        },
        {
          type: 'text' as const,
          name: 'b',
          label: 'B',
          visibleWhen: { field: 'a', equals: 'show' },
          validation: [{ type: 'required' as const, message: 'b req' }],
        },
      ],
    };

    expect(validateForm(schema, { a: '', b: '' })).toEqual({ a: 'a req' });
    expect(validateForm(schema, { a: 'show', b: '' })).toEqual({ b: 'b req' });
    expect(validateForm(schema, { a: 'show', b: 'ok' })).toEqual({});
  });
});

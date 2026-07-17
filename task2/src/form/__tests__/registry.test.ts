import {
  clearRegistry,
  getFieldType,
  listRegisteredTypes,
  registerFieldType,
  unregisterFieldType,
  type FieldComponentProps,
} from '../registry';

function MockField(_props: FieldComponentProps) {
  return null;
}

function OtherField(_props: FieldComponentProps) {
  return null;
}

describe('field registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers, looks up, lists, and unregisters', () => {
    registerFieldType('rating', MockField);
    expect(getFieldType('rating')).toBe(MockField);
    expect(listRegisteredTypes()).toEqual(['rating']);
    expect(unregisterFieldType('rating')).toBe(true);
    expect(getFieldType('rating')).toBeUndefined();
  });

  it('replaces an existing type', () => {
    registerFieldType('rating', MockField);
    registerFieldType('rating', OtherField);
    expect(getFieldType('rating')).toBe(OtherField);
  });

  it('soft-warns when replacing a built-in type', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    registerFieldType('text', MockField);
    const result = registerFieldType('text', OtherField);
    expect(result.warned).toBe(true);
    expect(warn).toHaveBeenCalled();
    expect(getFieldType('text')).toBe(OtherField);
    warn.mockRestore();
  });

  it('does not warn on first registration of a built-in name', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = registerFieldType('text', MockField);
    expect(result.warned).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns undefined for unknown types', () => {
    expect(getFieldType('nope')).toBeUndefined();
  });
});

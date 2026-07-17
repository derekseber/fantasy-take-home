import type { FieldSchema } from '../schema';
import { isFieldVisible } from '../visibility';

const base: FieldSchema = {
  type: 'text',
  name: 'licenseId',
  label: 'License',
};

describe('isFieldVisible', () => {
  it('is true when visibleWhen is absent', () => {
    expect(isFieldVisible(base, {})).toBe(true);
  });

  it('uses strict equality against the dependency value', () => {
    const field: FieldSchema = {
      ...base,
      visibleWhen: { field: 'role', equals: 'coach' },
    };
    expect(isFieldVisible(field, { role: 'coach' })).toBe(true);
    expect(isFieldVisible(field, { role: 'player' })).toBe(false);
    expect(isFieldVisible(field, {})).toBe(false);
    expect(isFieldVisible(field, { role: 'Coach' })).toBe(false);
  });
});

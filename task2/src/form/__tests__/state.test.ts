import type { FormSchema } from '../schema';
import {
  buildSubmitPayload,
  canSubmit,
  createInitialState,
  formReducer,
} from '../state';
import { validateForm } from '../validation';

const schema: FormSchema = {
  id: 'test',
  fields: [
    {
      type: 'select',
      name: 'role',
      label: 'Role',
      options: [
        { label: 'Player', value: 'player' },
        { label: 'Coach', value: 'coach' },
      ],
      initialValue: '',
      validation: [{ type: 'required' }],
    },
    {
      type: 'text',
      name: 'licenseId',
      label: 'License',
      initialValue: '',
      visibleWhen: { field: 'role', equals: 'coach' },
      validation: [{ type: 'required', message: 'License required' }],
    },
    {
      type: 'text',
      name: 'name',
      label: 'Name',
      initialValue: '',
    },
  ],
};

describe('formReducer FSM', () => {
  it('starts pristine', () => {
    const state = createInitialState(schema);
    expect(state.status).toBe('pristine');
    expect(state.values).toEqual({
      role: '',
      licenseId: '',
      name: '',
    });
  });

  it('pristine + CHANGE → dirty', () => {
    let state = createInitialState(schema);
    state = formReducer(
      state,
      { type: 'CHANGE', name: 'name', value: 'Ada' },
      schema,
    );
    expect(state.status).toBe('dirty');
    expect(state.values.name).toBe('Ada');
  });

  it('allows SUBMIT from dirty and error', () => {
    let dirty = createInitialState(schema);
    dirty = formReducer(
      dirty,
      { type: 'CHANGE', name: 'name', value: 'Ada' },
      schema,
    );
    expect(canSubmit(dirty.status)).toBe(true);
    dirty = formReducer(dirty, { type: 'SUBMIT' }, schema);
    expect(dirty.status).toBe('validating');

    let errored = formReducer(
      { ...dirty, status: 'validating' },
      { type: 'VALIDATION_FAILED', errors: { name: 'bad' } },
      schema,
    );
    expect(errored.status).toBe('error');
    errored = formReducer(errored, { type: 'SUBMIT' }, schema);
    expect(errored.status).toBe('validating');
  });

  it('ignores SUBMIT from pristine', () => {
    const state = formReducer(
      createInitialState(schema),
      { type: 'SUBMIT' },
      schema,
    );
    expect(state.status).toBe('pristine');
  });

  it('validating → submitting → success', () => {
    let state = createInitialState(schema);
    state = formReducer(
      state,
      { type: 'CHANGE', name: 'role', value: 'player' },
      schema,
    );
    state = formReducer(state, { type: 'SUBMIT' }, schema);
    state = formReducer(state, { type: 'VALIDATION_PASSED' }, schema);
    expect(state.status).toBe('submitting');
    state = formReducer(state, { type: 'SUBMIT_RESOLVED' }, schema);
    expect(state.status).toBe('success');
  });

  it('submitting → error on reject; change returns to dirty', () => {
    let state: ReturnType<typeof createInitialState> = {
      status: 'submitting',
      values: createInitialState(schema).values,
      errors: {},
    };
    state = formReducer(
      state,
      { type: 'SUBMIT_REJECTED', message: 'network' },
      schema,
    );
    expect(state.status).toBe('error');
    expect(state.submitError).toBe('network');
    state = formReducer(
      state,
      { type: 'CHANGE', name: 'name', value: 'x' },
      schema,
    );
    expect(state.status).toBe('dirty');
    expect(state.submitError).toBeUndefined();
  });

  it('RESET returns to pristine except while submitting', () => {
    let state = createInitialState(schema);
    state = formReducer(
      state,
      { type: 'CHANGE', name: 'name', value: 'Ada' },
      schema,
    );
    state = formReducer(state, { type: 'RESET' }, schema);
    expect(state.status).toBe('pristine');
    expect(state.values.name).toBe('');

    state = {
      status: 'submitting',
      values: { role: 'player', licenseId: '', name: 'Ada' },
      errors: {},
    };
    const blocked = formReducer(state, { type: 'RESET' }, schema);
    expect(blocked.status).toBe('submitting');
  });
});

describe('buildSubmitPayload', () => {
  it('omits hidden fields', () => {
    const values = {
      role: 'player',
      licenseId: 'SECRET',
      name: 'Ada',
    };
    expect(buildSubmitPayload(schema, values)).toEqual({
      role: 'player',
      name: 'Ada',
    });

    const coach = { ...values, role: 'coach' };
    expect(buildSubmitPayload(schema, coach)).toEqual({
      role: 'coach',
      licenseId: 'SECRET',
      name: 'Ada',
    });
  });
});

describe('validateForm + visibility', () => {
  it('skips hidden licenseId', () => {
    const errors = validateForm(schema, {
      role: 'player',
      licenseId: '',
      name: 'Ada',
    });
    expect(errors.licenseId).toBeUndefined();
    expect(errors.role).toBeUndefined();
  });

  it('validates licenseId when role is coach', () => {
    const errors = validateForm(schema, {
      role: 'coach',
      licenseId: '',
      name: 'Ada',
    });
    expect(errors.licenseId).toBe('License required');
  });
});

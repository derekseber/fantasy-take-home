import type { FormSchema } from '../form/schema';
import { ISO_DATE_PATTERN } from '../form/schema';

/**
 * Demo schema: role select, licenseId when role=coach, custom rating,
 * plus date / multiSelect / text coverage.
 */
export const demoFormSchema: FormSchema = {
  id: 'roster-profile',
  title: 'Roster profile',
  fields: [
    {
      type: 'text',
      name: 'displayName',
      label: 'Display name',
      initialValue: '',
      validation: [
        { type: 'required', message: 'Display name is required' },
        { type: 'minLength', value: 2, message: 'At least 2 characters' },
      ],
    },
    {
      type: 'select',
      name: 'role',
      label: 'Role',
      initialValue: '',
      options: [
        { label: 'Player', value: 'player' },
        { label: 'Coach', value: 'coach' },
        { label: 'Fan', value: 'fan' },
      ],
      validation: [{ type: 'required', message: 'Choose a role' }],
    },
    {
      type: 'text',
      name: 'licenseId',
      label: 'Coach license ID',
      initialValue: '',
      visibleWhen: { field: 'role', equals: 'coach' },
      validation: [
        { type: 'required', message: 'License ID is required for coaches' },
        {
          type: 'regex',
          pattern: '^[A-Z0-9-]{4,}$',
          message: 'Use letters, numbers, or dashes (min 4)',
        },
      ],
    },
    {
      type: 'date',
      name: 'startDate',
      label: 'Start date (YYYY-MM-DD)',
      initialValue: '',
      validation: [
        { type: 'required', message: 'Start date is required' },
        {
          type: 'regex',
          pattern: ISO_DATE_PATTERN,
          message: 'Use ISO date YYYY-MM-DD',
        },
      ],
    },
    {
      type: 'multiSelect',
      name: 'sports',
      label: 'Sports',
      initialValue: [],
      options: [
        { label: 'Football', value: 'football' },
        { label: 'Basketball', value: 'basketball' },
        { label: 'Baseball', value: 'baseball' },
      ],
      validation: [{ type: 'required', message: 'Pick at least one sport' }],
    },
    {
      type: 'rating',
      name: 'rating',
      label: 'Experience rating',
      initialValue: 0,
      config: { max: 5 },
      validation: [
        {
          type: 'custom',
          name: 'ratingRequired',
          message: 'Pick a rating from 1–5',
        },
      ],
    },
  ],
};

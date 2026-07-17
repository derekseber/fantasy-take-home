import { TextInput } from 'react-native';

import type { FieldComponentProps } from '../registry';
import { FieldShell, fieldStyles } from './fieldChrome';

/** ISO YYYY-MM-DD as plain text; validated by regex in the schema. */
export function DateField({ field, value, error, onChange }: FieldComponentProps) {
  const styles = fieldStyles();
  return (
    <FieldShell label={field.label} error={error}>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={typeof value === 'string' ? value : ''}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
      />
    </FieldShell>
  );
}

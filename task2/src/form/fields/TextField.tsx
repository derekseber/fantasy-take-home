import { TextInput } from 'react-native';

import type { FieldComponentProps } from '../registry';
import { FieldShell, fieldStyles } from './fieldChrome';

export function TextField({ field, value, error, onChange }: FieldComponentProps) {
  const styles = fieldStyles();
  return (
    <FieldShell label={field.label} error={error}>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={typeof value === 'string' ? value : ''}
        onChangeText={onChange}
        placeholder={field.label}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </FieldShell>
  );
}

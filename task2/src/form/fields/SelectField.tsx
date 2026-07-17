import { Pressable, Text, View } from 'react-native';

import type { SelectFieldSchema } from '../schema';
import type { FieldComponentProps } from '../registry';
import { FieldShell, fieldStyles } from './fieldChrome';

export function SelectField({
  field,
  value,
  error,
  onChange,
}: FieldComponentProps) {
  const styles = fieldStyles();
  const options =
    field.type === 'select' ? (field as SelectFieldSchema).options : [];
  const selected = typeof value === 'string' ? value : '';

  return (
    <FieldShell label={field.label} error={error}>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => onChange(option.value)}
              style={[styles.option, isSelected ? styles.optionSelected : null]}
            >
              <Text style={styles.optionText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </FieldShell>
  );
}

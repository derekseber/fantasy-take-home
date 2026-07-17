import { Pressable, Text, View } from 'react-native';

import type { MultiSelectFieldSchema } from '../schema';
import type { FieldComponentProps } from '../registry';
import { FieldShell, fieldStyles } from './fieldChrome';

export function MultiSelectField({
  field,
  value,
  error,
  onChange,
}: FieldComponentProps) {
  const styles = fieldStyles();
  const options =
    field.type === 'multiSelect'
      ? (field as MultiSelectFieldSchema).options
      : [];
  const selected = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];

  const toggle = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      onChange(selected.filter((v) => v !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  };

  return (
    <FieldShell label={field.label} error={error}>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => toggle(option.value)}
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

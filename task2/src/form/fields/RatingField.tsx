import { Pressable, Text, View } from 'react-native';

import type { FieldComponentProps } from '../registry';
import { FieldShell, fieldStyles } from './fieldChrome';

/**
 * Demo custom field: 1–5 rating stored as a number.
 * Registered at runtime via registerFieldType("rating", RatingField).
 */
export function RatingField({
  field,
  value,
  error,
  onChange,
}: FieldComponentProps) {
  const styles = fieldStyles();
  const config =
    'config' in field && field.config && typeof field.config === 'object'
      ? field.config
      : undefined;
  const max = typeof config?.max === 'number' ? config.max : 5;
  const current = typeof value === 'number' ? value : 0;

  return (
    <FieldShell label={field.label} error={error}>
      <View style={styles.optionRow}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const isSelected = current === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              onPress={() => onChange(n)}
              style={[styles.option, isSelected ? styles.optionSelected : null]}
            >
              <Text style={styles.optionText}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </FieldShell>
  );
}

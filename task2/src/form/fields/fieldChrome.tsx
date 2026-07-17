import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FieldComponentProps } from '../registry';

export function fieldStyles() {
  return sharedStyles;
}

const sharedStyles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c8c8c8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#c62828',
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: '#c62828',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#c8c8c8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f7f7f7',
  },
  optionSelected: {
    borderColor: '#1565c0',
    backgroundColor: '#e3f2fd',
  },
  optionText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
});

export function FieldLabel({ label }: { label: string }) {
  return <Text style={sharedStyles.label}>{label}</Text>;
}

export function FieldError({ error }: { error?: string }) {
  if (!error) {
    return null;
  }
  return <Text style={sharedStyles.error}>{error}</Text>;
}

export function FieldShell({
  children,
  label,
  error,
}: {
  children: ReactNode;
  label: string;
  error?: string;
}) {
  return (
    <View style={sharedStyles.wrap}>
      <FieldLabel label={label} />
      {children}
      <FieldError error={error} />
    </View>
  );
}

export type { FieldComponentProps };

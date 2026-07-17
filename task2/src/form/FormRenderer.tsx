import { useCallback, useReducer } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { FormSchema } from './schema';
import { getFieldType } from './registry';
import {
  buildSubmitPayload,
  canSubmit,
  createInitialState,
  formReducer,
  type FormEvent,
  type FormState,
} from './state';
import {
  validateForm,
  type CustomValidator,
} from './validation';
import { isFieldVisible } from './visibility';

export type FormRendererProps = {
  schema: FormSchema;
  validators?: Record<string, CustomValidator>;
  onSubmit?: (payload: Record<string, unknown>) => void | Promise<void>;
};

function UnknownField({ type }: { type: string }) {
  return (
    <View style={styles.unknown}>
      <Text style={styles.unknownText}>
        Unknown field type: "{type}". Register it with registerFieldType.
      </Text>
    </View>
  );
}

export function FormRenderer({
  schema,
  validators = {},
  onSubmit,
}: FormRendererProps) {
  const reducer = useCallback(
    (state: FormState, event: FormEvent) => formReducer(state, event, schema),
    [schema],
  );
  const [state, dispatch] = useReducer(reducer, schema, createInitialState);

  const handleSubmit = async () => {
    if (!canSubmit(state.status)) {
      return;
    }
    dispatch({ type: 'SUBMIT' });
    const errors = validateForm(schema, state.values, validators);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'VALIDATION_FAILED', errors });
      return;
    }
    dispatch({ type: 'VALIDATION_PASSED' });
    const payload = buildSubmitPayload(schema, state.values);
    try {
      await onSubmit?.(payload);
      dispatch({ type: 'SUBMIT_RESOLVED' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Submission failed';
      dispatch({ type: 'SUBMIT_REJECTED', message });
    }
  };

  const submitting = state.status === 'submitting';
  const submitEnabled = canSubmit(state.status) && !submitting;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {schema.title ? <Text style={styles.title}>{schema.title}</Text> : null}

      {schema.fields.map((field) => {
        if (!isFieldVisible(field, state.values)) {
          return null;
        }
        const Component = getFieldType(field.type);
        if (!Component) {
          return <UnknownField key={field.name} type={field.type} />;
        }
        return (
          <Component
            key={field.name}
            field={field}
            value={state.values[field.name]}
            error={state.errors[field.name]}
            onChange={(value) =>
              dispatch({ type: 'CHANGE', name: field.name, value })
            }
          />
        );
      })}

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={styles.statusValue}>{state.status}</Text>
      </View>

      {state.submitError ? (
        <Text style={styles.submitError}>{state.submitError}</Text>
      ) : null}

      {state.status === 'success' ? (
        <Text style={styles.success}>Submitted successfully.</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={!submitEnabled}
          onPress={handleSubmit}
          style={[styles.button, !submitEnabled ? styles.buttonDisabled : null]}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => dispatch({ type: 'RESET' })}
          style={[styles.buttonSecondary, submitting ? styles.buttonDisabled : null]}
        >
          <Text style={styles.buttonSecondaryText}>Reset</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#102a43',
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  statusLabel: {
    fontSize: 13,
    color: '#627d98',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#243b53',
    textTransform: 'uppercase',
  },
  submitError: {
    color: '#c62828',
    marginBottom: 8,
  },
  success: {
    color: '#2e7d32',
    marginBottom: 8,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    backgroundColor: '#1565c0',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#9fb3c8',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonSecondaryText: {
    color: '#243b53',
    fontWeight: '600',
  },
  unknown: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff3e0',
    marginBottom: 16,
  },
  unknownText: {
    color: '#e65100',
    fontSize: 13,
  },
});

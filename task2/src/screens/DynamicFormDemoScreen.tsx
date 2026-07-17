import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import {
  FormRenderer,
  registerBuiltinFieldTypes,
  registerFieldType,
  type CustomValidator,
} from '../form';
import { RatingField } from '../form/fields/RatingField';
import { demoFormSchema } from './demoSchema';

const ratingRequired: CustomValidator = (value) => {
  if (typeof value !== 'number' || value < 1) {
    return 'Pick a rating from 1–5';
  }
  return undefined;
};

export function DynamicFormDemoScreen() {
  const [lastPayload, setLastPayload] = useState<string | null>(null);

  useEffect(() => {
    registerBuiltinFieldTypes();
    registerFieldType('rating', RatingField);
  }, []);

  const validators = useMemo(
    () => ({
      ratingRequired,
    }),
    [],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FormRenderer
        schema={demoFormSchema}
        validators={validators}
        onSubmit={async (payload) => {
          // Simulate async submit
          await new Promise((resolve) => setTimeout(resolve, 400));
          setLastPayload(JSON.stringify(payload, null, 2));
        }}
      />
      {lastPayload ? (
        <View style={styles.payloadBox}>
          <Text style={styles.payloadTitle}>Last submit payload</Text>
          <Text style={styles.payloadBody}>{lastPayload}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  payloadBox: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#102a43',
  },
  payloadTitle: {
    color: '#9fb3c8',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  payloadBody: {
    color: '#f0f4f8',
    fontFamily: 'monospace',
    fontSize: 12,
  },
});

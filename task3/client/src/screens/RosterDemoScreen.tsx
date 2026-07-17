import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Player } from '../api/types';
import { useRosterDemo, type RowState } from '../roster/useRosterDemo';

function statusLabel(
  status: string,
  retryAttempt: number,
  retryAfterSeconds: number | null,
): string {
  switch (status) {
    case 'idle':
      return 'idle';
    case 'loading':
      return 'loading…';
    case 'retrying':
      return `retrying (attempt ${retryAttempt}${
        retryAfterSeconds != null ? `, wait ${retryAfterSeconds}s` : ''
      })`;
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    default:
      return status;
  }
}

function rowLabel(state: RowState | undefined): string {
  switch (state) {
    case 'adding':
      return 'Adding…';
    case 'rostered':
      return 'Rostered';
    case 'error':
      return 'Retry';
    default:
      return 'Add';
  }
}

export function RosterDemoScreen() {
  const demo = useRosterDemo();
  const [draft, setDraft] = useState('');

  const onSearch = useCallback(() => {
    void demo.search(draft);
  }, [demo, draft]);

  const renderItem = useCallback(
    ({ item }: { item: Player }) => {
      const rowState = demo.rowStates[item.id] ?? 'idle';
      const disabled = rowState === 'adding' || rowState === 'rostered';
      return (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.playerName}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.position} · {item.team}
            </Text>
            {demo.rowErrors[item.id] ? (
              <Text style={styles.rowError}>{demo.rowErrors[item.id]}</Text>
            ) : null}
          </View>
          <Pressable
            style={[
              styles.addBtn,
              rowState === 'rostered' && styles.addBtnDone,
              disabled && styles.addBtnDisabled,
            ]}
            disabled={disabled}
            onPress={() => void demo.addPlayer(item.id)}
          >
            <Text style={styles.addBtnText}>{rowLabel(rowState)}</Text>
          </Pressable>
        </View>
      );
    },
    [demo],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Roster Demo</Text>
        <Text style={styles.sub}>{demo.baseUrl}</Text>
        <Text style={styles.status}>
          state: {statusLabel(demo.status, demo.retryAttempt, demo.retryAfterSeconds)}
        </Text>
        {demo.error ? (
          <Text style={styles.error}>
            {demo.error.code}: {demo.error.message}
          </Text>
        ) : null}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search by name"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={onSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.btn} onPress={onSearch}>
          <Text style={styles.btnText}>Search</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.burstBtn} onPress={() => void demo.trigger429()}>
          <Text style={styles.btnText}>Trigger 429</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void demo.reload()}>
          <Text style={styles.btnText}>Reload</Text>
        </Pressable>
      </View>

      {(demo.status === 'loading' || demo.status === 'retrying') && (
        <ActivityIndicator style={styles.spinner} />
      )}

      <Text style={styles.section}>Players</Text>
      <FlatList
        data={demo.players}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        style={styles.list}
      />

      <Text style={styles.section}>
        Roster ({demo.roster.players.length})
      </Text>
      {demo.roster.players.length === 0 ? (
        <Text style={styles.empty}>No players added yet.</Text>
      ) : (
        demo.roster.players.map((p) => (
          <Text key={p.id} style={styles.rosterItem}>
            • {p.name} ({p.position})
          </Text>
        ))
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6f8', paddingHorizontal: 16 },
  header: { paddingTop: 8, paddingBottom: 12, gap: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#102a43' },
  sub: { fontSize: 12, color: '#627d98' },
  status: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#243b53',
    fontVariant: ['tabular-nums'],
  },
  error: { color: '#9b1c1c', marginTop: 4 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#bcccdc',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: {
    backgroundColor: '#243b53',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  burstBtn: {
    backgroundColor: '#9b1c1c',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  spinner: { marginVertical: 8 },
  section: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#102a43',
  },
  list: { flexGrow: 0, maxHeight: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d9e2ec',
  },
  rowText: { flex: 1, gap: 2 },
  playerName: { fontSize: 16, fontWeight: '600', color: '#102a43' },
  meta: { fontSize: 13, color: '#627d98' },
  rowError: { fontSize: 12, color: '#9b1c1c', marginTop: 2 },
  addBtn: {
    backgroundColor: '#0c6b58',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  addBtnDone: { backgroundColor: '#486581' },
  addBtnDisabled: { opacity: 0.7 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { color: '#829ab1', marginBottom: 16 },
  rosterItem: { color: '#243b53', marginBottom: 4 },
});

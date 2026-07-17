import { StatusBar } from 'expo-status-bar';

import { RosterDemoScreen } from './src/screens/RosterDemoScreen';

export default function App() {
  return (
    <>
      <RosterDemoScreen />
      <StatusBar style="dark" />
    </>
  );
}

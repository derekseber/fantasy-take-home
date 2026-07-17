import { StatusBar } from 'expo-status-bar';

import { DynamicFormDemoScreen } from './src/screens/DynamicFormDemoScreen';

export default function App() {
  return (
    <>
      <DynamicFormDemoScreen />
      <StatusBar style="dark" />
    </>
  );
}

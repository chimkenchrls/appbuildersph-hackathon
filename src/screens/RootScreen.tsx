import { HomeScreen } from './workspace/HomeScreen';
import DashboardScreen from './routed/DashboardScreen';
import { isFixtureData } from '@/services/active';

/** Native workspace. The web sibling preserves the existing landing page. */
export default function RootScreen() {
  return isFixtureData ? <DashboardScreen /> : <HomeScreen />;
}

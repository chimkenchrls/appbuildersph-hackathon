import { HomeScreen } from './HomeScreen';
import DashboardScreen from './DashboardScreen';
import { isFixtureData } from '@/services/active';

/** Native workspace. The web sibling preserves the existing landing page. */
export default function RootScreen() {
  return isFixtureData ? <DashboardScreen /> : <HomeScreen />;
}

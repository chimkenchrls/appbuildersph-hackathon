import { Redirect } from 'expo-router';

/** The mobile workspace is not offered on web; return to the landing placeholder. */
export default function WorkspaceScreen() {
  return <Redirect href="/" />;
}

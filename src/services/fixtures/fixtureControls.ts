export interface FixtureControls { unavailable: boolean; invalid: boolean; slow: boolean; saveFailure: boolean }
let controls: FixtureControls = { unavailable: false, invalid: false, slow: false, saveFailure: false };
const listeners = new Set<() => void>();
export const getFixtureControls = () => controls;
export function setFixtureControls(next: Partial<FixtureControls>) {
  if (!__DEV__) return;
  controls = { ...controls, ...next };
  listeners.forEach(listener => listener());
}
export function subscribeFixtureControls(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

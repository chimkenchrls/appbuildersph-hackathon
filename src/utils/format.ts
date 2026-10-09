export function money(value: number | null, currency = 'PHP') {
  return value === null ? 'Not specified' : `${currency} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
export function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

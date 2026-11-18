// Haptics: Vibration API where available; on iPhone (iOS 18+) toggling a hidden
// switch control produces a system haptic tick.
import { getSettings } from './store.js';

let label = null;
function iosTick() {
  if (!label) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.id = '__haptic';
    input.style.display = 'none';
    label = document.createElement('label');
    label.htmlFor = '__haptic';
    label.style.display = 'none';
    document.body.append(input, label);
  }
  label.click();
}
export function haptic(kind = 'light') {
  if (!getSettings().haptics) return;
  const pattern = { light: 8, medium: 18, heavy: 35, success: [12, 60, 18], error: [30, 50, 30], impact: 24 }[kind] || 10;
  try {
    if (navigator.vibrate) { navigator.vibrate(pattern); return; }
    iosTick();
    if (Array.isArray(pattern) || kind === 'heavy') setTimeout(iosTick, 90);
  } catch { /* ignore */ }
}

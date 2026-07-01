const listeners = new Set();
let toastIdCounter = 0;

export function addToastListener(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function showToast(message, type = "info", duration = 4000) {
  listeners.forEach(fn => fn({ message, type, id: ++toastIdCounter, duration }));
}

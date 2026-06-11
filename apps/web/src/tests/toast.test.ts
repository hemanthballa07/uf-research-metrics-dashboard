import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toastStore } from '../lib/toast.js';

// Persistent subscription tracks current state so drainToasts can remove all
let _current: { id: string }[] = [];
toastStore.subscribe((toasts) => { _current = toasts; });

function drainToasts() {
  [..._current].forEach((t) => toastStore.remove(t.id));
}

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    drainToasts();
  });

  afterEach(() => {
    drainToasts();
    vi.useRealTimers();
  });

  it('adds a toast and notifies subscribers', () => {
    const received: { id: string; message: string; type: string }[][] = [];
    const unsub = toastStore.subscribe((toasts) => received.push(toasts));

    toastStore.add('Hello world', 'success');

    unsub();
    expect(received.length).toBeGreaterThan(0);
    const last = received[received.length - 1];
    expect(last).toHaveLength(1);
    expect(last[0].message).toBe('Hello world');
    expect(last[0].type).toBe('success');
  });

  it('removes a toast and notifies subscribers', () => {
    let capturedId = '';
    const unsub1 = toastStore.subscribe((toasts) => {
      if (toasts.length > 0) capturedId = toasts[0].id;
    });

    toastStore.add('To be removed', 'error');
    unsub1();

    expect(capturedId).not.toBe('');

    const notifications: { id: string }[][] = [];
    const unsub2 = toastStore.subscribe((toasts) => notifications.push(toasts));
    toastStore.remove(capturedId);
    unsub2();

    const last = notifications[notifications.length - 1];
    expect(last).toHaveLength(0);
  });

  it('auto-dismisses a toast after its duration elapses', () => {
    const states: { id: string }[][] = [];
    const unsub = toastStore.subscribe((toasts) => states.push([...toasts]));

    toastStore.add('Auto dismiss me', 'info', 2000);

    // Before timer fires, toast is present
    const before = states[states.length - 1];
    expect(before).toHaveLength(1);

    // Advance past the duration
    vi.advanceTimersByTime(2001);

    // After timer fires, toast should be gone
    const after = states[states.length - 1];
    expect(after).toHaveLength(0);

    unsub();
  });

  it('unsubscribing stops receiving notifications', () => {
    const received: unknown[][] = [];
    const unsub = toastStore.subscribe((toasts) => received.push(toasts));
    unsub();

    const countBefore = received.length;
    toastStore.add('Should not be seen', 'info');
    // The subscriber was removed, so count must not increase
    expect(received.length).toBe(countBefore);

    // Clean up
    drainToasts();
  });
});

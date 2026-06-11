import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastContainer } from '../components/ToastContainer.js';
import { toastStore } from '../lib/toast.js';

// Persistent subscription tracks current state so drainToasts can remove all
let _current: { id: string }[] = [];
toastStore.subscribe((toasts) => { _current = toasts; });

function drainToasts() {
  [..._current].forEach((t) => toastStore.remove(t.id));
}

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    drainToasts();
  });

  afterEach(() => {
    drainToasts();
    vi.useRealTimers();
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a toast after toastStore.add() is called', async () => {
    render(<ToastContainer />);

    act(() => {
      toastStore.add('Test toast message', 'success', 5000);
    });

    expect(screen.getByText('Test toast message')).toBeInTheDocument();
  });

  it('removes a toast when clicked (dismiss button)', () => {
    render(<ToastContainer />);

    act(() => {
      toastStore.add('Click to dismiss', 'error', 5000);
    });

    const toastEl = screen.getByText('Click to dismiss');
    expect(toastEl).toBeInTheDocument();

    act(() => {
      fireEvent.click(toastEl);
    });

    expect(screen.queryByText('Click to dismiss')).not.toBeInTheDocument();
  });

  it('shows multiple toasts at once', async () => {
    render(<ToastContainer />);

    act(() => {
      toastStore.add('First toast', 'success', 5000);
      toastStore.add('Second toast', 'error', 5000);
    });

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });
});

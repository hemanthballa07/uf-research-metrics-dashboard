import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage.js';
import { AuthProvider } from '../contexts/AuthContext.js';

// Mock the api module
vi.mock('../lib/apiClient.js', () => ({
  api: {
    login: vi.fn(),
  },
}));

// Import the mock so we can control it per-test
import { api } from '../lib/apiClient.js';

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.removeItem('uf_auth_token');
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('successful login — calls api.login and shows no error', async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockResolvedValueOnce({
      accessToken: 'test-token-abc',
      user: { id: 1, email: 'admin@ufl.edu', role: 'ADMIN' },
    });

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'admin@ufl.edu');
    await user.type(screen.getByLabelText(/password/i), 'changeme');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('admin@ufl.edu', 'changeme');
    });

    // No error message should be visible
    expect(screen.queryByText(/login failed/i)).not.toBeInTheDocument();
  });

  it('failed login — shows error message on rejection', async () => {
    const user = userEvent.setup();
    vi.mocked(api.login).mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'bad@ufl.edu');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});

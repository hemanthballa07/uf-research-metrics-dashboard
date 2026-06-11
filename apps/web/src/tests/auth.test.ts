import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, clearToken, isAuthenticated } from '../lib/auth.js';

describe('auth helpers', () => {
  beforeEach(() => {
    localStorage.removeItem('uf_auth_token');
  });

  it('getToken returns null when nothing is stored', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken stores a token and getToken retrieves it', () => {
    setToken('my-test-token');
    expect(getToken()).toBe('my-test-token');
  });

  it('clearToken removes the stored token', () => {
    setToken('my-test-token');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('isAuthenticated returns false when no token is stored', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true when a token is stored', () => {
    setToken('some-token');
    expect(isAuthenticated()).toBe(true);
  });

  it('isAuthenticated returns false after clearToken', () => {
    setToken('some-token');
    clearToken();
    expect(isAuthenticated()).toBe(false);
  });
});

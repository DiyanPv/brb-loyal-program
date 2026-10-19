const TOKEN_KEY = 'barber_auth_token';
const ADMIN_KEY = 'barber_admin_authenticated';

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check localStorage
  const localVal = localStorage.getItem(TOKEN_KEY);
  if (localVal) return localVal.trim();

  // 2. Check Cookie
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, val] = cookie.trim().split('=');
    if (name === TOKEN_KEY && val) {
      const decoded = decodeURIComponent(val).trim();
      // Sync back to localStorage
      localStorage.setItem(TOKEN_KEY, decoded);
      return decoded;
    }
  }

  return null;
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined') return;

  const cleanToken = token.trim();
  localStorage.setItem(TOKEN_KEY, cleanToken);

  // Set long-term cookie (1 year = 31536000 seconds)
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(cleanToken)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; max-age=0; path=/; SameSite=Lax`;
}

export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ADMIN_KEY) === 'true';
}

export function setAdminAuthenticated(auth: boolean): void {
  if (typeof window === 'undefined') return;
  if (auth) {
    localStorage.setItem(ADMIN_KEY, 'true');
  } else {
    localStorage.removeItem(ADMIN_KEY);
  }
}

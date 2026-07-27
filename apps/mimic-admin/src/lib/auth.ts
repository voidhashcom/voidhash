export interface Credentials {
  serverUrl: string;
  username: string;
  password: string;
}

const STORAGE_KEY = "mimic-admin-credentials";

export function getCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.serverUrl && parsed.username && parsed.password) {
      return parsed as Credentials;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCredentials(credentials: Credentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

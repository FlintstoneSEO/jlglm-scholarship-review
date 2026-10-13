const key = "jlgl.rememberedEmail";

export function readRememberedEmail(): string | null {
  try {
    return window.localStorage.getItem(key)?.trim() || null;
  } catch {
    return null;
  }
}

// Store only an email address, independently of Supabase's session storage.
export function saveRememberedEmail(email: string | null): boolean {
  try {
    if (email?.trim()) window.localStorage.setItem(key, email.trim());
    else window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
  }
  return null;
}

export interface NimbusUser {
  email: string;
  id: string;
  name: string;
}

/** Stable, non-sequential id derived from the email, standing in for a real user id. */
const fingerprint = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

/**
 * Stands in for the auth system you already have. The only part Voidhash cares
 * about is `id`: it becomes the person's external user id, so it must be stable
 * for the lifetime of the account and hard to guess — never an email address
 * and never a sequential number.
 */
export function signIn(email: string, name: string): NimbusUser {
  const normalizedEmail = email.trim().toLowerCase();
  return {
    email: normalizedEmail,
    id: `nimbus_${fingerprint(normalizedEmail)}`,
    name: name.trim(),
  };
}

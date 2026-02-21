import {
  signOut,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
} from 'aws-amplify/auth';

export async function logout() {
  return signOut();
}

export async function getUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function getIdToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() || '';
}

export function loginWithOidc() {
  signInWithRedirect({ provider: { custom: 'OneIdp' } });
}

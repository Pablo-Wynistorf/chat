import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
} from 'aws-amplify/auth';

export async function login(email, password) {
  return signIn({ username: email, password });
}

export async function register(email, password) {
  return signUp({
    username: email,
    password,
    options: { userAttributes: { email } },
  });
}

export async function confirmRegistration(email, code) {
  return confirmSignUp({ username: email, confirmationCode: code });
}

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

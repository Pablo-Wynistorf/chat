import {
  signOut,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
  fetchUserAttributes,
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

/** Get user profile info from Cognito (email, name, sub, etc.) */
export async function getUserInfo() {
  try {
    const [attrs, session] = await Promise.all([
      fetchUserAttributes(),
      fetchAuthSession(),
    ]);
    const payload = session.tokens?.idToken?.payload || {};
    return {
      email: attrs.email || payload.email || '',
      name: attrs.name || payload.name || attrs.preferred_username || '',
      sub: attrs.sub || payload.sub || '',
      identities: payload.identities || attrs.identities || '',
      provider: 'OneIdp',
    };
  } catch {
    return null;
  }
}

export function loginWithOidc() {
  signInWithRedirect({ provider: { custom: 'OneIdp' } });
}

/**
 * Check if the current user has a specific role in the OIDC `roles` claim.
 * Decodes the ID token payload (JWT) and looks for the role in the `custom:roles` or `roles` claim.
 */
export async function hasRole(requiredRole) {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;
    if (!idToken) return false;

    // Amplify parsed token has a payload property with the claims
    const payload = idToken.payload || {};

    // The roles claim may come through as `roles` or `custom:roles` depending on Cognito attribute mapping
    const roles = payload['roles'] || payload['custom:roles'] || '';

    // roles can be a string (comma-separated or JSON array) or already an array
    if (Array.isArray(roles)) {
      return roles.includes(requiredRole);
    }
    if (typeof roles === 'string') {
      // Try JSON parse first (e.g. '["chatUser","admin"]')
      try {
        const parsed = JSON.parse(roles);
        if (Array.isArray(parsed)) return parsed.includes(requiredRole);
      } catch { /* not JSON, treat as comma-separated */ }
      return roles.split(',').map(r => r.trim()).includes(requiredRole);
    }
    return false;
  } catch {
    return false;
  }
}

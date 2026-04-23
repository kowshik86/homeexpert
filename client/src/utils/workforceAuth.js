const ROLES = ['shopkeeper', 'delivery', 'worker', 'vendor'];
const legacyKey = 'workforceAuth';

const getRoleKey = (role) => `workforceAuth:${role}`;

const safeParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const getWorkforceAuth = (role) => {
  if (role) {
    const roleScoped = safeParse(sessionStorage.getItem(getRoleKey(role)));
    if (roleScoped?.role === role) {
      return roleScoped;
    }

    const legacy = safeParse(sessionStorage.getItem(legacyKey));
    if (legacy?.role === role) {
      return legacy;
    }

    return null;
  }

  for (const currentRole of ROLES) {
    const session = safeParse(sessionStorage.getItem(getRoleKey(currentRole)));
    if (session?.role === currentRole) {
      return session;
    }
  }

  return safeParse(sessionStorage.getItem(legacyKey));
};

export const getAllWorkforceAuth = () => {
  const result = {};

  for (const role of ROLES) {
    const session = safeParse(sessionStorage.getItem(getRoleKey(role)));
    if (session?.role === role) {
      result[role] = session;
    }
  }

  const legacy = safeParse(sessionStorage.getItem(legacyKey));
  if (legacy?.role && !result[legacy.role]) {
    result[legacy.role] = legacy;
  }

  return result;
};

export const setWorkforceAuth = (role, authState) => {
  if (!role || !authState) {
    return;
  }

  sessionStorage.setItem(getRoleKey(role), JSON.stringify({ ...authState, role }));
};

export const clearWorkforceAuth = (role) => {
  if (!role) {
    return;
  }

  sessionStorage.removeItem(getRoleKey(role));

  const legacy = safeParse(sessionStorage.getItem(legacyKey));
  if (legacy?.role === role) {
    sessionStorage.removeItem(legacyKey);
  }
};

export const clearAllWorkforceAuth = () => {
  for (const role of ROLES) {
    sessionStorage.removeItem(getRoleKey(role));
  }

  sessionStorage.removeItem(legacyKey);
};

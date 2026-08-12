type NameSource = {
  uid?: string | null;
  name?: string | null;
  displayName?: string | null;
  email?: string | null;
};

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function resolveStudentDisplayName(
  profile?: NameSource | null,
  authUser?: NameSource | null,
  progress?: NameSource | null
): string {
  const profileName = clean(profile?.name);
  if (profileName) return profileName;

  const profileDisplayName = clean(profile?.displayName);
  if (profileDisplayName) return profileDisplayName;

  const authDisplayName = clean(authUser?.displayName);
  if (authDisplayName) return authDisplayName;

  const progressName = clean(progress?.name) || clean(progress?.displayName);
  if (progressName) return progressName;

  const email = clean(profile?.email) || clean(authUser?.email) || clean(progress?.email);
  if (email) return email;

  const uid = clean(profile?.uid) || clean(authUser?.uid) || clean(progress?.uid);
  return uid ? `Student ${uid.slice(0, 6)}` : 'Student';
}

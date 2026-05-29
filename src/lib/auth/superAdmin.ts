// Owner of this single-user deployment. Used as the default super-admin when
// SUPER_ADMIN_EMAILS is not set, so the admin panel works out of the box.
const OWNER_EMAIL = 'skale.club@gmail.com';

function allowedEmails(): string[] {
    const fromEnv = process.env.SUPER_ADMIN_EMAILS;
    const list = (fromEnv && fromEnv.trim() !== '' ? fromEnv : OWNER_EMAIL)
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return list;
}

export function isSuperAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    return allowedEmails().includes(email.trim().toLowerCase());
}

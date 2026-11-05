// Google sign-in is available only when the build has a Google client id (VITE_GOOGLE_CLIENT_ID). Without one there is no
// GoogleOAuthProvider, and the library's hooks throw "Google OAuth components must be used within GoogleOAuthProvider" - so the login
// pages must not call them, and must not show the button.
export const isGoogleEnabled = (clientId) => Boolean(String(clientId ?? "").trim());

export const GOOGLE_CLIENT_ID = String(import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? "").trim();
export const googleEnabled = isGoogleEnabled(GOOGLE_CLIENT_ID);

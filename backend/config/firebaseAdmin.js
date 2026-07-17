const admin = require("firebase-admin");

let app = null;
let warned = false;

// Lazily initializes the Firebase Admin SDK from env-provided service account
// credentials. Returns null (instead of throwing) when credentials are
// missing so push sends no-op gracefully instead of taking down the server.
function getFirebaseApp() {
  if (app) return app;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    if (!warned) {
      console.warn(
        "[push] FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY not set; push notifications are disabled."
      );
      warned = true;
    }
    return null;
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  return app;
}

module.exports = { admin, getFirebaseApp };

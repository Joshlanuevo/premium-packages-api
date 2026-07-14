import admin from "firebase-admin";

let app: admin.app.App;

// Picks DEV_ or PROD_ prefixed vars based on NODE_ENV, so both sets can live in the
// same .env without collisions. Defaults to DEV_ unless NODE_ENV=production.
function envPrefix(): "DEV_" | "PROD_" {
  return process.env.NODE_ENV === "production" ? "PROD_" : "DEV_";
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing env var ${name}. Check your .env has ${envPrefix()}FIREBASE_PROJECT_ID / ` +
        `${envPrefix()}FIREBASE_CLIENT_EMAIL / ${envPrefix()}FIREBASE_PRIVATE_KEY.`
    );
  }
  return value;
}

// Lazily initialize so this file can be imported without side effects at module-load time
// (useful for tests, and avoids crashing on missing env vars until actually needed).
export function getFirebaseApp(): admin.app.App {
  if (app) return app;

  const prefix = envPrefix();
  const projectId = requiredEnv(`${prefix}FIREBASE_PROJECT_ID`);
  const clientEmail = requiredEnv(`${prefix}FIREBASE_CLIENT_EMAIL`);
  const privateKey = requiredEnv(`${prefix}FIREBASE_PRIVATE_KEY`).replace(/\\n/g, "\n");

  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });

  return app;
}

export function getFirestore() {
  return getFirebaseApp().firestore();
}

export function getAuthAdmin() {
  return getFirebaseApp().auth();
}

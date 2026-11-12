// The Azure Speech SDK, loaded only when someone actually needs it.
//
// It is an npm package (the app's page security policy blocks scripts from any CDN) and a dynamic import(), so the ~500 KB bundle is a
// separate file that is downloaded only when the live transcript feature is on AND a call starts. With the feature off, or on any other
// page, it is never requested. A failed load is not cached, so the next try can succeed.
let pending = null;

export function loadSpeechSdk() {
  if (!pending) {
    pending = import("microsoft-cognitiveservices-speech-sdk").catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

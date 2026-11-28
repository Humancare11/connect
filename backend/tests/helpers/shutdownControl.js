// Test-only preload (node -r): runs the server's own SIGTERM handler when the
// parent test asks over IPC. Never loaded by the application.
process.on("message", (message) => {
  if (message === "shutdown") process.emit("SIGTERM");
});
process.channel?.unref();

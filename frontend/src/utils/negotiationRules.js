// Who may negotiate, and when, on the appointment call. The patient is the only
// side that offers a new session; the doctor answers. After a rejoin exactly one
// path runs: the doctor's fresh connection asks the patient to rebuild, the
// patient sends one offer, the doctor answers.

// The patient leaves this long for that request before restarting ICE itself.
export const REJOIN_RESTART_HOLD_MS = 2500;

// "send", or the reason an offer must not be created now.
export function offerBlocker({
  isDoctor,
  iceRestart,
  hasRemoteDescription,
  mediaSettled,
  rebuildInProgress,
  socketConnected,
  now,
  holdUntil,
}) {
  if (rebuildInProgress) return "rebuild_in_progress";
  // An offer built before the camera is attached negotiates "I send nothing".
  if (!mediaSettled) return "media_not_ready";
  // It could not be delivered, and would leave the connection waiting for an answer.
  if (!socketConnected) return "signaling_down";
  // The doctor only renegotiates a session that already exists.
  if (isDoctor && !hasRemoteDescription) return "doctor_has_no_session";
  if (iceRestart && hasRemoteDescription && now < holdUntil) return "waiting_for_rejoin";
  return "send";
}

// An ICE restart only means something for an established, idle session.
export const canRequestPeerRestart = ({ hasRemoteDescription, signalingState, rebuildInProgress }) =>
  Boolean(hasRemoteDescription && signalingState === "stable" && !rebuildInProgress);

// The other side asked for an ICE restart: "process", "park" until stable, or
// "drop" (a rebuild or a first offer supersedes it).
export function restartRequestAction({ hasRemoteDescription, signalingState, rebuildInProgress }) {
  if (rebuildInProgress || !hasRemoteDescription) return "drop";
  return signalingState === "stable" ? "process" : "park";
}

// A doctor connection that has never negotiated, in a call that was already
// running, needs the patient to start a new session with it - unless an offer
// has already reached it (a connection built to answer the patient's Retry).
export const doctorNeedsPatientRebuild = ({
  isDoctor,
  resumedCall,
  hasRemoteDescription,
  signalingState,
  offerReceived,
}) =>
  Boolean(isDoctor && resumedCall && !offerReceived && !hasRemoteDescription && signalingState === "stable");

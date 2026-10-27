// ICE-recovery attempt budget shared by the appointment and direct call pages.
//
// `lastAttemptAt` must be the time of the last REAL recovery attempt (one that
// actually spent budget), not the time of the last scheduler tick. The retry
// loop ticks every couple of seconds while a call is unhealthy, so a timestamp
// refreshed on every tick never ages past the cooldown and the budget never
// refills once it has been used up.
export const iceRecoveryBudgetRefilled = (now, lastAttemptAt, cooldownMs) =>
  now - lastAttemptAt > cooldownMs;

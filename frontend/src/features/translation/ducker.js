// Lowers the OTHER person's real voice while a translated sentence plays, and puts it back afterwards.
//
// Browsers differ: Chrome and Firefox honour audio.volume, but an iPhone ignores it (the value never changes). So:
//   1. try element.volume; read it back; if it took, that is all that is needed (desktop);
//   2. if it did not take (iPhone), the only way is to route that element through a Web Audio gain node. That path is OFF unless
//      allowGain is set, because on Safari a remote WebRTC stream played through Web Audio can come out silent, which would mean the
//      patient no longer hears the doctor at all. It must be proven on a real iPhone before it is switched on (see the report).
//      With it off, an iPhone simply does not duck: the real voice stays at full volume while the translation plays.
export const DUCKED_VOLUME = 0.2;

export function createDucker({ getElements, duckedVolume = DUCKED_VOLUME, gainRouter = null, allowGain = false } = {}) {
  const saved = new Map(); // element -> original volume
  let active = false;
  let volumeIgnored = false;
  let usedGain = false;

  return {
    duck() {
      if (active) return;
      active = true;
      for (const el of getElements() || []) {
        if (!el) continue;
        try {
          saved.set(el, el.volume);
          el.volume = duckedVolume;
          if (Math.abs(el.volume - duckedVolume) > 0.01) {
            volumeIgnored = true;
            if (allowGain && gainRouter) { gainRouter.duck(el, duckedVolume); usedGain = true; }
          }
        } catch { /* an element that cannot be ducked is simply left alone */ }
      }
    },
    restore() {
      if (!active) return;
      active = false;
      for (const [el, volume] of saved) {
        try { el.volume = volume; } catch { /* ignore */ }
        if (usedGain && gainRouter) { try { gainRouter.restore(el); } catch { /* ignore */ } }
      }
      saved.clear();
    },
    status: () => ({ active, volumeIgnored, usedGain, gainAllowed: Boolean(allowGain) }),
  };
}

// The Web Audio route used only when allowGain is true and volume is ignored. `ctx` is an AudioContext.
export function createGainRouter(ctx) {
  const routes = new Map(); // element -> { source, gain, wasMuted }
  return {
    duck(el, volume) {
      let route = routes.get(el);
      if (!route) {
        const stream = el.srcObject;
        if (!stream) return;
        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(ctx.destination);
        route = { source, gain, wasMuted: el.muted };
        routes.set(el, route);
        el.muted = true; // the element would otherwise play the same audio a second time
      }
      route.gain.gain.value = volume;
    },
    restore(el) {
      const route = routes.get(el);
      if (route) route.gain.gain.value = 1;
    },
    release(el) {
      const route = routes.get(el);
      if (!route) return;
      try { route.source.disconnect(); route.gain.disconnect(); } catch { /* ignore */ }
      el.muted = route.wasMuted;
      routes.delete(el);
    },
  };
}

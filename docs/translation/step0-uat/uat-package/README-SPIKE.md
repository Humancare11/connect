# Speaker-side spike (update to the step 0 package)

Changed or new files: `server.mjs` (adds a small in-memory caption relay), `speaker.html` (new), `test.html` (one link added).
The relay stands in for the real Socket.IO events. Caption text is only forwarded to the other client in the same room,
never logged or stored.

## What it tests

1. Own-mic translation on the iPhone: your voice -> original text + English record (+ the other person's language).
2. Adding a translation language while the recognizer is running, without restarting it (the "sessions started" counter must stay 1).
3. Translated voice that starts from an incoming caption after ONE tap on START (no more taps).
4. Bonus: mute pauses the recognizer (a "GAP" line appears); echo of the phone's own translated voice is hidden.

## Update on the server (after copying hc-step0-spike-update.zip to /tmp)

    python3 -m zipfile -e /tmp/hc-step0-spike-update.zip /opt/hc-step0-test/
    sudo systemctl stop hc-step0 2>/dev/null; sudo systemctl reset-failed hc-step0 2>/dev/null
    sudo systemd-run --unit=hc-step0 --uid=ubuntu --working-directory=/opt/hc-step0-test "$(command -v node)" server.mjs
    curl -s http://127.0.0.1:8787/status

Restarting also resets the 6-hour auto-stop.

## Test URLs (replace SECRET; both devices must use the same room)

Laptop (Chrome), hands-free English sample voice every 25 s:

    https://54.82.47.239/step0-SECRET/speaker.html?room=spike1&input=sample-en&speech=en&read=none

iPhone (Safari), real microphone:

    https://54.82.47.239/step0-SECRET/speaker.html?room=spike1&input=mic&speech=auto&read=none&path=push&play=ctx

## Steps

Start the laptop first (tap START). Then on the iPhone tap START once and allow the microphone. Keep the iPhone screen on and the volume up.

1. Own-mic translation: say one clear sentence on the iPhone (German is ideal, English is fine).
   Expect within about 3 seconds an `ME (de-DE, conf 0.9x): <your words> | EN: <English>` line on the iPhone and the same sentence on the laptop.
2. Add a target without restart: on the LAPTOP change "I READ and HEAR" to Spanish. On the iPhone the log shows
   `peer now reads: es` and `targets now: en,es | sessions started so far: 1`. Say another sentence: the laptop's subtitle box shows it in Spanish.
3. Voice after one tap: on the iPhone change "I READ and HEAR" to German (leave "Hear translated voice" ticked) and do NOT tap anything else.
   Within 25 seconds the laptop's English sample arrives: the iPhone shows German subtitles and SPEAKS them.
   The log shows `voice ready after N ms; audio context state: running`.
   Then reload the iPhone page with `&play=sdk` at the end of the URL, tap START, and repeat (informational: does the SDK's own speaker also work?).
4. Echo: while the German voice plays, stay silent. No `ME` lines with nonsense should appear. Hidden echo lines are counted as "own-TTS echo suppressed".
5. Mute: tap Mute, speak for 5 seconds, tap Unmute, speak again. A GAP START / GAP END line appears and "recognizer sessions started" stays 1.
6. Optional: lock the iPhone for 10 seconds, unlock. Does the log still show audio flowing and new captions arriving?

Tap **Copy results** on both pages and send them. A silent voice or a blocked mic is a useful result.

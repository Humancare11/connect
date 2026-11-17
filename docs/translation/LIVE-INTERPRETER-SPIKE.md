# Live Interpreter spike (Step 0)

Status: research and test page done. **I could not run the live audio test myself** (it needs your microphone and speakers), so the latency and accuracy results are still empty. Section 4 is where you write them.

The real app was not changed. Everything is in `docs/translation/` (this file plus `live-interpreter-spike/`). No keys are stored anywhere.

---

## DECISION (after test rounds B and C): **NO-GO for now. We keep the classic engine.**

Decided by the product owner after the second test round. The spike folder stays in the repo for a later retry; it contains no keys (the key is only ever read from the terminal's environment).

What the second round showed (laptop, Chrome, headphones, 11 speeches of about 2 to 3 seconds each):

| Check | Result | Verdict |
|---|---|---|
| Translated voice starts **before** the speaker stops | **0 of 11** | Fails the main reason for choosing Live Interpreter |
| First translated audio | median **5.3 s** from speech start; about **2 to 3 s after the speaker stopped** | Slower than hoped; not better than a good classic setup |
| Translation quality Hindi to English and English to Hindi | Good both ways | Pass |
| Original (source-language) text for Hindi | Still **"."** for every Hindi phrase, also with the continuous-detection setting | **Fail**: we have no source-language record |
| Parallel recognizer text for Hindi | **None** returned in the test | Not available as a fallback in that setup |
| Language label | Still `other` | **Fail**: no reliable language label |

Why NO-GO: the three things we needed were (1) a voice that starts while the person is still talking, (2) the original-language text for the transcript, and (3) a reliable language label. None of the three worked in testing. The one thing that worked (translation quality) we already have in the classic engine.

Revisit when: Microsoft documents (or confirms in writing) source-language text and a reliable language label for Hindi in Live Interpreter, or the 2 to 3 s behaviour is shown to be a setting we missed. The test page in `live-interpreter-spike/` can be re-run in about 30 minutes.

**What we do instead:** make the classic engine as fast as possible (see section 9).

---

## 0. Recommendation (short), written BEFORE the decision above

**Updated after your first test round: NOT YET GO. Keep going with the spike (still "conditional").**

What your results proved:
- It works from the browser with our key and our short-lived token. (Open question "does the token work" is answered: yes.)
- Hindi to English translation quality is good on clean speech.

What they did **not** prove, and what blocks a GO:
1. **The original text is missing** for Hindi (every Hindi row shows "."). Without it we have no source-language record. The only safe fix I can see is to also run a normal recognizer next to the interpreter (about +$1.00/hour). See section 4.
2. **"Speaks before the sentence ends" is not proven.** The 155 to 1166 ms numbers cannot be real (see 4.2). The honest numbers are 4 to 20 s after speech start, and we do not yet know how long you spoke in each row.
3. **The language label is unreliable** ("ar", "other"). I found a likely cause in the SDK (language detection runs "at start" only) and a setting to test (section 4.3).
4. **Background voices are translated** (section 4.4).

Revised pass marks (my suggestion):

| Test | Pass |
|---|---|
| First translated audio, measured from speech start, on 10 normal sentences | median 3 s or less, and audio starts before you finish in most of them |
| Original-language text for every Hindi phrase (from the interpreter or a parallel recognizer) | Yes, readable |
| Language label on Hindi speech | `hi-IN` in 9 of 10 phrases |
| Quiet-room meaning accuracy | 9 of 10 phrases correct |
| Noisy room | Background voices do not get translated with the gate on (or we accept a "quiet place" notice) |

Open questions that could still make this a NO-GO are in section 7 (HIPAA, the English record).

---

## 1. What Microsoft says (official docs)

Sources: [Live Interpreter how-to](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-use-live-interpreter), [Speech translation overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-translation), [Regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions?tabs=speech-translation).

- **What it is**: real-time speech-to-speech translation. It "continuously identifies the language being spoken without requiring you to set an input language" and returns translated speech while the person is still talking.
- **SDK**: it is the normal Speech SDK `TranslationRecognizer`, talking to the **universal v2** endpoint. Microsoft has samples for Python, C#, JavaScript, Java, C++, Go, Objective-C and Swift.
- **No input language ("open range")**: JavaScript is `sdk.AutoDetectSourceLanguageConfig.fromOpenRange()`. You pass no candidate languages.
- **Voice**: `translationConfig.voiceName = "..."`. Microsoft's samples use `"personal-voice"` (a voice that sounds like the speaker; it needs a separate Microsoft access application). The text says it "supports both prebuilt voices and your own personal voice", so a normal neural voice should work. **The test page uses a normal neural voice by default.**
- **Events**: `recognizing` (partial text and partial translation), `recognized` (final text and translation), `synthesizing` (translated audio bytes; a zero-length chunk marks the end), `canceled`, `sessionStopped`.
- **Optional LLM variant**: add `?setfeature=llm` to the endpoint. The test page has a switch for it.
- **Regions**: Live Interpreter is available in `eastus`, `japaneast`, `southeastasia`, `westeurope`, `westus2`. Our `connect-speech` resource is in `eastus`, so it is covered.
- **Speed**: Microsoft only says "low latency". There is no number anywhere.

### Does it work in the browser?

Microsoft's JavaScript sample is a Node.js sample (reads a WAV file with `fs`). It does not say whether browsers work. I checked the SDK we already install (`microsoft-cognitiveservices-speech-sdk` **1.53.0**, in `frontend/node_modules`):

- `AutoDetectSourceLanguageConfig.fromOpenRange()` exists (it sends the value `UND`).
- `TranslationConnectionFactory` uses `/stt/speech/universal/v2` by default.
- It adds `voice=...` and `features=requireVoice` to the connection when a voice is set.
- It raises the `synthesizing` event with audio.
- `TranslationRecognizer` accepts the normal microphone input in the browser.

So **the browser SDK has everything**. No server relay is needed to get the feature working. What I could not check without audio is whether the service accepts our short-lived token (`fromAuthorizationToken`) for this mode; Microsoft's samples use a key. The test page uses the token, exactly like `/api/speech-token`, so your test answers that too.

**Our current engine already uses the same classes** (`SpeechTranslationConfig` + `TranslationRecognizer`, see `frontend/src/features/translation/recognizerController.js`). So this is a configuration change plus new audio handling, not a new technology.

### Preview or GA?

Unclear, and the sources disagree:

- Microsoft's current docs pages do not say "preview" anywhere I read.
- News and Microsoft blog posts say public preview in September 2025, and general availability announced at Ignite 2025 (76 input languages).
- The Foundry model catalog page lists it as **Limited Access**.

Please confirm in the Azure portal that `connect-speech` can call it. If your key is rejected in the test, this is the reason to check.

### Languages

The docs only show examples (`zh-Hans`, `fr`). The "76 input languages" figure comes from the announcements. I could not get Microsoft's exact list from the pages I could read. **Hindi, English, German as input and output are not confirmed by an official table I could read.** Your four tests will prove them.

---

## 2. Price (Azure Retail Prices API, region `eastus`, USD, checked today)

| Meter | Price |
|---|---|
| Live Interpreter input audio | **$1.00 / hour** |
| Live Interpreter standard audio output (prebuilt voice) | **$1.50 / hour** |
| Live Interpreter custom audio output (personal voice) | $2.00 / hour |
| Live Interpreter text output | $10 per 1M characters |
| Current: Speech Translation S1 | $2.50 / hour (up to 2 target languages) |
| Current: Neural text-to-speech S1 | $15 per 1M characters |

**Per speaker-hour (only while that person is talking and a language is picked):**

- Current engine: $2.50 + text-to-speech. About 750 spoken characters per minute is 45,000 per hour, so about $0.68. **About $3.2 per hour.**
- Live Interpreter: $1.00 + $1.50 = $2.50, plus text output. If all 45,000 characters are billed as text output, that adds about $0.45. **About $2.5 to $3.0 per hour.**

So the cost is **about the same, possibly a little lower**. These are estimates: how Microsoft counts "audio hours" (talking time or connected time) is not stated, and I assumed connected time. Our existing safeguards (stop when no language is picked) matter for both engines.

---

## 3. How to run the test page

The page and a tiny local server are in `docs/translation/live-interpreter-spike/`. The key stays in the server's memory and is never sent to the browser; the browser gets a 10-minute token from `/token`, the same idea as `/api/speech-token`. The server only answers requests from your own computer.

In **PowerShell**:

```powershell
cd c:\aaamain\connect\docs\translation\live-interpreter-spike
$env:AZURE_SPEECH_KEY = "<paste the connect-speech key here>"
$env:AZURE_SPEECH_REGION = "eastus"
node server.js
```

Then open **http://localhost:5599** in Chrome and allow the microphone.

(The key goes in that terminal window only. Nothing is written to a file. I did not read `.env`. If you prefer, copy the key from your backend `.env` yourself.)

**Use headphones.** Otherwise the microphone hears the translated voice and translates it again.

On the page:

1. Pick **I will speak** (leave on "Unspecified" for the no-input-language tests) and **Translate to**.
2. Press **Start**, speak two or three sentences with a pause between each, then press **Stop**.
3. Read the table: each row is one phrase. The columns are milliseconds counted from when you started speaking (measured by a separate microphone level meter on the page):
   - to the first partial text,
   - to the first translated audio,
   - to the final text.
4. Press **Copy results as text** and paste it into section 4 (or send it to me).

Tests to run:

| # | I speak | Input setting | Translate to |
|---|---|---|---|
| 1 | Hindi | Unspecified | English |
| 2 | English | Unspecified | Hindi |
| 3 | English | Unspecified | German |
| 4 | German | Unspecified | English |
| 5 | Hindi (the important one) | Unspecified | English; watch "detected language" in the table. It must say `hi-IN`, never `te-IN` or `gu-IN` |

Also try: the same Hindi test with **Variant = LLM**; one test with **mute translated voice** ticked (text only); and one long monologue (30 s) to see whether translation keeps up.

If something fails, the **Event log** at the bottom shows the Azure error text. The most likely errors are an access or "not available for this resource" message (then ask Microsoft/Azure portal about Limited Access), or a voice name error (then try another voice in "custom name").

What I tested without audio: the page and server start, `/` and `/sdk.js` are served, `/token` reports Azure's answer (401 with a fake key, as expected), and the SDK builds the open-range config (`UND`) and voice setting correctly.

---

## 4. Test round 1 (laptop, Chrome, headphones, office with background voices, open range, target English)

18 speeches. Summary of what you saw: translation meaning is good on clean Hindi; first translated audio between 0.15 s and 20 s; the original text is "." for almost every Hindi phrase; language label often `ar` or `other`; background voices are translated.

### 4.1 Problem 1: original text is "." (blocking)

- **Where it comes from:** the SDK copies the text straight from the service's `DisplayText` field (`TranslationPhrase.js`). So the service itself sent ".". It is not a page or SDK bug.
- **Why:** I cannot tell from the docs. The Live Interpreter docs print the source text in their sample, but do not promise it for every language. My guess (not proven): in this mode the service translates speech directly and only fills the source text when it is sure of the source language; row 6 (English, detected `en-us`) had it, every `hi`, `ar` and `other` row did not. The detection problem (4.3) may be the real cause.
- **What I changed on the page (v2):**
  1. It logs the **raw JSON** of the first 4 results (or all, with the checkbox). That shows every field the service sends, and the page also looks inside it for other text fields (`Text`, `Lexical`, `NBest`).
  2. A checkbox **"also run a plain speech recognizer in parallel"** with a candidate list (default `hi-IN,en-IN`). It listens to the same microphone and puts its text in its own column next to the interpreter's. This is the safe fallback for the transcript.
- **What it means for the design if the interpreter never gives source text:** we run a second recognizer for the record. Cost: about +$1.00 per speaking hour (standard speech-to-text). The classic engine's candidate-language rules (Hindi always a candidate, sticky language) then give the language label too. Total about **$3.9 per hour** against about $3.2 today. Still workable, but the design is then "interpreter for the voice, recognizer for the record", which is more complex.

### 4.2 Important correction: the very fast audio numbers are probably wrong

Rows 6, 11, 14, 15, 16, 17 show first audio at 155, 1166, 498, 620, 198, 181 ms. A translation cannot be spoken 0.2 s after you start talking, because the service needs your words first. The old page gave the first audio chunk it saw to the current row, so these are almost certainly the **tail of the previous phrase's translated voice** arriving while the next row had just begun (row 10 ran 22 s, row 14's final came after 16 s, and so on).

So what is **proven** is only the slower group: 4.2 to 20 s after speech start (rows 1, 2, 3, 4, 7, 8, 9, 10, 12, 18). The median of those is about 7 s. That is not yet "Google Meet style". But those speeches may have been long (the old page did not record how long you spoke), so 7 s could still be "during the sentence". **Page v2 measures exactly this**: it records how long each speech lasted, matches each burst of translated voice to the right speech, and shows "audio began before I stopped? YES/no". The summary line at the top shows the average, median, fastest and slowest first-audio time.

### 4.3 Problem 2: language label `ar` / `other`

- **Likely cause (found in the SDK source):** `AutoDetectSourceLanguageConfig.fromOpenRange()` creates the config in **"AtStart" mode**. That means the service decides the language from the first moments of audio, not for every phrase. The docs say Live Interpreter "continuously identifies" the language, so the SDK default does not match the docs. The SDK has a switch for it: `config.mode = LanguageIdMode.Continuous`.
- **`other`** is the service's label for "no confident match". `ar` for Hindi is a genuine wrong guess of open-range detection on short or noisy audio, the same kind of mistake as the Telugu/Gujarati one we guard against today.
- **Candidate languages:** yes, the SDK accepts a candidate list (`fromLanguages(["hi-IN","en-IN"])`) instead of open range. Whether Live Interpreter accepts it is not documented; the page has a field to try it.
- **Page v2:** a **"Language detection" selector (Continuous, default / At start)** and a **candidate languages field** (empty = open range). The table shows the label per speech.
- **Reliable label in the product:** if the label stays poor, we take the language from the parallel recognizer (which uses our short candidate list) and treat the interpreter's label as a hint only.

### 4.4 Problem 3: background voices are translated

Notes for the integration:
- The service has no "only the person closest to the mic" logic; it translates whatever speech it hears. Rows 2, 4, 8, 9 and the very long phrases look like office voices.
- Background speech also keeps a phrase "open", which is a main cause of the 15 to 22 s phrases (4.5).
- What we already have in the classic engine and must keep: mic level meter, the echo filter, a loud-enough threshold.
- New for the live engine: **a level gate in our own microphone pipeline** (send silence to Azure when the mic is quieter than a threshold relative to this person's usual speaking level). Page v2 has this: set "Microphone path = Our own pipeline" and a "Noise gate level" (try 0.03 to 0.06). It is a simple test of the idea, not final tuning.
- Confidence/level filtering per phrase: only possible if the service returns confidence; the raw JSON will show whether it does.
- Product notice: a short line "Please sit in a quiet place" in the call screen. Cheap and helps both engines.

### 4.5 Problem 4: why latency changes from 0.15 s to 12 s (and what to set)

What controls it (from the SDK code and Microsoft's property list; not measured):
1. **When a phrase ends.** The service cuts a phrase after a silence. Noise or background talk means silence never comes, so phrases run 15 to 22 s (rows 9, 10, 14, 15). Page v2 has **"Phrase ends after silence (ms)"** and **"Longest phrase (ms)"** (SDK properties `Speech_SegmentationSilenceTimeoutMs` and `Speech_SegmentationMaximumTimeMs`). Try 500 and 8000.
2. **Language detection at start** (4.3) delays the first words until the language is chosen.
3. **Translation needs context.** Hindi word order puts the verb at the end, so a good English sentence often has to wait for the end of the Hindi clause. Some delay for Hindi to English is natural; English to German has the same issue. This is why English to Hindi may feel different.
4. **Stable partial results** (checkbox on the page): fewer rewrites of the partial text; may or may not change audio timing.
5. **Voice queue:** translated speech is spoken in order, so when one translation runs long the next one waits behind it.
6. **Network distance:** our resource is in `eastus`. If most users are in India, `southeastasia` is also a Live Interpreter region and is closer. That means a new resource in that region, and a data-location decision; a later test, not now.

### 4.6 Still not answered
- Does Live Interpreter return a **confidence score** per phrase? (Check the raw JSON.)
- Does it return text for German and English with the original too? (Your next tests.)
- Does `fromLanguages` (candidate list) work with Live Interpreter?

### 4.7 What to test next (about 30 minutes, headphones)

Just refresh the browser tab (the server does not need a restart). Quiet room first.

| Step | Settings | Do | Send me |
|---|---|---|---|
| A | Unspecified, Continuous, no parallel | Speak 5 Hindi sentences, 5 to 8 s each, pause 3 s between | **the 4 "RAW ..." lines from the log**, and the blue summary line |
| B | Same, tick **parallel recognizer** | 5 more Hindi sentences | the table (Copy results button) |
| C | Candidates = `hi-IN,en-IN`, Continuous | 5 Hindi sentences | does it start? labels? |
| D | Segmentation: silence **500**, longest **8000**, stable ticked | 5 Hindi sentences | summary line (compare with A) |
| E | Office noise, Microphone path = own pipeline, gate **0** then **0.04** | 5 sentences each, background voices on | which one translates the background voices |
| F | English to Hindi, English to German, German to English | 5 sentences each (also one LLM variant test) | summary line + table |

In every run, also write down: did you feel the voice starts while you are still talking, yes or no.


---

## 5. HIPAA / BAA

I could not find any statement that is specific to Live Interpreter.

- Secondary sources and Microsoft Q&A answers list Azure Speech (speech-to-text, text-to-speech) as covered by Microsoft's BAA through the Online Services Data Protection Addendum. I did not retrieve Microsoft's own list.
- Microsoft's BAA applies only to services on its official HIPAA scope list. **Live Interpreter, a new feature, may not be on it, and it is shown as Limited Access in the catalog.**
- Microsoft says Speech data is stored and processed in the region of the resource (eastus).

**What to do before real patient calls**: check the official page "Azure and other Microsoft cloud services compliance scope" for HIPAA (the "Azure services" list), confirm Live Interpreter and the v2 universal endpoint are in it, and ask Microsoft in writing. Until then, treat it as **not confirmed**. The same question applies to the current engine, so this is not a new risk class, but the new feature is the one that is unproven.

---

## 6. Integration design for our app

### What stays the same

Keep: transcript saving, the "this call is transcribed" notice, language panel, the one-voice rule (the real voice is muted when a language is picked), the heartbeat and silent-failure safety, echo filter, gaps. The engine switch is a new backend setting:

```
TRANSCRIPTION_ENGINE=classic|live      (default: classic)
```

It is sent to the browser by the existing `GET /api/transcription/config`. The call screen creates either the classic engine or the live one. Changing the value back to `classic` is the whole rollback. Both engines keep the same outside shape (`state`, `setLanguage`, captions, transcript rows) so the screen does not know the difference.

### The flow (speaker-side, as you asked)

1. Each browser opens **one** `TranslationRecognizer` on **its own microphone**, with open-range detection, and **one target language = the other person's chosen language**. It tells the other side its status the same way it does today.
2. If the other person picks "Real voice (no translation)", the speaker's recognizer is **closed**. Nothing is billed.
3. If the other person changes language, the recognizer is restarted with the new target (the SDK cannot change the target during a session). The current "language announced" message already tells the speaker what to use.
4. `synthesizing` gives translated audio chunks (16 kHz mono) plus text events.
5. The translated audio is delivered to the **listener** (below). The listener's real-voice mute stays under the current `realVoiceGuard`.

### How the translated audio gets to the listener (my recommendation)

| Option | How | For | Against |
|---|---|---|---|
| **A. Chunks over our existing realtime channel** (Socket.IO caption relay, or a WebRTC data channel) | Speaker sends the small PCM chunks (about 32 KB/s, 256 kbps); listener plays them in an `AudioContext` queue | No change to the WebRTC call itself, simplest, works with all current call code, easy to test | Needs its own jitter buffer; a bit more data; TCP can stall |
| **B. Extra audio track on the existing `RTCPeerConnection`** | A `MediaStreamAudioDestinationNode` feeds a track that is added at call start and carries silence until a language is picked | Best audio quality and timing, same path as the real voice | Needs the track in the first negotiation (renegotiation later is fragile, especially on iPhone); the call code in `VideoCall` must change |
| **C. Server relay** (browser sends mic to our Node, Node talks to Azure) | | Server sees transcript, key never in a browser | New server load, new audio path both ways, much more work, and cost of running media |

**Start with A** because it can be built and rolled back without touching the video call. Move to B only if A's audio quality is not good enough. C is not needed because the browser SDK works.

### Things that need extra care

- **Echo on the listener's device**: the listener's microphone can hear the translated voice from the speaker and send it back. Our echo filter and the real-voice guard stay and must be retested with the new audio.
- **The English "record"**: today every phrase is saved with an English translation as well as the listener's language (two targets). The docs show one target for Live Interpreter. If the listener reads German, we still want an English record. Options: ask Microsoft if a second text-only target is allowed, or run the final text through text translation ($10 / 1M characters). **To be answered by your test and the Microsoft docs.**
- **Confidence tiers** (unclear / low) depend on a score. If Live Interpreter has none, we need another signal.
- **Speaker's own language "sticky" rule and detection**: today we guard against the Telugu/Gujarati mix-up by controlling candidate languages. Open-range removes that control, which is exactly why test 5 matters. If it fails, the fallback is `fromLanguages([...])` with a short candidate list, which the same SDK supports.

### Estimate (working days, one developer, including tests)

| Step | Work | Days |
|---|---|---|
| 1 | Backend: `TRANSCRIPTION_ENGINE` setting, config endpoint, token endpoint check for v2 | 0.5 |
| 2 | `liveRecognizerController`: open-range, target = listener language, restart on change, events to text rows | 2 |
| 3 | Audio delivery A: chunk sender, listener player with buffering, hooks into the one-voice rule | 2 to 3 |
| 4 | Transcript, captions, notice and English record on the live path (including confidence tiers) | 2 |
| 5 | Safety: heartbeat, silent failure, gaps, echo, "didn't catch", status messages | 2 |
| 6 | Automated tests and real-device tests (Chrome, Android, iPhone Safari) | 3 |
| 7 | Staged rollout (flag on for test accounts first), monitoring | 1 |
| | **Total** | **12.5 to 13.5** |

Option B for audio (instead of A) would add about 3 days.

---

## 7. Open questions for you / Microsoft

1. ~~Does `connect-speech` accept Live Interpreter today?~~ Yes, with our token (round 1).
2. Is Live Interpreter in Microsoft's HIPAA/BAA scope? (Needs a written answer.)
3. Can Live Interpreter return a second target language as text only (for the English record)?
4. Does it return confidence? (raw JSON from test A will show it)
4b. Does it return source-language text at all for Hindi? If not, the design needs the parallel recognizer (+$1.00/hour), see 4.1.
5. Do you want personal voice (the translated voice sounds like the speaker)? It needs a Microsoft access application and consent rules, so I suggest not now.

---

## 8. Stop here

Please run the tests in section 4.7 and send me the raw JSON lines, the summary lines and the copied tables. Then I update this verdict:

- **GO**: I start with Step 1 and 2 above, behind `TRANSCRIPTION_ENGINE=live`.
- **NO-GO**: we keep `classic` and I record why.

Current position: **not yet GO.** The decision turns on (a) whether the first translated audio really starts before you finish speaking, and (b) whether we can get a reliable original-language text and language label (from the interpreter, or from a parallel recognizer at +$1.00/hour).

---

## 9. Follow-up: making the classic engine faster (done on branch `currency`)

| # | Change | Where |
|---|---|---|
| 1 | Shorter end-of-sentence wait: the Speech SDK setting `Speech_SegmentationSilenceTimeoutMs` is now set from the server value `TRANSCRIPT_SEGMENTATION_SILENCE_MS` (default **600 ms**, allowed 200 to 3000, `default` or `0` = send nothing and keep the Azure default). It reaches the browser in `GET /api/transcription/config` as `speed.segmentationSilenceMs`. | backend `utils/speech/config.js`, `routes/transcriptionConfig.js`; frontend `featureFlag.js`, `recognizerController.js` |
| 2 | Voice without a cold start: the speech synthesizer is created and its connection opened as soon as a language is picked, and again (at most every 4 s) when the other person starts a sentence. The sound for each sentence is also made the moment it arrives, while an earlier sentence is still speaking. | `engine.js` |
| 3 | Speaking long sentences in chunks: **not built.** Partial translations are not stable (the end of a Hindi or German clause can change the start), so chunked speech risks wrong or repeated words. Measure first (item 4), build only if the numbers show a long wait for long sentences. | |
| 4 | `[tr-diag]` timing lines (numbers only, no words): `timing: my sentence` (speaker stopped to final), `timing: caption received`, `timing: voice started`. | `engine.js` |

# Step 0 speech test on UAT (temporary, standalone)

Nothing here touches the Humancare Connect backend or frontend. It is one small Node process (no npm install) plus one
nginx block. Both are removed at the end.

## 1. Files and where they go

Copy the first 4 files to **/opt/hc-step0-test/** on the UAT server (outside the app folders and outside the nginx web root). The `.env` is created there in step 3:

| File | What it is |
|---|---|
| server.mjs | the test server (listens on 127.0.0.1:8787 only, stops itself after 6 hours) |
| test.html | the test page (phone suite) |
| echo.html | the microphone / echo / volume page |
| sdk.js | the Azure Speech SDK, version 1.53.0 (served locally, no CDN) |
| .env | created from .env.example (step 2) |

nginx: add the block from `nginx-step0.conf.snippet` inside the existing UAT server block.

## 2. Settings the UAT needs

The real UAT backend needs NO change (its .env is not touched). The test process has its own `.env`:

    AZURE_SPEECH_KEY=<connect-speech key>
    AZURE_SPEECH_REGION=eastus

Alternative: do not copy the key. Start the server with `STEP0_ENV_FILE=/path/to/uat/backend/.env`; it reads only
AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, STEP0_TTL_HOURS and STEP0_PORT from that file and ignores everything else.

## 3. Deploy (about 15 minutes)

Checks first:

    node -v                                   # must be 18 or newer
    ss -ltn | grep 8787                       # must print nothing (port free)
    curl -sI https://eastus.api.cognitive.microsoft.com | head -1    # any HTTP answer = outbound HTTPS works

Then:

    sudo mkdir -p /opt/hc-step0-test && sudo chown <app-user> /opt/hc-step0-test
    # copy the 4 files in, then:
    cp .env.example .env && nano .env && chmod 600 .env
    SECRET=$(openssl rand -hex 12); echo $SECRET          # write it down: it is part of the URL
    printf "tester:$(openssl passwd -apr1 'CHOOSE-A-PASSWORD')\n" | sudo tee /etc/nginx/step0.htpasswd >/dev/null
    # paste nginx-step0.conf.snippet into the UAT server block, replacing SECRET with the value above
    sudo nginx -t && sudo systemctl reload nginx
    sudo systemd-run --unit=hc-step0 --working-directory=/opt/hc-step0-test --uid=<app-user> /usr/bin/node server.mjs

(If you do not use systemd: `cd /opt/hc-step0-test && nohup node server.mjs > step0.log 2>&1 &`.)

Check it works before using the phone:

    curl -s -u tester:CHOOSE-A-PASSWORD https://uat.humancareconnect.co/step0-SECRET/status
    # expect: {"ok":true,"azureTokenHttp":200,"region":"eastus", ...}

## 4. iPhone test

Before you start: normal Safari tab (not private), silent switch off, volume up, screen kept awake, Wi-Fi.

1. Open `https://uat.humancareconnect.co/step0-SECRET/` (keep the trailing slash). Enter the user and password.
   The first log line must say `secure context: true`.
2. Tap the green **PHONE SUITE** button once. Keep the page open and the screen on for about 3 minutes. You will hear a
   German then an English test voice from the phone. At the end the log shows `SUITE SUMMARY` with four lines
   (S1 to S4), each PASS or CHECK.
3. Tap **2. Play translated voice**. You should hear an English voice. Write down if it is silent.
4. Tap **Copy results** (or take a screenshot) and send it to me.
5. Lock test: choose Sample "German", Output "translate to en", Detection "continuous", tap **1. Run one case**,
   lock the phone for 10 seconds, unlock. Tell me if a FINAL line still appeared and whether any error appeared.
6. Tap the link **Open the mic / echo / ducking page**.
   - **A1 Start microphone** -> allow the microphone. The log must say `echoCancellation: true`. Speak: the green bar moves.
   - **B1** with the phone lying on a table, then **B1** again with the phone held at your ear. Do not speak, keep the
     room quiet. Copy the `ECHO RESULT` line each time.
   - **C1**, then tap "It got quieter" or "No change". Repeat with **C2**.
   - With the microphone open (after A1), switch to another app for 10 seconds and come back: does the bar still move?
7. **Copy results** from this page too and send it to me.

If any button says "blocked" or the sound does not start, send a screenshot. That is a useful result, not a failure of
the test.

## 5. Remove it after the test

    sudo systemctl stop hc-step0                       # or: pkill -f "node server.mjs"
    # delete the whole `location = /step0-SECRET` and `location ^~ /step0-SECRET/` block from the nginx server block
    sudo nginx -t && sudo systemctl reload nginx
    sudo rm -rf /opt/hc-step0-test /etc/nginx/step0.htpasswd

Verify it is gone:

    curl -sI https://uat.humancareconnect.co/step0-SECRET/ | head -1     # expect 404, not 200 or 401
    ss -ltn | grep 8787                                                   # expect nothing

Also: clear the key from the shell history if you typed it, and consider regenerating the Azure key if it was copied
anywhere else.

## Safety built in

- listens on 127.0.0.1 only, reachable only through the secret path plus a password
- stops itself after 6 hours (STEP0_TTL_HOURS)
- at most 40 token requests and 40 sample requests per 5 minutes per address
- never returns the Azure key, only 10-minute tokens
- sends X-Robots-Tag noindex

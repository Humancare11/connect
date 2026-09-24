// Direct (link-based, guest) video call (DirectVideoCall.jsx): guest Retry.
import {
  bothRecovered,
  simulateStall,
  test,
  waitForRetryButton,
  waitForVideoFlowing,
} from "../helpers/harness.js";

async function joinAsGuest(party, roomId, name) {
  await party.page.goto(`/direct-video-call/${roomId}`);
  await party.page.getByLabel("Your name").fill(name);
  await party.page.getByRole("button", { name: "Join now" }).click();
}

test.describe("direct call reconnect", () => {
  test.skip(
    !process.env.TEST_DIRECT_ROOM_ID,
    "TEST_DIRECT_ROOM_ID is not set (it is seeded automatically in local mode)",
  );

  test("8 guest taps Retry - video resumes on both sides", async ({ guests }) => {
    const { host, guest, roomId } = guests;

    // The first joiner is the room's initiator; the second is the guest.
    await joinAsGuest(host, roomId, "E2E Host");
    await joinAsGuest(guest, roomId, "E2E Guest");
    await Promise.all([
      waitForVideoFlowing(host.page, { timeoutMs: 40_000, label: "host" }),
      waitForVideoFlowing(guest.page, { timeoutMs: 40_000, label: "guest" }),
    ]);

    await simulateStall(guest.page);
    const btn = await waitForRetryButton(guest.page);
    await btn.click();

    await bothRecovered(host, guest, 10_000, "after guest Retry");
  });
});

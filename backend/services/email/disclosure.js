// The notice added to the footer of a mail that is tracked in some way.
//
// What the mail really does decides the words, so the notice is never wrong about it:
//   opens       the 1x1 image is in the mail
//   links       the mail has links that go through our redirect
//   downloads   attachments are sent as secure download links
//   receipt     the mail asks for a read receipt (the recipient's app decides)
//
// A Super Admin may write one custom line instead (EmailSettings.disclosureText). It then
// replaces the automatic wording for EVERY mail, so it has to cover all four. Left empty,
// the automatic wording is used. The Super Admin can also switch the notice off.

const STOP = 'To stop this, reply to this email with "Do not track".';

const joinList = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

// → the automatic notice for one combination, or "" when nothing is tracked.
function automaticDisclosure({ opens = false, links = false, downloads = false, receipt = false } = {}) {
  const records = [];
  if (opens) records.push("whether it was opened");
  if (links) records.push("which links in it were clicked");
  if (downloads) records.push("whether its download links were used");

  const sentences = [];
  if (records.length) {
    sentences.push(`This email may include technology that records ${joinList(records)}.`);
    if (receipt) sentences.push("It also asks your mail app to send a read receipt, which you can decline.");
  } else if (receipt) {
    sentences.push("This email asks your mail app to send a read receipt when it is displayed. You can decline.");
  } else {
    return "";
  }
  sentences.push(STOP);
  return sentences.join(" ");
}

// state: { disclosureEnabled, disclosureText } from getTrackingState.
function composeDisclosure(flags, state = {}) {
  if (!state.disclosureEnabled) return "";
  const automatic = automaticDisclosure(flags);
  if (!automatic) return "";
  const custom = String(state.disclosureText || "").trim();
  return custom || automatic;
}

// Every combination of the four, for the settings page: [{ label, flags, text }].
function disclosureExamples() {
  const names = [
    ["opens", "opens"],
    ["links", "links"],
    ["downloads", "downloads"],
    ["receipt", "read receipt"],
  ];
  const out = [];
  for (let mask = 1; mask < 16; mask += 1) {
    const flags = {};
    const label = [];
    names.forEach(([key, name], i) => {
      flags[key] = Boolean(mask & (1 << i));
      if (flags[key]) label.push(name);
    });
    out.push({ label: label.join(" + "), flags, text: automaticDisclosure(flags) });
  }
  return out;
}

module.exports = { automaticDisclosure, composeDisclosure, disclosureExamples, STOP };

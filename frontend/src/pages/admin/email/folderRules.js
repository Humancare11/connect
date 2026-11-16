// "First viewed by" (which team member opened a mail in the dashboard) is shown, and can be
// filtered, only in Received and Spam. Never in Sent, and not in "All mail" (which includes sent).
export const showsFirstViewed = (folder) => folder === "inbox" || folder === "spam";

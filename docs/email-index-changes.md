# Email module: index changes (to be created by the owner, not by code)

These indexes make the mail lists and the unread counts fast. **Nothing in the code creates them.**
They are deliberately NOT declared in `backend/models/EmailMessage.js` yet: Mongoose builds
declared indexes automatically when the server starts, which would create them on whatever database
it connects to. Run the commands below yourself, in `mongosh`, on UAT first.

Why: the Sent list asks for `{ mailbox, direction: "out" }` sorted by `messageDate, _id`. The existing
folder index is `{ mailbox, direction, isSpam, messageDate }`; with no `isSpam` in the Sent filter
and an `_id` tie-break in the sort, MongoDB cannot use it for the sort and sorts in memory.

## 1. Before: measure (read-only)

Replace `<mbId>` with a mailbox `_id`. Keep the numbers `executionTimeMillis`, `totalDocsExamined`,
`nReturned` and the stage names (look for a `SORT` stage). Do not copy any mail content.

```js
db.emailmessages.find({ mailbox: ObjectId("<mbId>"), direction: "out" }).sort({ messageDate: -1, _id: -1 }).limit(50).explain("executionStats")
db.emailmessages.find({ mailbox: { $in: [ObjectId("<mbId>")] }, direction: "in", isSpam: false, isReceipt: { $ne: true } }).sort({ messageDate: -1, _id: -1 }).limit(50).explain("executionStats")
db.emailmessages.explain("executionStats").aggregate([{ $match: { mailbox: ObjectId("<mbId>"), direction: "in", isReceipt: { $ne: true }, firstViewedAt: null, gmailRead: { $ne: true } } }, { $group: { _id: "$isSpam", n: { $sum: 1 } } }])
db.emailmessages.stats().avgObjSize
```

## 2. Create (UAT first)

```js
// Sent list (and any list filtered by mailbox + direction)
db.emailmessages.createIndex({ mailbox: 1, direction: 1, messageDate: -1, _id: -1 }, { name: "mailbox_dir_date_id" })

// Received and Spam lists, with the same sort as the query
db.emailmessages.createIndex({ mailbox: 1, direction: 1, isSpam: 1, messageDate: -1, _id: -1 }, { name: "mailbox_dir_spam_date_id" })

// Unread counts (/mailboxes): every field of the $match is in the index
db.emailmessages.createIndex({ mailbox: 1, direction: 1, isSpam: 1, firstViewedAt: 1, isReceipt: 1, gmailRead: 1 }, { name: "unread_counts" })
```

Atlas builds these online. Do it outside the busiest hour anyway.

## 3. After: measure again, then decide

Run the same `explain` commands. A good result: the `IXSCAN` uses the new index, **no `SORT`
stage**, and `totalDocsExamined` is close to `nReturned`.

Only after that, and only if you want to, the two older indexes become redundant:

```js
db.emailmessages.dropIndex("mailbox_1_direction_1_isSpam_1_messageDate_-1")           // covered by mailbox_dir_spam_date_id
db.emailmessages.dropIndex("mailbox_1_direction_1_isSpam_1_firstViewedAt_1")          // covered by unread_counts
```

Check the real names first with `db.emailmessages.getIndexes()`. Leaving them in place is harmless
(slightly slower writes, more disk).

## 4. Then mirror them in the model

Once they exist on a database, tell me and I will add the same three definitions (same keys, same
`name`) to `emailMessageSchema` so a fresh database gets them too. With identical definitions
Mongoose finds them already there and does nothing.

## Production

Same steps, only when you decide. Not before UAT numbers are in.

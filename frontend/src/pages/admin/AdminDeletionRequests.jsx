import DeletionRequestsPanel from "./DeletionRequestsPanel";
import "./ManageUsers.css";
import "./AdminDeletionRequests.css";

// Account-deletion history page. The list itself (filters, search, paging,
// Approve / Reject) is DeletionRequestsPanel, shared with the Manage Users
// "Deletion Requests" tab.
//
// TODO(legal review): the list shows personal data retained after the account
// was deleted. The retention period and wording need legal review.
export default function AdminDeletionRequests() {
  return (
    <div className="adr-page">
      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Deletion Requests</h1>
        <p className="adp-sub">
          Every account-deletion request and what happened to it — kept even after the account is deleted.
        </p>
      </div>

      <div className="adp-card">
        <DeletionRequestsPanel syncUrl />
      </div>
    </div>
  );
}

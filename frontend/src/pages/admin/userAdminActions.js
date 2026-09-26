import api from "../../api";

// Delete / approve-deletion / reject-deletion for a patient account, shared by
// the Manage Users list (row buttons) and the user profile page so both use the
// same confirmations, API calls and messages.
//
// Each returns:
//   { done: false }                          — the admin cancelled the confirm
//   { done: true, ok: true,  message, user } — succeeded (user = updated user on reject)
//   { done: true, ok: false, message }       — failed

export async function deleteUserAccount(userId, userName) {
  if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) return { done: false };
  try {
    await api.delete(`/api/admin/users/${userId}`);
    return { done: true, ok: true, message: "User deleted." };
  } catch {
    return { done: true, ok: false, message: "Failed to delete user." };
  }
}

export async function approveUserDeletion(userId, userName) {
  if (
    !window.confirm(`Approve deletion request for "${userName}"? Their account will be permanently deleted.`)
  ) {
    return { done: false };
  }
  try {
    await api.put(`/api/admin/users/${userId}/delete-request/approve`, {});
    return { done: true, ok: true, message: "Account deletion approved and account deleted." };
  } catch (err) {
    return {
      done: true,
      ok: false,
      message: err?.response?.data?.msg || "Failed to approve deletion request.",
    };
  }
}

export async function rejectUserDeletion(userId, userName) {
  if (!window.confirm(`Reject deletion request for "${userName}"?`)) return { done: false };
  try {
    const res = await api.put(`/api/admin/users/${userId}/delete-request/reject`, {});
    return { done: true, ok: true, message: "Deletion request rejected.", user: res.data?.user };
  } catch (err) {
    return {
      done: true,
      ok: false,
      message: err?.response?.data?.msg || "Failed to reject deletion request.",
    };
  }
}

// The reject endpoint returns the stored user, which lacks the resolved
// signupMethod the admin list/detail endpoints add. Keep the resolved value.
export function mergeUpdatedUser(current, updated) {
  if (!updated) return current;
  return { ...current, ...updated, signupMethod: current?.signupMethod ?? updated.signupMethod };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { marketingAccessApi } from "../../../api/emailMarketingApi";
import { errorMessage } from "./marketingUtils";

// Super Admin only: who may use Email Marketing. A Super Admin always has access; each admin is switched on or
// off here. The server enforces it on every request, so removing access takes effect at once.
export default function AccessPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["marketing", "access-admins"], queryFn: marketingAccessApi.admins });
  const toggle = useMutation({
    mutationFn: ({ id, allowed }) => marketingAccessApi.setAccess(id, allowed),
    onSettled: () => qc.invalidateQueries({ queryKey: ["marketing", "access-admins"] }),
  });
  const admins = q.data?.admins || [];

  return (
    <div className="mk-access">
      <h3>Who can use Email Marketing</h3>
      <small className="mk-hint">Super Admins always have access. Switch it on for the admins who should send campaigns.</small>
      {q.isLoading && <div className="mk-hint">Loading…</div>}
      {q.isError && <div className="mk-err" role="alert">{errorMessage(q.error, "Could not load the admins.")}</div>}
      {toggle.isError && <div className="mk-err" role="alert">{errorMessage(toggle.error)}</div>}
      {q.isSuccess && !admins.length && <div className="mk-hint">There are no admins yet.</div>}
      {admins.map((a) => (
        <label className="mk-arow" key={a.id}>
          <input
            type="checkbox"
            checked={a.allowed}
            disabled={toggle.isPending && toggle.variables?.id === a.id}
            onChange={(e) => toggle.mutate({ id: a.id, allowed: e.target.checked })}
          />
          <span>
            <b>{a.name || a.email}</b>
            <small>{a.email}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

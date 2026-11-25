import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { marketingApi } from "../../../api/emailMarketingApi";
import CampaignsList from "./CampaignsList";
import CampaignView from "./CampaignView";
import CampaignWizard from "./CampaignWizard";
import "./emailMarketing.css";

// The Email Marketing page: campaigns list, the 4-step builder, live sending and the report.
// A separate page from the Gmail-based Email page; marketing mail goes through Amazon SES only.
// Who may open it is decided by the server (Super Admin, or an admin a Super Admin switched on); the sidebar
// item is hidden for everyone else, and a typed address shows the message below.
export default function EmailMarketingPage() {
  const access = useQuery({ queryKey: ["marketing", "access"], queryFn: marketingApi.access, staleTime: 60_000 });

  if (access.isLoading) return <div className="mk-root"><div className="mk-card"><div className="mk-empty">Loading…</div></div></div>;
  if (access.isError || !access.data?.allowed) {
    return (
      <div className="mk-root">
        <div className="mk-card">
          <div className="mk-empty">
            {access.data && !access.data.enabled
              ? "Email Marketing is not switched on yet."
              : "You do not have access to Email Marketing. Ask a Super Admin to switch it on for you."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mk-root">
      <Routes>
        <Route index element={<CampaignsList superAdmin={access.data.superAdmin} />} />
        <Route path="new" element={<CampaignWizard key="new" initial={null} />} />
        <Route path="campaign/:id" element={<CampaignView />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </div>
  );
}

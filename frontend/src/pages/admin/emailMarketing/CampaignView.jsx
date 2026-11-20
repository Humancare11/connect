import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { marketingApi } from "../../../api/emailMarketingApi";
import CampaignWizard from "./CampaignWizard";
import SendProgress from "./SendProgress";
import CampaignReport from "./CampaignReport";
import { MK_BASE, errorMessage } from "./marketingUtils";

// One campaign, whatever state it is in: a draft opens the builder, a running one shows live progress, a
// finished or stopped one shows its report.
export default function CampaignView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["marketing", "campaign", id], queryFn: () => marketingApi.get(id), retry: false });

  if (q.isLoading) return <section className="mk-card"><div className="mk-empty">Loading…</div></section>;
  if (q.isError) {
    return (
      <section className="mk-card">
        <div className="mk-err" role="alert">{errorMessage(q.error, "Could not load this campaign.")}</div>
        <div className="mk-foot"><button type="button" className="mk-btn mk-btn-g" onClick={() => navigate(MK_BASE)}>All campaigns</button></div>
      </section>
    );
  }

  const campaign = q.data.campaign;
  if (campaign.status === "draft") return <CampaignWizard key={campaign.id} initial={campaign} />;
  if (campaign.status === "sending") {
    return (
      <SendProgress
        campaign={campaign}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["marketing", "campaign", id] });
          qc.invalidateQueries({ queryKey: ["marketing", "campaigns"] });
        }}
      />
    );
  }
  return <CampaignReport campaign={campaign} />;
}

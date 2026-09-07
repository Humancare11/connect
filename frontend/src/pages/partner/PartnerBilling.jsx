import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import partnerApi from "../../api/partnerApi";
import { formatMoney } from "./caseConstants";
import "./partner.css";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function InvoiceStatusBadge({ status }) {
  const paid = status === "paid";
  return (
    <span
      className="pt-badge"
      style={{
        background: paid ? "#D1FAE5" : "#FEF3C7",
        color: paid ? "#065F46" : "#92400E",
      }}
    >
      {paid ? "Paid" : "Due"}
    </span>
  );
}

export default function PartnerBilling() {
  const [downloadingId, setDownloadingId] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const invoicesQ = useQuery({
    queryKey: ["partner", "invoices"],
    queryFn: partnerApi.listInvoices,
    retry: false,
  });

  const invoices = invoicesQ.data || [];

  const download = async (id) => {
    setDownloadingId(id);
    setDownloadError("");
    try {
      const { url } = await partnerApi.invoiceDownloadUrl(id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setDownloadError("Could not open the invoice. Please try again.");
    } catch (err) {
      setDownloadError(err.response?.data?.msg || "Could not download the invoice. Please try again.");
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <div className="pt-page">
      <div className="pt-page-head">
        <div>
          <h1 className="pt-page-title">Billing</h1>
          <p className="pt-page-sub">Invoices issued to your company by Humancare</p>
        </div>
      </div>

      {downloadError && <div className="pt-error">{downloadError}</div>}

      <div className="pt-table-wrap">
        <table className="pt-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Issued</th>
              <th>Due date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {invoicesQ.isLoading && (
              <tr>
                <td colSpan={7} className="pt-empty">
                  Loading invoices…
                </td>
              </tr>
            )}

            {invoicesQ.isError && !invoicesQ.isLoading && (
              <tr>
                <td colSpan={7} className="pt-empty">
                  Could not load invoices.{" "}
                  <button
                    type="button"
                    className="pt-btn pt-btn-ghost"
                    style={{ marginLeft: 8 }}
                    onClick={() => invoicesQ.refetch()}
                  >
                    Retry
                  </button>
                </td>
              </tr>
            )}

            {!invoicesQ.isLoading && !invoicesQ.isError && invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="pt-empty">
                  No invoices yet. Invoices issued by Humancare will appear here.
                </td>
              </tr>
            )}

            {invoices.map((inv) => (
              <tr key={inv._id}>
                <td style={{ fontWeight: 600, color: "#0369a1" }}>{inv.invoiceNumber}</td>
                <td style={{ color: "#64748b" }}>{formatDate(inv.createdAt)}</td>
                <td style={{ color: "#64748b" }}>{formatDate(inv.dueDate)}</td>
                <td style={{ color: "#475569", maxWidth: 260 }}>{inv.description || "—"}</td>
                <td style={{ fontWeight: 600 }}>{formatMoney(inv.amountCents, inv.currency)}</td>
                <td>
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="pt-btn pt-btn-ghost"
                    disabled={downloadingId === inv._id}
                    onClick={() => download(inv._id)}
                  >
                    {downloadingId === inv._id ? "Preparing…" : "Download PDF"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

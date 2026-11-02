import { useState } from "react";
import api from "../../api";
import { useToast } from "../../components/ui/Toast";

// Invoice actions shared by Payment Links and Payment History. The PDF comes
// from the Manual Invoices download route, and nothing is ever emailed unless
// the admin presses Send Email.

export function emailStatusLabel(invoice) {
  if (invoice.emailed) return `✓ Emailed to ${invoice.clientEmail}`;
  if (invoice.emailError) return "Email failed — try again";
  return "Email not sent";
}

// onChanged(invoice, link) is called after a successful send/retry so the
// page can refresh the row it shows.
export function useInvoiceActions(onChanged) {
  const toast = useToast();
  const [busy, setBusy] = useState("");

  const download = async (invoice) => {
    setBusy(`dl:${invoice._id}`);
    try {
      const res = await api.get(`/api/admin/manual-invoices/${invoice._id}/download`);
      if (res.data?.url) window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to generate download link.");
    } finally {
      setBusy("");
    }
  };

  const sendEmail = async (link) => {
    setBusy(`mail:${link._id}`);
    try {
      const res = await api.post(`/api/payments/admin/payment-links/${link._id}/invoice/send-email`);
      toast.success(`Invoice emailed to ${res.data.invoice.clientEmail}.`);
      onChanged?.(res.data.invoice, link);
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to send the email.");
      onChanged?.(null, link);
    } finally {
      setBusy("");
    }
  };

  const retryInvoice = async (link) => {
    setBusy(`retry:${link._id}`);
    try {
      const res = await api.post(`/api/payments/admin/payment-links/${link._id}/invoice`);
      onChanged?.(res.data.invoice, link);
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to generate the invoice.");
    } finally {
      setBusy("");
    }
  };

  return { busy, download, sendEmail, retryInvoice };
}

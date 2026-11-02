import { emailStatusLabel } from "./paymentLinkInvoiceActions";

// Invoice display shared by Payment Links and Payment History (the actions
// live in paymentLinkInvoiceActions.js). The invoice itself is a Manual
// Invoice — see backend/utils/paymentLinkInvoice.js.

export function InvoiceStatusPill({ status }) {
  return (
    <span className={`pl-status pl-status--${status === "paid" ? "paid" : "pending"}`}>
      {status === "paid" ? "Paid" : "Due"}
    </span>
  );
}

// Table cell body: number, status pill, client, email state and the buttons.
export function InvoiceCell({ link, actions }) {
  const invoice = link.invoice;
  if (!invoice) {
    return link.invoiceError ? (
      <div className="pl-invoice-cell">
        <span className="pl-email-flag pl-email-flag--bad" title={link.invoiceError}>Invoice failed</span>
        <button
          className="pl-link-btn"
          type="button"
          disabled={Boolean(actions.busy)}
          onClick={() => actions.retryInvoice(link)}
        >
          {actions.busy === `retry:${link._id}` ? "Retrying…" : "Retry invoice"}
        </button>
      </div>
    ) : (
      "-"
    );
  }

  return (
    <div className="pl-invoice-cell">
      <div className="pl-invoice-cell__top">
        <strong className="pl-strong">{invoice.invoiceNumber}</strong>
        <InvoiceStatusPill status={invoice.status} />
      </div>
      <span className="pl-invoice-cell__client">{invoice.clientName}</span>
      <span className={`pl-email-flag${invoice.emailed ? " pl-email-flag--sent" : ""}`} title={invoice.emailError || undefined}>
        {emailStatusLabel(invoice)}
      </span>
      {link.invoiceError && (
        <span className="pl-email-flag pl-email-flag--bad" title={link.invoiceError}>Receipt not generated</span>
      )}
      <div className="pl-inline-actions">
        <button
          className="pl-link-btn"
          type="button"
          disabled={Boolean(actions.busy)}
          onClick={() => actions.download(invoice)}
        >
          {actions.busy === `dl:${invoice._id}` ? "Preparing…" : "Download"}
        </button>
        <button
          className="pl-link-btn"
          type="button"
          disabled={Boolean(actions.busy)}
          onClick={() => actions.sendEmail(link)}
        >
          {actions.busy === `mail:${link._id}` ? "Sending…" : invoice.emailed ? "Resend Email" : "Send Email"}
        </button>
        {link.invoiceError && (
          <button
            className="pl-link-btn"
            type="button"
            disabled={Boolean(actions.busy)}
            onClick={() => actions.retryInvoice(link)}
          >
            {actions.busy === `retry:${link._id}` ? "Retrying…" : "Retry receipt"}
          </button>
        )}
      </div>
    </div>
  );
}

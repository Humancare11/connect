// The shared part of the individual (B2C) invoice form: the Customer block (full name, email) and the
// Services block (description + amount per line, "+ Add Item", Total). Used by the Payment Links page and
// the Manual Invoices page, so the two forms look and behave the same. What sits between them differs
// (Payment Links: "Due on Receipt"; Manual Invoices: "Issue as"), so that part is passed as children.
//
// `person` is { name, email }; `serviceState` is what useB2cServices() returns.
export default function B2cInvoiceFields({ person, onPersonChange, serviceState, currency, totalText, children }) {
  const { services, updateService, addService, removeService } = serviceState;
  return (
    <>
      <section className="pl-section">
        <h3 className="pl-section__title">Customer</h3>
        <div className="pl-form-grid pl-form-grid--2">
          <label className="pl-field">
            <span>Full name *</span>
            <input className="pl-input" type="text" maxLength={120} required value={person.name}
              onChange={(event) => onPersonChange("name", event.target.value)} placeholder="Rahul Mehta" />
          </label>
          <label className="pl-field">
            <span>Email *</span>
            <input className="pl-input" type="email" maxLength={254} required value={person.email}
              onChange={(event) => onPersonChange("email", event.target.value)} placeholder="name@gmail.com" />
          </label>
        </div>
        <p className="pl-hint">Invoice pe sirf naam aur email chhapenge, jaise abhi ke consultation invoice me.</p>
      </section>

      {children}

      <section className="pl-section">
        <h3 className="pl-section__title">Services</h3>
        <div className="pl-items">
          <div className="pl-item-row pl-item-row--service pl-item-row--head" aria-hidden="true">
            <span>Description</span><span>Amount ({currency})</span><span />
          </div>
          {services.map((service) => (
            <div className="pl-item-row pl-item-row--service" key={service.id}>
              <input className="pl-input" type="text" maxLength={200} required value={service.description}
                onChange={(event) => updateService(service.id, "description", event.target.value)}
                placeholder="Tele Consultation" aria-label="Description" />
              <input className="pl-input" type="number" min="0.01" step="0.01" required value={service.amount}
                onChange={(event) => updateService(service.id, "amount", event.target.value)}
                placeholder="0.00" aria-label="Amount" />
              <button className="pl-item-row__remove" type="button" disabled={services.length === 1}
                onClick={() => removeService(service.id)} aria-label="Remove service">×</button>
            </div>
          ))}
          <button className="pl-link-btn pl-items__add" type="button" onClick={addService}>+ Add Item</button>
        </div>
        <dl className="pl-totals">
          <div className="pl-totals__total"><dt>Total</dt><dd>{totalText}</dd></div>
        </dl>
      </section>
    </>
  );
}

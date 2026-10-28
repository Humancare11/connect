import { useMemo, useRef, useState } from "react";
import { computeItemAmountCents } from "./invoiceForm";

// State for the "Services" lines of an individual (B2C) invoice form, shared by
// the Payment Links page and the Manual Invoices page. A service is just a
// description and an amount; its quantity is always 1.

const newService = (id) => ({ id, description: "", amount: "" });

export const serviceCents = (service) => computeItemAmountCents({ quantity: "1", rate: service.amount });

export function useB2cServices() {
  const [services, setServices] = useState([newService(1)]);
  const nextId = useRef(2);

  const updateService = (id, key, value) =>
    setServices((prev) => prev.map((service) => (service.id === id ? { ...service, [key]: value } : service)));
  const addService = () => setServices((prev) => [...prev, newService(nextId.current++)]);
  const removeService = (id) => setServices((prev) => (prev.length > 1 ? prev.filter((service) => service.id !== id) : prev));
  const resetServices = () => {
    nextId.current = 2;
    setServices([newService(1)]);
  };

  // The invoice total, in cents: what the customer is billed.
  const subtotal = useMemo(() => services.reduce((sum, service) => sum + serviceCents(service), 0), [services]);
  const count = services.filter((service) => serviceCents(service) > 0).length;
  // The request body's items: quantity is sent as 1 (the server forces it too).
  const toPayload = () => services.map((service) => ({ description: service.description, quantity: 1, amount: Number(service.amount) }));

  return { services, updateService, addService, removeService, resetServices, subtotal, count, toPayload };
}

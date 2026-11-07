/* eslint-disable react-refresh/only-export-components -- test stand-in */
// Stand-in for @stripe/react-stripe-js in the booking-source browser test: the "card form" is a label and paying always
// succeeds with a payment intent id. This is the payment stub of the test.
import React, { useEffect } from "react";

export const Elements = ({ children }) => <>{children}</>;

export function PaymentElement({ onReady }) {
  useEffect(() => {
    if (onReady) onReady();
  }, [onReady]);
  return <div data-testid="stub-payment-element">Card details (test stub)</div>;
}

let paid = 0;
export const useStripe = () => ({
  confirmPayment: async () => {
    paid += 1;
    return { paymentIntent: { id: `pi_e2e_${Date.now()}_${paid}`, status: "succeeded" } };
  },
});
export const useElements = () => ({});

// Stand-in for @paypal/react-paypal-js in the booking-source browser test: PayPal is never loaded.
import React from "react";

export const PayPalScriptProvider = ({ children }) => <>{children}</>;
export const PayPalButtons = () => null;

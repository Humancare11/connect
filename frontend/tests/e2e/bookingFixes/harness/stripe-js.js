// Stand-in for @stripe/stripe-js in the booking-source browser test: nothing is loaded from Stripe.
export const loadStripe = async () => ({ stub: true });

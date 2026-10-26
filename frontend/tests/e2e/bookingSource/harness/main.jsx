/* eslint-disable react-refresh/only-export-components -- test stand-in */
// The real app shell for one journey: the real Header and BookingSourceTracker, a real condition page (PCOS), and the real
// AppointmentBookingForm, under a BrowserRouter so window.location moves like in the app. Two stand-ins:
//   - /appointment-booking is a small page that signs the patient in and has one button that does what the real picker does
//     (navigate() to the form's URL). The real picker is a different screen and not what is under test.
//   - Stripe and PayPal are replaced by stubs (see vite aliases in the test): "paying" always succeeds.
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "../../../../src/context/AuthContext.jsx";
import { PricingProvider } from "../../../../src/context/PricingContext.jsx";
import Header from "../../../../src/components/Header.jsx";
import BookingSourceTracker from "../../../../src/components/BookingSourceTracker.jsx";
import Pcos from "../../../../src/pages/Conditions/Conditions/Pcos.jsx";
import AppointmentBookingForm from "../../../../src/pages/AppointmentBookingForm.jsx";

function BookingLanding() {
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    login({ _id: "patient", name: "Test Patient", email: "patient@e2e.test" });
  }, [login]);
  return (
    <div id="booking-landing" style={{ paddingTop: 220 }}>
      <h1>Choose your appointment</h1>
      <button id="pick-pcos" onClick={() => navigate("/appointment-booking/women-s-health/obstetrics-and-gynaecology/pcos")}>
        Women's Health / PCOS
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <BrowserRouter>
      <AuthProvider>
        <PricingProvider>
          <BookingSourceTracker />
          <Header />
          <Routes>
            <Route path="/women-health/obstetrics-and-gynaecology/pcos" element={<Pcos categoryId="women" />} />
            <Route path="/appointment-booking" element={<BookingLanding />} />
            <Route path="/appointment-booking/:category/:specialty/:condition" element={<AppointmentBookingForm />} />
            <Route path="*" element={<div id="other-page">Other page</div>} />
          </Routes>
        </PricingProvider>
      </AuthProvider>
    </BrowserRouter>
  </HelmetProvider>,
);

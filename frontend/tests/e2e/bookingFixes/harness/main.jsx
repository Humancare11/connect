/* eslint-disable react-refresh/only-export-components -- test stand-in */
// The real app shell for the booking-fix journeys: the REAL AppProviders (currency, pricing, auth), the real CurrencyRouteWatcher, the
// real CategoryConsultant ("Get Help With" intake), Login, CategoryAppointmentConfirm and the header-menu booking form, under a
// BrowserRouter so history moves like in the app. Stand-ins: Stripe / PayPal (vite aliases in the test) and two tiny pages (/ and
// /other) with links, so a test can change route without a full page load.
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import AppProviders from "../../../../src/AppProviders.jsx";
import { CurrencyRouteWatcher } from "../../../../src/context/CurrencyContext.jsx";
import CategoryConsultant from "../../../../src/pages/CategoryConsultant.jsx";
import Login from "../../../../src/pages/Login.jsx";
import CategoryAppointmentConfirm from "../../../../src/pages/CategoryAppointmentConfirm.jsx";
import AppointmentBookingForm from "../../../../src/pages/AppointmentBookingForm.jsx";
import PriceText from "../../../../src/components/PriceText.jsx";
import { useCategoryPriceInfo } from "../../../../src/hooks/useCategoryPriceInfo.js";

function Home() {
  const info = useCategoryPriceInfo("general");
  return (
    <div style={{ padding: 24 }}>
      <h1 id="home">Home</h1>
      <p id="home-price">
        <PriceText info={info} />
      </p>
      <Link id="to-other" to="/other">
        Other page
      </Link>
    </div>
  );
}

function Other() {
  const info = useCategoryPriceInfo("general");
  return (
    <div style={{ padding: 24 }}>
      <h1 id="other">Other</h1>
      <p id="other-price">
        <PriceText info={info} />
      </p>
      <Link id="to-home" to="/">
        Home
      </Link>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <HelmetProvider>
    <AppProviders>
      <BrowserRouter>
        <CurrencyRouteWatcher />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/other" element={<Other />} />
          <Route path="/category-consultant" element={<CategoryConsultant />} />
          <Route path="/login" element={<Login />} />
          <Route path="/user/dashboard" element={<div id="dashboard">Dashboard</div>} />
          <Route path="/appointment-booking/category-confirm" element={<CategoryAppointmentConfirm />} />
          <Route path="/appointment-booking/:category/:specialty/:condition" element={<AppointmentBookingForm />} />
          <Route path="*" element={<div id="not-found">Not found</div>} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  </HelmetProvider>,
);

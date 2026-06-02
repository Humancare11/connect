import React from "react";
import {
  HeartPulse,
  Calendar,
  ShieldCheck,
  Clock3,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function SpecialtyDetail() {
  const services = [
    {
      title: "Annual Checkups",
      desc: "Comprehensive wellness examinations and preventive care.",
    },
    {
      title: "Preventive Care",
      desc: "Early detection and long-term health management.",
    },
    {
      title: "Chronic Disease Care",
      desc: "Diabetes, hypertension and ongoing condition monitoring.",
    },
    {
      title: "Telehealth Visits",
      desc: "Virtual consultations from anywhere.",
    },
    {
      title: "Lab Testing",
      desc: "Routine blood work and diagnostics.",
    },
    {
      title: "Vaccinations",
      desc: "Immunizations for all age groups.",
    },
  ];

  const conditions = [
    "Diabetes",
    "Hypertension",
    "Asthma",
    "Flu",
    "Allergies",
    "Migraine",
    "Thyroid Disorders",
    "Digestive Issues",
  ];

  const symptoms = [
    "Headache",
    "Fever",
    "Fatigue",
    "Dizziness",
    "Nausea",
    "Body Pain",
    "Cough",
    "Anxiety",
  ];

  return (
    <main className="specialty-detail-page">

      {/* HERO */}

      <section className="relative overflow-hidden pt-32 lg:pt-40 pb-24">

        {/* BACKGROUND */}

        <div className="absolute inset-0 -z-10">

          <div
            className="
            absolute
            top-[-200px]
            left-[-200px]
            h-[600px]
            w-[600px]
            rounded-full
            bg-blue-400/20
            blur-[120px]
          "
          />

          <div
            className="
            absolute
            right-[-200px]
            top-[0]
            h-[500px]
            w-[500px]
            rounded-full
            bg-blue-300/20
            blur-[120px]
          "
          />

        </div>

        <div className="max-w-[1240px] mx-auto px-6">

          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* LEFT */}

            <div>

              <div
                className="
                inline-flex
                items-center
                gap-2
                rounded-full
                border
                border-blue-200
                bg-white/60
                backdrop-blur-xl
                px-4
                py-2
                text-sm
                font-semibold
                text-[#0B57E8]
              "
              >
                <HeartPulse size={18} />
                Primary Care
              </div>

              <h1
                className="
                mt-6
                text-[#0A1F44]
                text-5xl
                md:text-6xl
                xl:text-7xl
                font-black
                leading-[1.02]
                tracking-[-2px]
              "
              >
                Comprehensive Care
                <span className="block text-[#0B57E8]">
                  For Every Stage Of Life
                </span>
              </h1>

              <p
                className="
                mt-6
                max-w-xl
                text-lg
                leading-8
                text-[#5C7099]
              "
              >
                Personalized healthcare focused on prevention,
                diagnosis, treatment and long-term wellness.
                Your trusted partner for healthier living.
              </p>

              <div className="flex flex-wrap gap-4 mt-10">

                <button
                  className="
                  px-7
                  py-4
                  rounded-2xl
                  bg-[#0B57E8]
                  text-white
                  font-semibold
                  shadow-lg
                  hover:-translate-y-1
                  transition-all
                "
                >
                  Book Appointment
                </button>

                <button
                  className="
                  px-7
                  py-4
                  rounded-2xl
                  border
                  border-blue-200
                  bg-white/70
                  backdrop-blur-xl
                  text-[#0A1F44]
                  font-semibold
                "
                >
                  Find Doctors
                </button>

              </div>

              <div className="flex flex-wrap gap-8 mt-10">

                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600" />
                  Same Day Visits
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600" />
                  Insurance Accepted
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600" />
                  Virtual Care
                </div>

              </div>

            </div>

            {/* RIGHT */}

            <div
              className="
              rounded-[32px]
              border
              border-white/50
              bg-white/60
              backdrop-blur-2xl
              p-8
              shadow-[0_30px_80px_-30px_rgba(11,40,100,.25)]
            "
            >

              <div className="grid grid-cols-2 gap-5">

                {[
                  ["15K+", "Patients Served"],
                  ["250+", "Doctors"],
                  ["98%", "Patient Satisfaction"],
                  ["24/7", "Support"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="
                    rounded-3xl
                    bg-white/70
                    p-6
                    text-center
                  "
                  >
                    <h3 className="text-4xl font-black text-[#0A1F44]">
                      {value}
                    </h3>

                    <p className="mt-2 text-[#5C7099]">
                      {label}
                    </p>
                  </div>
                ))}

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* QUICK FACTS */}

      <section className="pb-24">

        <div className="max-w-[1240px] mx-auto px-6">

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">

            {[
              {
                icon: Calendar,
                title: "Same Day Visits",
              },
              {
                icon: ShieldCheck,
                title: "Insurance Accepted",
              },
              {
                icon: Clock3,
                title: "24/7 Assistance",
              },
              {
                icon: Stethoscope,
                title: "Virtual Consultations",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="
                rounded-[28px]
                bg-white/70
                backdrop-blur-xl
                border
                border-white
                p-6
                shadow-[0_18px_50px_-20px_rgba(11,40,100,.15)]
              "
              >

                <item.icon
                  size={28}
                  className="text-[#0B57E8]"
                />

                <h3
                  className="
                  mt-4
                  font-bold
                  text-[#0A1F44]
                "
                >
                  {item.title}
                </h3>

              </div>
            ))}

          </div>

        </div>

      </section>

      {/* ABOUT */}

      <section className="py-24">

        <div className="max-w-[1240px] mx-auto px-6">

          <div className="grid lg:grid-cols-2 gap-16">

            <div>

              <span className="text-[#0B57E8] font-semibold">
                ABOUT SPECIALTY
              </span>

              <h2
                className="
                mt-4
                text-5xl
                font-black
                text-[#0A1F44]
              "
              >
                What Is Primary Care?
              </h2>

            </div>

            <div>

              <p
                className="
                text-[#5C7099]
                leading-9
                text-lg
              "
              >
                Primary care is the first point of contact for
                most healthcare needs. It focuses on preventive
                care, diagnosis, treatment, chronic disease
                management and overall wellness.
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* SERVICES */}

      <section className="py-24">

        <div className="max-w-[1240px] mx-auto px-6">

          <h2
            className="
            text-4xl
            font-black
            text-[#0A1F44]
            mb-12
          "
          >
            Services Included
          </h2>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">

            {services.map((item) => (
              <div
                key={item.title}
                className="
                rounded-[28px]
                bg-white/70
                backdrop-blur-xl
                p-8
                border
                border-white
                transition-all
                hover:-translate-y-2
              "
              >

                <div
                  className="
                  h-14
                  w-14
                  rounded-2xl
                  bg-blue-100
                  flex
                  items-center
                  justify-center
                "
                >
                  <Stethoscope className="text-[#0B57E8]" />
                </div>

                <h3
                  className="
                  mt-6
                  text-xl
                  font-bold
                  text-[#0A1F44]
                "
                >
                  {item.title}
                </h3>

                <p
                  className="
                  mt-3
                  text-[#5C7099]
                  leading-7
                "
                >
                  {item.desc}
                </p>

              </div>
            ))}

          </div>

        </div>

      </section>

      {/* CONDITIONS */}

      <section className="py-24">

        <div className="max-w-[1240px] mx-auto px-6">

          <h2
            className="
            text-4xl
            font-black
            text-[#0A1F44]
            mb-10
          "
          >
            Conditions We Treat
          </h2>

          <div className="flex flex-wrap gap-4">

            {conditions.map((item) => (
              <div
                key={item}
                className="
                px-6
                py-4
                rounded-full
                bg-white
                border
                border-blue-100
                font-medium
              "
              >
                {item}
              </div>
            ))}

          </div>

        </div>

      </section>

      {/* SYMPTOMS */}

      <section className="py-24">

        <div className="max-w-[1240px] mx-auto px-6">

          <h2
            className="
            text-4xl
            font-black
            text-[#0A1F44]
            mb-10
          "
          >
            Common Symptoms
          </h2>

          <div className="flex flex-wrap gap-4">

            {symptoms.map((item) => (
              <div
                key={item}
                className="
                rounded-full
                px-5
                py-3
                bg-blue-100
                text-[#0B57E8]
                font-semibold
              "
              >
                {item}
              </div>
            ))}

          </div>

        </div>

      </section>
      {/* TREATMENT JOURNEY */}

<section className="py-24 bg-gradient-to-b from-transparent to-blue-50/40">

  <div className="max-w-[1240px] mx-auto px-6">

    <div className="text-center mb-16">

      <span className="text-[#0B57E8] font-semibold">
        YOUR CARE JOURNEY
      </span>

      <h2 className="mt-4 text-5xl font-black text-[#0A1F44]">
        Simple. Personalized. Effective.
      </h2>

    </div>

    <div className="relative">

      <div className="hidden lg:block absolute top-8 left-0 right-0 h-1 bg-gradient-to-r from-[#0B57E8] to-[#7CB7FF]" />

      <div className="grid lg:grid-cols-5 gap-8">

        {[
          "Book Appointment",
          "Consultation",
          "Diagnosis",
          "Treatment Plan",
          "Follow-Up Care",
        ].map((step, index) => (
          <div
            key={step}
            className="relative text-center"
          >
            <div className="mx-auto h-16 w-16 rounded-full bg-[#0B57E8] text-white flex items-center justify-center text-xl font-black relative z-10">
              {index + 1}
            </div>

            <h3 className="mt-6 font-bold text-[#0A1F44]">
              {step}
            </h3>
          </div>
        ))}

      </div>

    </div>

  </div>

</section>

    </main>

    
  );
}
import { useState, useRef } from "react";
import "./FAQPage.css";

/**
 * FAQPage — Nurecare Connect
 * Hero banner + floating CTA card + categorized accordion.
 */

const CATEGORIES = [
  {
    id: "appointments",
    label: "Appointments",
    eyebrow: "Getting started",
    icon: CalendarIcon,
    items: [
      {
        q: "What is an online doctor appointment?",
        a: "An online doctor appointment allows you to consult with a licensed healthcare professional remotely using a secure video or audio connection. Instead of visiting a clinic in person, you can discuss your symptoms, receive medical advice, get a diagnosis when appropriate, and receive a personalized treatment plan from the comfort of your home. Humancare Connect makes virtual healthcare convenient, secure, and accessible while maintaining the same commitment to quality care.",
      },
      {
        q: "How do I book an online doctor appointment?",
        a: "Booking an appointment with Humancare Connect is quick and simple. Choose your preferred medical service or specialty, select an available appointment time, provide your basic information, and confirm your booking. Once your appointment is scheduled, you'll receive the details needed to join your secure virtual consultation.",
      },
      {
        q: "Can I schedule a same-day online doctor appointment?",
        a: "Yes. Depending on doctor availability, Humancare Connect offers same-day virtual appointments for many healthcare services. Same-day consultations help patients receive timely medical advice and treatment without the need to visit an urgent care center or clinic.",
      },
      {
        q: "Can I choose the doctor for my consultation?",
        a: "Yes. Depending on availability, you may choose a healthcare provider based on their specialty, experience, and the medical service you need. Humancare Connect helps connect patients with qualified healthcare professionals suited to their healthcare needs.",
      },
      {
        q: "How do I reschedule or cancel my appointment?",
        a: "If your plans change, you can request to reschedule or cancel your appointment before your scheduled consultation. We recommend making any changes as early as possible so another patient can use the available appointment time.",
      },
      {
        q: "What should I prepare before my virtual appointment?",
        a: "Before your consultation, have a stable internet connection, your identification if required, a list of current medications, recent medical records or lab reports, and any questions you'd like to discuss with your doctor. Preparing in advance helps make your consultation more efficient and productive.",
      },
      {
        q: "How long does an online doctor consultation usually take?",
        a: "Most virtual consultations typically last between 15 and 30 minutes, depending on your medical concerns and the complexity of your condition. Your doctor will take the time needed to understand your symptoms, discuss treatment options, and answer your questions.",
      },
      {
        q: "Can I book an appointment for a family member?",
        a: "Yes. Humancare Connect allows eligible patients to schedule appointments on behalf of family members when appropriate. Please ensure all required patient information is accurate at the time of booking.",
      },
      {
        q: "What happens after I book my appointment?",
        a: "Once your appointment is confirmed, you'll receive your appointment details along with instructions for joining the consultation. At the scheduled time, simply access the secure consultation link to meet with your healthcare provider.",
      },
      {
        q: "Will I receive appointment reminders?",
        a: "Yes. Appointment reminders may be sent before your scheduled consultation to help you stay informed and avoid missing your appointment.",
      },
      {
        q: "Can I book appointments at any time?",
        a: "Yes. You can request appointments online at your convenience. Available consultation times depend on the schedules of participating healthcare providers.",
      },
      {
        q: "Can I schedule a follow-up appointment?",
        a: "Yes. If your healthcare provider recommends additional care or follow-up monitoring, you can schedule another virtual appointment through Humancare Connect.",
      },
      {
        q: "What happens if I join my appointment late?",
        a: "If you're running late, join your consultation as soon as possible. Depending on the provider's schedule, your appointment may continue or need to be rescheduled.",
      },
      {
        q: "What if my doctor is running behind schedule?",
        a: "Occasionally, consultations may take longer than expected due to patient needs. If your doctor is delayed, we appreciate your patience and will begin your consultation as soon as possible.",
      },
      {
        q: "Can I upload medical records before my consultation?",
        a: "Yes. If the platform supports document uploads for your appointment, sharing relevant medical records, prescriptions, or laboratory reports before your consultation can help your healthcare provider better understand your medical history.",
      },
      {
        q: "Will I receive a summary after my consultation?",
        a: "Depending on the service provided, you may receive consultation notes, treatment recommendations, prescriptions where legally appropriate, or follow-up instructions after your appointment.",
      },
      {
        q: "Can I access my previous appointments?",
        a: "Yes. If available through your Humancare Connect account, you can review your appointment history and related consultation information.",
      },
      {
        q: "Can I book specialist appointments online?",
        a: "Yes. Humancare Connect offers access to healthcare professionals across multiple specialties, allowing patients to schedule virtual consultations based on their healthcare needs.",
      },
      {
        q: "Can I change my doctor after booking?",
        a: "If your consultation has not yet taken place and another provider is available, you may be able to request a different healthcare professional.",
      },
      {
        q: "What devices can I use for my appointment?",
        a: "You can join your virtual consultation using a compatible smartphone, tablet, laptop, or desktop computer with a reliable internet connection, webcam, and microphone when required.",
      },
      {
        q: "What if I experience technical issues during my consultation?",
        a: "If you experience connectivity or technical issues, our support team is available to help you reconnect so your consultation can continue whenever possible.",
      },
      {
        q: "Can I join my appointment from anywhere?",
        a: "Yes. As long as you have a secure internet connection and are in a private environment suitable for discussing your healthcare, you can attend your appointment from most locations.",
      },
      {
        q: "Is there a waiting room before my consultation?",
        a: "Depending on the consultation workflow, you may enter a secure virtual waiting room until your healthcare provider is ready to begin your appointment.",
      },
      {
        q: "Can I book appointments for ongoing medical care?",
        a: "Yes. Patients managing chronic conditions or requiring regular follow-up care can schedule ongoing virtual appointments as recommended by their healthcare provider.",
      },
      {
        q: "Why choose Humancare Connect for online doctor appointments?",
        a: "Humancare Connect combines licensed healthcare professionals, secure HIPAA-compliant technology, flexible appointment scheduling, and a patient-first approach to make accessing quality virtual healthcare simple, convenient, and reliable.",
      },
    ],
  },
  {
    id: "conditions-treatments",
    label: "Conditions & Treatments",
    eyebrow: "During your visit",
    icon: PulseIcon,
    items: [
      {
        q: "What medical conditions can be treated through telemedicine?",
        a: "Telemedicine is an effective option for many non-emergency medical conditions. Licensed healthcare providers on Humancare Connect can evaluate common illnesses such as colds, flu, allergies, sinus infections, urinary tract infections (UTIs), skin conditions, digestive concerns, chronic disease management, mental health conditions, and more. During your online doctor consultation, your provider will assess your symptoms, review your medical history, and recommend an appropriate treatment plan. If your condition requires an in-person examination, imaging, laboratory testing, or emergency care, your provider will guide you on the appropriate next steps.",
      },
      {
        q: "Can I see an online doctor for cold and flu symptoms?",
        a: "Yes. Online doctor consultations are a convenient way to receive medical advice for common cold and flu symptoms. During your virtual visit, your healthcare provider will discuss your symptoms, evaluate your condition, and recommend treatment options to help relieve your symptoms. If necessary and legally appropriate, prescriptions may be provided. If your symptoms indicate a more serious illness or require emergency medical attention, your provider will recommend immediate in-person care.",
      },
      {
        q: "Can telemedicine help treat sinus infections?",
        a: "Yes. Many sinus infections can be evaluated through a virtual consultation. Your healthcare provider will ask about your symptoms, including nasal congestion, facial pressure, headaches, fever, and the duration of your illness. Based on your evaluation, your provider may recommend self-care measures, medications, or additional medical evaluation if needed. Telemedicine offers a convenient way to receive timely care without visiting a clinic for many uncomplicated sinus infections.",
      },
      {
        q: "Can I get treatment for a urinary tract infection (UTI) online?",
        a: "Yes. Many uncomplicated urinary tract infections can be evaluated through an online doctor consultation. Your healthcare provider will discuss your symptoms, medical history, and determine whether virtual treatment is appropriate. If clinically indicated and legally permitted, medication may be prescribed. If your symptoms suggest a more serious infection or require laboratory testing, your provider may recommend an in-person evaluation.",
      },
      {
        q: "Can an online doctor diagnose strep throat?",
        a: "An online doctor can evaluate symptoms that may suggest strep throat, including sore throat, fever, swollen lymph nodes, and difficulty swallowing. However, because confirming strep throat often requires a rapid strep test or throat culture, your provider may recommend in-person testing before making a diagnosis. Based on your symptoms, you'll receive guidance on the most appropriate next steps and treatment recommendations.",
      },
      {
        q: "Can I consult an online doctor for allergies?",
        a: "Yes. Seasonal allergies, environmental allergies, and mild allergic reactions are commonly managed through telemedicine. During your consultation, your healthcare provider will review your symptoms, identify possible triggers, and recommend treatment options to help relieve sneezing, nasal congestion, itchy eyes, or other allergy-related symptoms. Severe allergic reactions require immediate emergency medical attention.",
      },
      {
        q: "Can telemedicine treat ear infections?",
        a: "Many ear infections can be initially evaluated through telemedicine, especially when discussing symptoms such as ear pain, pressure, fever, or hearing changes. Depending on your symptoms and medical history, your healthcare provider may recommend treatment, additional monitoring, or an in-person examination if a physical evaluation of the ear is necessary for an accurate diagnosis.",
      },
      {
        q: "Can I receive treatment for pink eye through a virtual consultation?",
        a: "Yes. Conjunctivitis, commonly known as pink eye, can often be evaluated during an online doctor consultation. Your provider will review your symptoms, including redness, discharge, itching, or irritation, to determine the most appropriate treatment plan. If your symptoms suggest a more serious eye condition or vision-threatening emergency, you'll be advised to seek immediate in-person care.",
      },
      {
        q: "Can online doctors help with skin conditions like eczema, rashes, or psoriasis?",
        a: "Yes. Many common skin conditions, including eczema, contact dermatitis, mild psoriasis, acne, and skin rashes, can be evaluated through virtual healthcare services. Your provider may ask you to share photographs or use video during your consultation to better assess your skin concern. Based on the evaluation, you'll receive personalized treatment recommendations or a referral for in-person care if needed.",
      },
      {
        q: "Can I consult a dermatologist online?",
        a: "Yes. Online dermatology consultations make it convenient to discuss many non-emergency skin concerns without visiting a clinic. A dermatologist or qualified healthcare provider can evaluate skin conditions, discuss symptoms, recommend treatment options, and advise whether additional testing or an in-person examination is necessary. Teledermatology is an effective option for many common skin conditions.",
      },
      {
        q: "Can telemedicine help treat acne?",
        a: "Yes. Mild to moderate acne is commonly treated through telemedicine. During your virtual consultation, your healthcare provider will assess your skin concerns, discuss your current skincare routine, and recommend treatment options based on your individual needs. Ongoing virtual follow-up appointments may also help monitor your progress and adjust your treatment plan when appropriate.",
      },
      {
        q: "Can I manage asthma through virtual care?",
        a: "Yes. Telemedicine can support ongoing asthma management for many patients. During your online consultation, your healthcare provider can review your symptoms, discuss your medications, evaluate your asthma control, and recommend adjustments to your treatment plan when appropriate. If you're experiencing severe breathing difficulties or an asthma emergency, seek immediate emergency medical care.",
      },
      {
        q: "Can telemedicine help manage high blood pressure?",
        a: "Yes. Virtual healthcare is a convenient option for monitoring and managing high blood pressure. Your healthcare provider may review your home blood pressure readings, discuss lifestyle changes, evaluate your medications, and recommend ongoing monitoring. Regular virtual follow-up appointments can help support long-term blood pressure management alongside your primary healthcare provider.",
      },
      {
        q: "Can online doctors help manage diabetes?",
        a: "Yes. Telemedicine can play an important role in diabetes management by supporting routine follow-up appointments, reviewing blood glucose readings, discussing medications, and providing lifestyle guidance. Your healthcare provider may recommend additional laboratory testing or in-person care when necessary to help maintain optimal diabetes management and overall health.",
      },
      {
        q: "Can I get treatment for migraines through an online consultation?",
        a: "Yes. Online doctor consultations can help evaluate migraine symptoms, discuss potential triggers, review your medical history, and recommend appropriate treatment options. Your healthcare provider can also help develop a long-term migraine management plan and advise when in-person neurological evaluation or emergency care may be necessary if your symptoms change or become severe.",
      },
      {
        q: "Can I consult a doctor online for digestive problems like constipation or diarrhea?",
        a: "Yes. Many common digestive concerns, including constipation, diarrhea, bloating, acid indigestion, and mild stomach discomfort, can be evaluated through an online doctor consultation. Your healthcare provider will review your symptoms, medical history, and lifestyle factors before recommending an appropriate treatment plan. If your symptoms suggest a more serious digestive condition or require physical examination, imaging, or laboratory testing, you'll be advised to seek in-person medical care.",
      },
      {
        q: "Can telemedicine help treat acid reflux (GERD)?",
        a: "Yes. Telemedicine is an effective option for evaluating symptoms of acid reflux and gastroesophageal reflux disease (GERD). During your consultation, your provider will discuss your symptoms, identify possible triggers, and recommend lifestyle modifications, dietary changes, or medications when appropriate. If your symptoms are severe, persistent, or accompanied by warning signs such as difficulty swallowing or unexplained weight loss, your provider may recommend further evaluation.",
      },
      {
        q: "Can I receive treatment for urinary symptoms online?",
        a: "Yes. Symptoms such as painful urination, frequent urination, urinary urgency, or mild discomfort can often be assessed through a virtual consultation. Your healthcare provider will evaluate your symptoms and medical history to determine whether telemedicine is appropriate or if additional laboratory testing or an in-person examination is needed for an accurate diagnosis.",
      },
      {
        q: "Can I consult a doctor online for back or neck pain?",
        a: "Yes. Many cases of mild to moderate back pain and neck pain can be evaluated through virtual healthcare services. During your online consultation, your provider will discuss your symptoms, medical history, recent injuries, and activity level before recommending self-care strategies, medications, physical therapy, or additional medical evaluation if necessary.",
      },
      {
        q: "Can virtual care help treat joint pain or arthritis?",
        a: "Yes. Telemedicine can support patients experiencing joint pain, arthritis, or musculoskeletal discomfort by reviewing symptoms, discussing pain management strategies, and monitoring ongoing treatment plans. If your condition requires imaging studies, injections, or a physical examination, your provider will recommend appropriate in-person care.",
      },
      {
        q: "Can telemedicine help with anxiety, stress, or panic attacks?",
        a: "Yes. Telemedicine provides convenient access to healthcare professionals who can evaluate symptoms of anxiety, stress, and panic attacks. During your consultation, your provider will discuss your symptoms, identify contributing factors, and recommend treatment options, lifestyle strategies, counseling referrals, or follow-up care based on your individual needs.",
      },
      {
        q: "Can I receive virtual care for depression or emotional wellness?",
        a: "Yes. Virtual healthcare offers a confidential and convenient way to discuss symptoms of depression, emotional well-being, and mood-related concerns. Your healthcare provider will assess your symptoms, discuss treatment options, and recommend an appropriate care plan, which may include counseling, behavioral health support, or additional medical evaluation when appropriate.",
      },
      {
        q: "Can I consult a licensed mental health professional online?",
        a: "Yes. Humancare Connect offers access to qualified mental health professionals who provide confidential virtual consultations for emotional wellness, stress management, anxiety, depression, and other behavioral health concerns. Online mental health appointments make it easier to receive professional support from a comfortable and private environment.",
      },
      {
        q: "Can online doctors help with sleep disorders or insomnia?",
        a: "Yes. Sleep concerns such as insomnia, poor sleep quality, and disrupted sleep patterns can often be evaluated during an online consultation. Your healthcare provider will review your symptoms, medical history, daily habits, and possible contributing factors before recommending lifestyle modifications, treatment options, or additional evaluation when necessary.",
      },
      {
        q: "Can I discuss women's health concerns through telemedicine?",
        a: "Yes. Telemedicine provides convenient access to healthcare professionals for many non-emergency women's health concerns, including menstrual health, menopause symptoms, urinary symptoms, contraception counseling, and general wellness consultations. If your condition requires a physical examination or diagnostic testing, your provider will recommend appropriate in-person care.",
      },
      {
        q: "Can I consult a doctor online for men's health concerns?",
        a: "Yes. Men can consult licensed healthcare professionals through Humancare Connect for a variety of non-emergency health concerns, including preventive care, urinary symptoms, sexual wellness, hormonal health, chronic disease management, and general medical advice. Your provider will recommend the most appropriate next steps based on your individual health needs.",
      },
      {
        q: "Can I receive pediatric care through virtual consultations?",
        a: "Yes. Parents and guardians can schedule virtual consultations for many common childhood illnesses, including fever, cough, allergies, skin conditions, digestive concerns, and minor infections. A pediatric healthcare provider will evaluate your child's symptoms and recommend treatment or advise when an in-person examination is necessary.",
      },
      {
        q: "Can I get prescription refills through telemedicine?",
        a: "In many cases, prescription refills may be available through a virtual consultation when medically appropriate and permitted by applicable laws and regulations. Your healthcare provider will review your medical history, current treatment plan, and ongoing healthcare needs before determining whether a refill can be provided.",
      },
      {
        q: "When should I choose an in-person visit instead of telemedicine?",
        a: "Telemedicine is ideal for many non-emergency medical concerns, routine follow-ups, and chronic disease management. However, emergency symptoms such as chest pain, severe difficulty breathing, major injuries, sudden vision loss, loss of consciousness, stroke symptoms, or other life-threatening conditions require immediate emergency medical attention. Your provider will also recommend an in-person visit if your condition requires a physical examination, imaging, or laboratory testing.",
      },
      {
        q: "What conditions cannot be treated through telemedicine?",
        a: "While telemedicine is highly effective for many healthcare needs, it is not appropriate for medical emergencies or conditions requiring immediate hands-on evaluation. Serious trauma, severe bleeding, suspected heart attack, stroke, seizures, or other life-threatening conditions should always be treated at the nearest emergency department or by calling your local emergency services. If virtual care is not appropriate for your condition, your healthcare provider will guide you toward the most suitable level of care.",
      },
    ],
  },
  {
    id: "medical-services",
    label: "Medical Services",
    eyebrow: "Why it works",
    icon: HeartIcon,
    items: [
      {
        q: "What medical services does Humancare Connect offer?",
        a: "Humancare Connect provides access to a wide range of virtual healthcare services, including primary care, specialist consultations, chronic disease management, mental health support, prescription refills, preventive care, second opinions, and follow-up appointments. Our goal is to make quality healthcare more accessible through secure online doctor consultations.",
      },
      {
        q: "Can I consult a primary care doctor online?",
        a: "Yes. Primary care physicians can evaluate many common illnesses, provide preventive care, manage chronic conditions, and recommend treatment plans through secure virtual consultations.",
      },
      {
        q: "Can I consult a specialist through Humancare Connect?",
        a: "Yes. Depending on availability, patients can connect with healthcare professionals across multiple specialties, allowing them to receive expert medical guidance without unnecessary travel.",
      },
      {
        q: "Can I get a second medical opinion online?",
        a: "Yes. Virtual consultations provide a convenient way to seek a second opinion regarding an existing diagnosis, treatment plan, or ongoing medical condition from a qualified healthcare professional.",
      },
      {
        q: "Can I request prescription refills through Humancare Connect?",
        a: "Yes. If medically appropriate and permitted by applicable laws, healthcare providers may review your medical history and determine whether a prescription refill is appropriate during your virtual consultation.",
      },
      {
        q: "Can doctors prescribe medications during an online consultation?",
        a: "When clinically appropriate and legally permitted, licensed healthcare providers may prescribe medications following a thorough medical evaluation. Some medications may require an in-person assessment or may not be prescribed through telemedicine.",
      },
      {
        q: "Can I receive treatment recommendations without visiting a clinic?",
        a: "Yes. Many non-emergency medical concerns can be evaluated online, allowing your provider to recommend treatment, lifestyle changes, follow-up care, or additional testing if necessary.",
      },
      {
        q: "Can I upload my medical records before my consultation?",
        a: "Yes. Sharing previous medical records, prescriptions, imaging reports, or laboratory results before your appointment helps your provider better understand your health history and make informed clinical decisions.",
      },
      {
        q: "Can doctors review my laboratory test results online?",
        a: "Yes. Healthcare providers can review laboratory reports, explain your results, discuss what they mean, and recommend the next steps during your virtual consultation.",
      },
      {
        q: "Can doctors review imaging reports during a virtual consultation?",
        a: "Yes. If you have X-ray, CT scan, MRI, ultrasound, or other imaging reports, your healthcare provider can discuss the findings and explain your treatment options during your appointment.",
      },
      {
        q: "Can I receive preventive healthcare advice online?",
        a: "Yes. Preventive healthcare consultations include wellness guidance, lifestyle recommendations, nutrition advice, health screenings, and strategies to help reduce your risk of future medical conditions.",
      },
      {
        q: "Can I receive chronic disease management through Humancare Connect?",
        a: "Yes. Patients with ongoing medical conditions such as diabetes, hypertension, asthma, thyroid disorders, and other chronic illnesses can schedule regular virtual follow-up appointments to support long-term care.",
      },
      {
        q: "Can I consult a doctor for weight management?",
        a: "Yes. Healthcare providers can discuss healthy weight management strategies, nutrition, exercise recommendations, lifestyle modifications, and determine whether additional treatment options may be appropriate.",
      },
      {
        q: "Can I receive mental health consultations online?",
        a: "Yes. Humancare Connect offers confidential virtual consultations for anxiety, depression, stress, emotional wellness, and other behavioral health concerns through qualified healthcare professionals.",
      },
      {
        q: "Can I receive women's healthcare services online?",
        a: "Yes. Women can consult healthcare providers for many non-emergency concerns, including menstrual health, menopause, contraception counseling, urinary symptoms, preventive care, and general wellness.",
      },
      {
        q: "Can I receive men's healthcare services online?",
        a: "Yes. Men can consult licensed healthcare professionals regarding preventive care, urinary symptoms, sexual wellness, hormonal health, chronic disease management, and general medical concerns.",
      },
      {
        q: "Can I receive pediatric healthcare services online?",
        a: "Yes. Parents and guardians can schedule virtual consultations for many common childhood illnesses, follow-up care, allergies, skin conditions, and general pediatric health concerns.",
      },
      {
        q: "Can I receive follow-up care after my consultation?",
        a: "Yes. If your healthcare provider recommends ongoing monitoring or additional treatment, you can schedule follow-up virtual appointments to review your progress and adjust your care plan when necessary.",
      },
      {
        q: "Can I receive referrals to specialists if needed?",
        a: "Yes. If your condition requires additional evaluation or specialized care, your healthcare provider may recommend an appropriate specialist or advise you on the next steps for further treatment.",
      },
      {
        q: "Why choose Humancare Connect for virtual healthcare services?",
        a: "Humancare Connect combines experienced healthcare professionals, secure HIPAA-compliant technology, convenient online appointments, and patient-centered care to deliver reliable virtual healthcare services. Whether you need primary care, specialist consultations, chronic disease management, or preventive healthcare, our platform makes accessing quality medical care simple, secure, and convenient.",
      },
    ],
  },
  {
    id: "privacy-security-support",
    label: "Privacy, Security & Support",
    eyebrow: "Privacy Concerns",
    icon: HeartIcon,
    items: [
      {
        q: "Is Humancare Connect HIPAA compliant?",
        a: "Yes. Humancare Connect is designed with HIPAA-compliant safeguards to help protect the privacy and security of patient health information. Our platform follows industry best practices to support secure virtual healthcare and protect sensitive medical data.",
      },
      {
        q: "How does Humancare Connect protect my personal health information?",
        a: "We use secure technologies and privacy-focused processes to help safeguard your personal and medical information. Access to patient information is limited to authorized healthcare professionals and personnel involved in your care.",
      },
      {
        q: "Are my online doctor consultations private?",
        a: "Yes. Virtual consultations take place through a secure platform designed to protect patient confidentiality. Your consultation remains private between you and your healthcare provider unless disclosure is required by law or you provide consent.",
      },
      {
        q: "Is my consultation data encrypted?",
        a: "Yes. Humancare Connect uses encrypted technology to help protect information shared during virtual consultations, reducing the risk of unauthorized access while maintaining a secure communication environment.",
      },
      {
        q: "Who can access my medical records?",
        a: "Only authorized healthcare providers and personnel directly involved in your care can access your medical records when necessary. Patient information is handled according to applicable privacy regulations and security standards.",
      },
      {
        q: "Is my payment information secure?",
        a: "Yes. Payment transactions are processed using secure payment technologies designed to help protect your financial information during online transactions.",
      },
      {
        q: "Can I create my Humancare Connect account online?",
        a: "Yes. Creating an account is quick and easy. Simply provide the required information, verify your details where applicable, and you'll be ready to book online doctor appointments and manage your healthcare online.",
      },
      {
        q: "How do I reset my password?",
        a: "If you've forgotten your password, use the 'Forgot Password' option on the login page to securely reset your password by following the instructions sent to your registered email address.",
      },
      {
        q: "Can I update my personal information?",
        a: "Yes. You can update your contact information and other eligible account details through your Humancare Connect account to help ensure your information remains accurate.",
      },
      {
        q: "Can I access my consultation history?",
        a: "Yes. Depending on your account features, you may be able to view your previous appointments, consultation details, prescriptions, and other healthcare records through your secure patient portal.",
      },
      {
        q: "How do I contact Humancare Connect support?",
        a: "If you need assistance with appointments, your account, or technical issues, you can contact our support team through the contact options available on our website.",
      },
      {
        q: "What should I do if I experience technical issues during my consultation?",
        a: "If you experience technical difficulties, first check your internet connection and device settings. If the issue continues, contact our support team for assistance in reconnecting to your consultation.",
      },
      {
        q: "What devices are supported?",
        a: "Humancare Connect supports most modern smartphones, tablets, laptops, and desktop computers with an internet connection, microphone, and camera for video consultations.",
      },
      {
        q: "Which web browsers work best?",
        a: "For the best experience, use an up-to-date version of supported browsers such as Google Chrome, Microsoft Edge, Safari, or Mozilla Firefox.",
      },
      {
        q: "Can I use Humancare Connect while traveling?",
        a: "Yes. Depending on your location and provider availability, you may be able to access virtual healthcare services while traveling. Service availability may vary based on applicable healthcare regulations.",
      },
      {
        q: "Is customer support available if I need help?",
        a: "Yes. Our support team is available to assist with general questions, appointment assistance, account-related concerns, and technical support to help ensure a smooth healthcare experience.",
      },
      {
        q: "How do I report a technical problem?",
        a: "If you encounter a technical issue, contact our support team with details about the problem, your device, browser, and any error messages so we can assist you as quickly as possible.",
      },
      {
        q: "Can I delete my Humancare Connect account?",
        a: "Yes. If you no longer wish to use your account, you can contact our support team for guidance regarding account management and applicable data retention requirements.",
      },
      {
        q: "How is my personal information stored?",
        a: "Your personal and healthcare information is stored using secure systems designed to help protect data integrity, confidentiality, and compliance with applicable healthcare privacy standards.",
      },
      {
        q: "What happens if my internet connection is interrupted during a consultation?",
        a: "If your connection is interrupted, try reconnecting using the consultation link. If you're unable to reconnect, our support team will help you continue your consultation whenever possible.",
      },
      {
        q: "Is Humancare Connect safe to use?",
        a: "Yes. Humancare Connect is designed with patient privacy, secure technology, encrypted communications, and industry-standard security practices to provide a safe and reliable virtual healthcare experience.",
      },
      {
        q: "Why should I trust Humancare Connect for virtual healthcare?",
        a: "Humancare Connect combines licensed healthcare professionals, secure HIPAA-compliant technology, patient-centered care, and dedicated support to make accessing virtual healthcare simple, convenient, and trustworthy. Whether you're booking an online doctor appointment or managing ongoing healthcare needs, our platform is designed to help you receive quality care with confidence.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="faq-page">
      <Hero />
      <FAQContent />
    </div>
  );
}

function Hero() {
  return (
    <header className="hero">
      <div className="hero__inner">
        <div className="hero__copy">
          <p className="eyebrow">Support center</p>
          <h1 className="hero__title">
            Find Answers <em>Before </em>Your Appointment.
          </h1>
          <p className="hero__sub">
            Everything you need to know about Humancare Connect, from booking an
            online doctor consultation and virtual care services to
            prescriptions, privacy, billing, and account support. Browse our
            FAQs or contact our support team for personalized assistance.
          </p>

          <ul className="hero__stats">
            <li>
              <span className="hero__stat-value">24/7</span>
              <span className="hero__stat-label"> Support Available</span>
            </li>
            <li>
              <span className="hero__stat-value">HIPAA</span>
              <span className="hero__stat-label"> Compliant Platform</span>
            </li>
            <li>
              <span className="hero__stat-value">Global</span>
              <span className="hero__stat-label"> Patient Access</span>
            </li>
          </ul>
        </div>

        <CTACard />
      </div>

      <PulseDivider />
    </header>
  );
}

function CTACard() {
  return (
    <aside className="cta-card" aria-label="Chat with the care team">
      <div className="cta-card__top">
        <span className="cta-card__avatar">
          <ChatIcon />
        </span>
        <span className="cta-card__status">
          <span className="pulse-dot" aria-hidden="true" />
          We're Here When You Need Us.
        </span>
      </div>

      <h2 className="cta-card__title">Still have a question?</h2>
      <p className="cta-card__text">
        If you couldn't find the answer in our Help Center, our support team is
        ready to assist you with any questions about Humancare Connect, so you
        can get the care and information you need with confidence.
      </p>

      <button className="cta-card__button" type="button">
        Speak with Our Team
        <ArrowIcon />
      </button>

      <p className="cta-card__footnote">
        <span>support@humancareconnect.co</span>
      </p>
    </aside>
  );
}

function PulseDivider() {
  return (
    <svg
      className="pulse-divider"
      viewBox="0 0 1200 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="pulse-divider__line"
        d="M0,30 L340,30 L365,30 L385,8 L405,52 L425,30 L455,30 L470,20 L485,30 L1200,30"
        fill="none"
      />
    </svg>
  );
}

function FAQContent() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const sectionRefs = useRef({});

  const scrollToCategory = (id) => {
    setActiveCategory(id);
    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="faq-content">
      <nav className="quick-nav" aria-label="Jump to category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={
              "quick-nav__pill" +
              (activeCategory === cat.id ? " quick-nav__pill--active" : "")
            }
            onClick={() => scrollToCategory(cat.id)}
          >
            <cat.icon />
            {cat.label}
          </button>
        ))}
      </nav>

      <div className="faq-sections">
        {CATEGORIES.map((cat) => (
          <section
            key={cat.id}
            id={cat.id}
            ref={(el) => (sectionRefs.current[cat.id] = el)}
            className="faq-section"
          >
            <div className="faq-section__heading">
              <span className="faq-section__icon">
                <cat.icon />
              </span>
              <div>
                <p className="eyebrow eyebrow--muted">{cat.eyebrow}</p>
                <h2>{cat.label}</h2>
              </div>
            </div>

            <AccordionGroup items={cat.items} />
          </section>
        ))}
      </div>
    </main>
  );
}

function AccordionGroup({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <ul className="accordion">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <li key={item.q} className="accordion__item">
            <button
              type="button"
              className="accordion__trigger"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? -1 : i)}
            >
              <span>{item.q}</span>
              <span
                className={
                  "accordion__icon" + (isOpen ? " accordion__icon--open" : "")
                }
                aria-hidden="true"
              >
                <PlusIcon />
              </span>
            </button>
            <div
              className="accordion__panel"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
              }}
            >
              <p className="accordion__answer">{item.a}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Icons (inline, no dependency) ---------- */

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3.5 9.5H20.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 3V6.5M16 3V6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d="M2.5 12H8L10 6.5L14 17.5L16 12H21.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d="M12 20.2C12 20.2 3 15 3 8.8C3 5.9 5.2 4 7.8 4C9.6 4 11.1 5 12 6.4C12.9 5 14.4 4 16.2 4C18.8 4 21 5.9 21 8.8C21 15 12 20.2 12 20.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <path
        d="M4 12.2C4 7.9 7.8 4.5 12.2 4.5C16.6 4.5 20.2 7.9 20.2 12.2C20.2 16.5 16.6 19.9 12.2 19.9C10.9 19.9 9.7 19.6 8.6 19.1L4 20.2L5.2 16.2C4.4 15 4 13.6 4 12.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path
        d="M5 12H19M19 12L13 6M19 12L13 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

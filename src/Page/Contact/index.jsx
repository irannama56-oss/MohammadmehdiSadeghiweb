import React, { useState } from "react";
import ContactBox from "./ContactBox";
import Form from "./Form";
import CodeView from "./CodeView";
import SuccessModal from "./SuccessModal";
import useClickTrack from "../../Hooks/useClickTrack";
import usePageSEO from "../../Hooks/usePageSEO";

const CONTACT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Contact Mohammad Mehdi Sadeghi",
  "url": "https://mohammad-mehdi-sadeghi.vercel.app/contact",
  "mainEntity": {
    "@type": "Person",
    "name": "Mohammad Mehdi Sadeghi",
    "alternateName": ["محمد مهدی صادقی", "محمد‌مهدی صادقی"],
    "email": "mailto:mohammad.m.sadeghi09@gmail.com",
    "url": "https://mohammad-mehdi-sadeghi.vercel.app",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "مشهد",
      "addressCountry": "IR"
    }
  }
};

export default function Contact() {
  usePageSEO({
    title: "Contact | Mohammad Mehdi Sadeghi — محمد مهدی صادقی",
    description: "Contact Mohammad Mehdi Sadeghi (محمد مهدی صادقی) for frontend development and corporate website design in Mashhad — by email, Telegram or LinkedIn.",
    canonical: "https://mohammad-mehdi-sadeghi.vercel.app/contact",
    image: "/og-preview.png",
    schema: CONTACT_SCHEMA,
  });

  const { trackClick } = useClickTrack();
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [statusMessage, setStatusMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submittedData, setSubmittedData] = useState({ name: "", phone: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      setStatus("error");
      setStatusMessage("Please fill in your name and message.");
      return;
    }

    setStatus("sending");
    setStatusMessage("");

    const currentName = name;
    const currentPhone = phoneNumber;

    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phoneNumber, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      setStatus("success");
      setStatusMessage("Message sent! I'll get back to you soon.");
      setSubmittedData({ name: currentName, phone: currentPhone });
      setIsModalOpen(true);

      trackClick({
        targetType: "form",
        targetId: "contact-form",
        targetLabel: "Contact Form Submission",
      });
      setName("");
      setPhoneNumber("");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setStatusMessage(err.message || "Something went wrong.");
    }
  };

  return (
    <section className="bg-[#0F172B] min-h-[calc(100vh-116px)] w-full flex flex-col md:flex-row md:h-[calc(100vh-116px)] md:overflow-hidden relative">
      <h1 className="sr-only">
        Contact Mohammad Mehdi Sadeghi (محمد مهدی صادقی) — Web Developer in Mashhad
      </h1>
      <ContactBox />
      <Form
        name={name}
        setName={setName}
        setPhoneNumber={setPhoneNumber}
        message={message}
        setMessage={setMessage}
        onSubmit={handleSubmit}
        status={status}
        statusMessage={statusMessage}
      />
      <CodeView name={name} phoneNumber={phoneNumber} message={message} />

      <SuccessModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        senderName={submittedData.name}
        phoneNumber={submittedData.phone}
      />
    </section>
  );
}

// CAREFLOW AI CHATBOT SERVICE

export interface ChatMessage {
  sender: "bot" | "user";
  text: string;
  timestamp: string;
}

const FAQ_RESPONSES: Record<string, string> = {
  "how to book": "To book an appointment, register or login as a patient, click 'Book Appointment' on your dashboard, select your preferred location, clinic category, doctor, and confirm your token slot.",
  "approved list": "Hospital Admins review credentials and medical license numbers. Once verified, doctors, receptionists, and technicians gain clinical portal access.",
  "emergency": "For life-threatening situations, please dial emergency services (e.g. 911) or visit the nearest physical Emergency Care Unit immediately.",
  "lab testing": "Your consulting doctor can request laboratory tests (e.g., Comprehensive Blood Panel, ECG, MRI). Our Lab Technicians will receive these requests, record results, and publish them instantly to your portal.",
  "medicine reminder": "Once a doctor writes a prescription with dosages and times (e.g., 08:00, 20:00), our system automatically tracks and displays reminders on your patient dashboard."
};

export const getResponseFromAI = async (userInput: string): Promise<string> => {
  const query = userInput.toLowerCase().trim();

  // 1. First attempt to leverage server API if running
  try {
    const response = await fetch("/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: userInput })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.reply) return data.reply;
    }
  } catch (e) {
    // Silent fallback to standard smart rule-engine
  }

  // 2. High-Fidelity Local Rules Action (Rule-Based Triage)
  // Symptoms match
  if (query.includes("fever") || query.includes("temperature") || query.includes("cough") || query.includes("cold") || query.includes("flu")) {
    return "🤒 Based on your symptoms of fever/cough, you should consult a General Physician. Rest well, hydrate, and monitor your temperature.";
  }
  if (query.includes("chest pain") || query.includes("heart") || query.includes("breathing deeply") || query.includes("palpitations") || query.includes("hypertension")) {
    return "❤️ Your query involves cardiac/chest systems. You should consult a Cardiologist Specialist as soon as possible. If this is severe, please seek emergency room services.";
  }
  if (query.includes("knee") || query.includes("joint") || query.includes("bone") || query.includes("fracture") || query.includes("shoulder") || query.includes("pain") && query.includes("leg")) {
    return "🦴 For musculoskeletal/joint concerns like knee or joint discomfort, we suggest consulting an Orthopedic Specialist.";
  }
  if (query.includes("skin") || query.includes("rash") || query.includes("acne") || query.includes("spot") || query.includes("allergy")) {
    return "🧴 For skin irritations, rashes, or chronic spots, you should consult a Dermatologist.";
  }
  if (query.includes("kid") || query.includes("child") || query.includes("baby") || query.includes("pediatric")) {
    return "👶 For child healthcare, growth monitoring, or pediatric ailments, you should consult a Pediatrician.";
  }
  if (query.includes("headache") || query.includes("neuro") || query.includes("stroke") || query.includes("brain") || query.includes("numbness")) {
    return "🧠 For headaches, migraines, or nerve-related issues, please consult a Neurologist.";
  }
  if (query.includes("therapy") || query.includes("rehab") || query.includes("muscle stress")) {
    return "⚡ For physical recovery, rehabilitation, or sports injuries, you should consult a Physiotherapist.";
  }

  // FAQs match
  for (const [key, val] of Object.entries(FAQ_RESPONSES)) {
    if (query.includes(key)) {
      return val;
    }
  }

  // Hospital match
  if (query.includes("hospital") || query.includes("clinic") || query.includes("seattle") || query.includes("location")) {
    return "🏢 CareFlow has multiple fully certified medical facilities in Seattle (Downtown and Emerald District), including 'CareFlow General Hospital', 'Northside Cardiology Clinic', and 'Westlake Outpatient Complex'. All are fully staffed with specialists.";
  }

  // General helpful guide
  return "👋 Hello! I am your CareFlow AI triage assistant. I can guide you on symptoms, recommend specialized doctor categories, help explain our lab-to-doctor workflows, or answer system FAQs. Try asking 'I have fever', 'I have knee pain', or 'How to book an appointment'.";
};

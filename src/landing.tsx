import React, { useState } from "react";
import { getResponseFromAI, ChatMessage } from "./chatbotService";
import { 
  Heart, Calendar, Shield, Users, Activity, Activity as Stethoscope, 
  MapPin, MessageSquare, Send, CheckCircle2, ChevronRight, CornerDownRight, Star 
} from "lucide-react";

interface LandingProps {
  onNavigate: (page: string) => void;
  onOpenChatBot: () => void;
}

export default function Landing({ onNavigate, onOpenChatBot }: LandingProps) {
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: "bot", text: "Hello! Try asking me: 'I have fever' or 'I have knee pain'.", timestamp: "Just now" }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatInput("");
    setMessages(prev => [...prev, { sender: "user", text: userText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setLoading(true);

    const reply = await getResponseFromAI(userText);
    setLoading(false);
    setMessages(prev => [...prev, { sender: "bot", text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
  };

  return (
    <div id="landing-container" className="flex flex-col min-h-screen bg-[#f8f9ff]">
      {/* Hero Section */}
      <section className="relative px-6 md:px-12 py-16 md:py-24 flex flex-col md:flex-row items-center gap-12 bg-gradient-to-br from-[#eff4ff] to-[#f8f9ff] overflow-hidden">
        <div className="w-full md:w-1/2 flex flex-col gap-6 z-10">
          <div className="inline-flex items-center gap-2 bg-[#e5eeff] text-[#006591] font-semibold px-3 py-1 rounded-full text-xs max-w-fit">
            <Activity className="w-3.5 h-3.5 text-[#006591]" />
            Smart Hospital Management Platform
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-[#006591] leading-tight tracking-tight">
            Smart Hospital Management for a Healthier Tomorrow.
          </h1>
          <p className="text-lg text-[#3e4850] max-w-lg leading-relaxed">
            Streamline patient care, empower clinicians, and optimize hospital workflows with CareFlow—our intelligent, secure, and intuitive health SaaS platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button 
              onClick={() => onNavigate("register-patient")}
              className="font-semibold bg-[#006591] text-white px-6 py-3 rounded-lg shadow-md hover:bg-[#004c6e] active:scale-98 transition-all flex justify-center items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Book Appointment
            </button>
            <button 
              onClick={() => onNavigate("login")}
              className="font-semibold bg-white text-[#006591] border border-[#ffddb8] px-6 py-3 rounded-lg shadow-md hover:bg-[#eff4ff] active:scale-98 transition-all flex justify-center items-center"
            >
              Login to Clinical Portal
            </button>
          </div>
        </div>

        <div className="w-full md:w-1/2 z-10 relative">
          <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-lg relative border border-[#bec8d2]">
            <img 
              alt="CareFlow Hospital Interior" 
              className="object-cover w-full h-full"
              src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=650"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
          </div>
          
          {/* Floating Stats Card in Hero */}
          <div className="absolute -bottom-4 -left-4 bg-white p-4 rounded-xl shadow-md border border-[#bec8d2] flex items-center gap-3">
            <div className="bg-[#e5eeff] p-2 rounded-full text-[#006591]">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="text-xs text-[#3e4850] font-medium">Patient Satisfaction</div>
              <div className="text-xl font-bold text-[#0b1c30]">98.5%</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="px-6 md:px-12 py-16 bg-[#f8f9ff]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#0b1c30] mb-2">Intelligent Features for Modern Care</h2>
          <p className="text-base text-[#3e4850] max-w-2xl mx-auto">
            Our platform significantly reduces administrative burden so medical staff can focus on what matters most: patient health.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="col-span-1 md:col-span-2 bg-white rounded-xl p-8 border border-[#bec8d2]/40 shadow-sm relative overflow-hidden group">
            <div className="w-12 h-12 bg-[#eff4ff] text-[#006591] rounded-lg flex items-center justify-center mb-4 border border-[#d3e4fe]">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#0b1c30] mb-2">Role-Based Access Control (RBAC)</h3>
            <p className="text-[#3e4850] text-sm max-w-md leading-relaxed">
              Secure, HIPAA-compliant access levels customized for Patients, Doctors, Receptionists, Lab Technicians, Hospital Admins, and Super Admins. Ensure clinical record integrity effortlessly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="col-span-1 bg-[#eff4ff] rounded-xl p-8 border border-[#d3e4fe] shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-white text-[#006591] rounded-lg flex items-center justify-center mb-4 border border-[#bec8d2] shadow-sm">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#0b1c30] mb-2">Real-Time Patient Queue</h3>
              <p className="text-[#3e4850] text-sm leading-relaxed">
                Seamless reception check-ins direct patients instantaneously to their doctor's queue. Track status at a glance.
              </p>
            </div>
          </div>

          {/* Feature 3 (Interactive AI Symptom Trial) */}
          <div id="ai-symptom-section" className="col-span-1 md:col-span-3 bg-white rounded-xl p-6 md:p-8 border border-[#bec8d2]/40 shadow-sm flex flex-col md:flex-row items-stretch gap-8">
            <div className="md:w-1/2 flex flex-col justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#6cf8bb] text-[#00714d] rounded-full text-xs font-bold mb-3 w-fit">
                ✦ AI-POWERED TRIAGE
              </span>
              <h3 className="text-2xl font-bold text-[#0b1c30] mb-3">AI Symptom Guidance & Triage</h3>
              <p className="text-[#3e4850] text-sm mb-6 leading-relaxed">
                Test our smart triage module below. Enter any state or symptom (e.g., knee pain, breathing trouble, fever) to receive guidance on the clinic specialty you need.
              </p>
              
              <div className="space-y-2">
                <button 
                  onClick={() => getResponseFromAI("I have knee pain").then(ans => {
                    setMessages(p => [...p, { sender: "user", text: "I have knee pain", timestamp: "Now" }, { sender: "bot", text: ans, timestamp: "Now" }]);
                  })}
                  className="text-xs text-left text-[#006591] bg-[#eff4ff] hover:bg-[#e5eeff] px-3 py-2 rounded-lg border border-[#bec8d2]/30 flex items-center gap-2 w-full transition-colors"
                >
                  <CornerDownRight className="w-3.5 h-3.5" /> "I have knee pain" (Orthopedic test)
                </button>
                <button 
                  onClick={() => getResponseFromAI("I have fever").then(ans => {
                    setMessages(p => [...p, { sender: "user", text: "I have fever", timestamp: "Now" }, { sender: "bot", text: ans, timestamp: "Now" }]);
                  })}
                  className="text-xs text-left text-[#006591] bg-[#eff4ff] hover:bg-[#e5eeff] px-3 py-2 rounded-lg border border-[#bec8d2]/30 flex items-center gap-2 w-full transition-colors"
                >
                  <CornerDownRight className="w-3.5 h-3.5" /> "I have fever" (General Physician test)
                </button>
              </div>
            </div>

            {/* AI Triage Chatbox UI */}
            <div className="md:w-1/2 bg-[#f8f9ff] rounded-xl border border-[#bec8d2] flex flex-col overflow-hidden min-h-[300px]">
              <div className="bg-[#006591] text-white px-4 py-3 font-semibold text-xs flex items-center justify-between">
                <span>CareFlow Pre-Login Triage Chat</span>
                <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-ping"></span>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[220px]">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex gap-2 ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    {m.sender !== "user" && (
                      <div className="w-7 h-7 rounded-full bg-[#0ea5e9] flex items-center justify-center text-white text-[10px] shrink-0 font-bold">AI</div>
                    )}
                    <div className={`p-2.5 rounded-lg text-xs leading-relaxed max-w-[80%] ${
                      m.sender === "user" 
                        ? "bg-[#006591] text-white rounded-tr-none" 
                        : "bg-white text-[#0b1c30] border border-[#bec8d2]/50 rounded-tl-none"
                    }`}>
                      {m.text}
                      <span className="block text-[8px] text-right mt-1 opacity-70">{m.timestamp}</span>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#0ea5e9] flex items-center justify-center text-white text-[10px]">AI</div>
                    <div className="bg-white p-2.5 rounded-lg text-xs text-slate-400">typing...</div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="border-t border-[#bec8d2] p-2 flex gap-2 bg-white">
                <input 
                  type="text"
                  placeholder="Describe your symptoms..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-[#bec8d2] rounded-md text-xs focus:outline-none focus:border-[#006591]"
                />
                <button type="submit" className="bg-[#006591] text-white px-3 py-1.5 rounded-md hover:bg-[#004c6e] flex items-center justify-center">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Hospital Services & Doctor Categories */}
      <section className="px-6 md:px-12 py-16 bg-white border-y border-[#bec8d2]/30">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#0b1c30] mb-2">Hospital Specialized Departments</h2>
          <p className="text-base text-[#3e4850]">Comprehensive, prompt healthcare diagnostics across multiple specialties.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "🩺", title: "General Medicine", desc: "Expert physical diagnostics" },
            { icon: "❤️", title: "Cardiology", desc: "Advanced cardiac tracking" },
            { icon: "🦴", title: "Orthopedics", desc: "Bones & joints treatment" },
            { icon: "👶", title: "Pediatrics", desc: "Infant & child healthcare" },
            { icon: "🧴", title: "Dermatology", desc: "Skin & allergy solutions" },
            { icon: "🧠", title: "Neurology", desc: "Nerve damage & brain therapies" },
            { icon: "⚡", title: "Physiotherapy", desc: "Skeletal recovery & massage" },
            { icon: "🔬", title: "Diagnostic Lab", desc: "Immediate path reports" }
          ].map((d, index) => (
            <div key={index} className="p-5 bg-[#f8f9ff] border border-[#bec8d2]/30 rounded-xl hover:border-[#006591] hover:scale-102 transition-all cursor-pointer shadow-xs group">
              <span className="text-3xl mb-3 block">{d.icon}</span>
              <h4 className="font-bold text-sm text-[#0b1c30] group-hover:text-[#006591]">{d.title}</h4>
              <p className="text-xs text-[#3e4850] mt-1">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Patient Testimonials */}
      <section className="px-6 md:px-12 py-16 bg-[#f8f9ff]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#0b1c30] mb-2">Patient Success & Stories</h2>
          <p className="text-[#3e4850]">Read clinical recovery statements from patients treated at our general hospitals.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "Robert Miller", comment: "The token system is fantastic. I booked online, arrived, checked under CHECKED_IN, and the doctor saw me within five minutes. Highly recommended!", spec: "General Medicine" },
            { name: "Linda Thompson", comment: "My lab reports for blood panels were published by Tobias (the lab tech) within the evening. Dr. Jenkins instantly adjusted my medicine. The flow is seamless.", spec: "Cardiology" },
            { name: "Matthew Vance", comment: "I appreciate the responsive text reminders on my dashboard. Caring for my orthopedic therapy has never been so uncomplicated.", spec: "Orthopedics" }
          ].map((t, i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-[#bec8d2]/30 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex gap-1 mb-3 text-amber-500">
                  {[...Array(5)].map((_, idx) => <Star key={idx} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <p className="text-xs italic text-[#3e4850] leading-relaxed">"{t.comment}"</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#0b1c30]">
                <span>{t.name}</span>
                <span className="bg-[#eff4ff] text-[#006591] px-2 py-0.5 rounded text-[10px]">{t.spec}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Patient Journey Flow Map */}
      <section className="px-6 md:px-12 py-16 bg-[#e5eeff]/40 border-t border-[#bec8d2]/30">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-[#006591]">Simple Patient Journey</h2>
          <p className="text-xs text-[#3e4850] mt-1 font-medium">Four basic steps to absolute clinical recovery</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center max-w-4xl mx-auto">
          {[
            { num: "1", title: "Register Account", desc: "Register via email or phone securely." },
            { num: "2", title: "Secure Booking", desc: "Select state, area, category, & doctor slot." },
            { num: "3", title: "Instant Consult", desc: "Checkin with reception, proceed to doctor room." },
            { num: "4", title: "Diagnostic Labs", desc: "Generate prescriptions and lab reports instantly." }
          ].map((item, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className="w-10 h-10 bg-[#006591] text-white rounded-full flex items-center justify-center font-bold text-sm mb-3">
                {item.num}
              </div>
              <h4 className="font-bold text-xs text-[#0b1c30] mb-1">{item.title}</h4>
              <p className="text-[11px] text-[#3e4850] max-w-[150px]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="px-6 md:px-12 py-16 bg-white border-t border-[#bec8d2]/30">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#0b1c30]">Hospital Systems Contact Portal</h2>
            <p className="text-xs text-[#3e4850] mt-1">Submit feedback, general inquiries, or partnership registrations.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); alert("Thank you. Our hospital admin representative will contact you shortly."); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1">Full Name</label>
                <input required type="text" className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1">Email Address</label>
                <input required type="email" className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#3e4850] uppercase mb-1">SaaS Interest / Message</label>
              <textarea required rows={4} className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"></textarea>
            </div>
            <button type="submit" className="w-full bg-[#006591] text-white text-xs font-semibold py-2.5 rounded hover:bg-[#004c6e] transition-colors shadow-xs">
              Send Clinical Query
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

/**
 * CAREFLOW - SMART HOSPITALITY MANAGEMENT SYSTEM
 * Core Application Unified Router
 */

import React, { useState, useEffect } from "react";
import { User, UserRole } from "./types";
import { MockDB } from "./mockData";
import Landing from "./landing";
import Auth from "./auth";
import DashboardPatient from "./dashboardPatient";
import DashboardDoctor from "./dashboardDoctor";
import DashboardReceptionist from "./dashboardReceptionist";
import DashboardLabTech from "./dashboardLabTech";
import DashboardHospitalAdmin from "./dashboardHospitalAdmin";
import DashboardMainAdmin from "./dashboardMainAdmin";
import { getResponseFromAI, ChatMessage } from "./chatbotService";
import { supabase } from "./supabaseClient";

import { 
  Building, ShieldAlert, Award, Compass, MessageSquare, 
  Send, X, Sparkles, LogIn, ChevronDown, UserSquare, Shield, Activity
} from "lucide-react";

export default function App() {
  // Navigation: 'home' | 'login' | 'register-patient' | 'portal'
  const [currentView, setCurrentView] = useState<"home" | "login" | "register-patient" | "portal">("home");
  
  // Active user session
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Floating AI Chatbot Widget State
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [botInput, setBotInput] = useState("");
  const [botMessages, setBotMessages] = useState<ChatMessage[]>([
    { sender: "bot", text: "Hello! I am your CareFlow clinical companion. Ask me anything, or type 'I have fever' or 'how to book'.", timestamp: "Now" }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Demo selector dropdown
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  // Restore user session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        restoreUserSession(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        restoreUserSession(session.user.id);
      } else {
        setCurrentUser(null);
        setCurrentView("home");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const restoreUserSession = async (userId: string) => {
    try {
      const { data: dbUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (dbUser && dbUser.status === "ACTIVE") {
        setCurrentUser(dbUser);
        setCurrentView("portal");
      } else {
        if (dbUser && (dbUser.status === "PENDING" || dbUser.status === "SUSPENDED")) {
          await supabase.auth.signOut();
        }
        setCurrentUser(null);
        setCurrentView("home");
      }
    } catch (e) {
      console.error("Session restoration failed:", e);
    }
  };

  // Authenticate user & sync status
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentView("portal");
    
    // Welcome message via persistent chatbot
    setBotMessages(prev => [
      ...prev,
      { sender: "bot", text: `Authenticated successfully! Initiated clinical secure viewport. Active role: [${user.role}].`, timestamp: new Date().toLocaleTimeString() }
    ]);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCurrentView("home");
    alert("CareFlow session security closed. Local certificates revoked.");
  };

  // Chat message submit handler
  const handleBotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botInput.trim()) return;

    const text = botInput;
    setBotInput("");
    setBotMessages(prev => [...prev, { sender: "user", text, timestamp: "Now" }]);
    setIsTyping(true);

    const ans = await getResponseFromAI(text);
    setIsTyping(false);
    setBotMessages(prev => [...prev, { sender: "bot", text: ans, timestamp: "Now" }]);
  };

  const handleQuickLogin = async (email: string, roleName: UserRole) => {
    const pwd = email === "pavaneshvuchuru@gmail.com" ? "V.pavanesh$13" : "password123";
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pwd
      });
      if (error) {
        alert("Quick Login failed: " + error.message);
        return;
      }
      
      const { data: dbUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user?.id)
        .maybeSingle();
        
      if (dbUser) {
        handleLoginSuccess(dbUser);
        setShowDemoMenu(false);
      } else {
        if (email.toLowerCase() === "pavaneshvuchuru@gmail.com") {
          handleLoginSuccess({
            id: data.user?.id || "admin-id",
            email: email.trim(),
            role: UserRole.MAIN_ADMIN,
            status: "ACTIVE" as any,
            created_at: new Date().toISOString()
          });
          setShowDemoMenu(false);
        }
      }
    } catch (e: any) {
      alert("Quick Login error: " + e.message);
    }
  };

  return (
    <div id="careflow-application-root" className="min-h-screen flex flex-col font-sans text-[#111] bg-[#f8f9ff]">
      
      {/* Global Clinical Masthead/Header */}
      <header className="bg-white border-b border-[#bec8d2]/30 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div 
          onClick={() => { if (!currentUser) setCurrentView("home"); }}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#006591] text-white flex items-center justify-center font-black text-rose-100">
            CF
          </div>
          <div>
            <span className="font-black text-sm tracking-tight text-[#006591]">CAREFLOW</span>
            <span className="text-[10px] text-slate-400 block -mt-1 font-semibold">Hospital Systems</span>
          </div>
        </div>

        {/* Demo profiles dropdown descriptor */}
        <div className="relative">
          <button 
            onClick={() => setShowDemoMenu(!showDemoMenu)}
            className="bg-[#eff4ff] hover:bg-[#e5eeff] text-[#006591] text-[11px] font-black tracking-wide uppercase px-3 py-1.5 rounded border border-[#0ea5e9]/20 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Launch Demo Accounts Profile
            <ChevronDown className="w-3 h-3" />
          </button>

          {showDemoMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-[#bec8d2] overflow-hidden z-50">
              <div className="p-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                Select Portal to test:
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <button 
                  onClick={() => handleQuickLogin("sarah@gmail.com", UserRole.PATIENT)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-[#0b1c30] block">Patient Portal</span>
                    <span className="text-[9px] text-[#3e4850]">sarah@gmail.com / password123</span>
                  </div>
                  <span className="text-[9px] font-black text-[#0ea5e9] uppercase">Sarah</span>
                </button>
                <button 
                  onClick={() => handleQuickLogin("emily.chen@careflow.com", UserRole.DOCTOR)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-[#0b1c30] block">Doctor Portal</span>
                    <span className="text-[9px] text-[#3e4850]">emily.chen@careflow.com / password123</span>
                  </div>
                  <span className="text-[9px] font-black text-[#0ea5e9] uppercase">Dr. Emily</span>
                </button>
                <button 
                  onClick={() => handleQuickLogin("receptionist@careflow.com", UserRole.RECEPTIONIST)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-[#0b1c30] block">Reception Desk</span>
                    <span className="text-[9px] text-[#3e4850]">receptionist@careflow.com / password123</span>
                  </div>
                  <span className="text-[9px] font-black text-[#0ea5e9] uppercase">Tobias Desk</span>
                </button>
                <button 
                  onClick={() => handleQuickLogin("lab@careflow.com", UserRole.LAB_TECHNICIAN)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-[#0b1c30] block">Lab Technician</span>
                    <span className="text-[9px] text-[#3e4850]">lab@careflow.com / password123</span>
                  </div>
                  <span className="text-[9px] font-black text-[#0ea5e9] uppercase">Tobias Lab</span>
                </button>
                <button 
                  onClick={() => handleQuickLogin("hadmin@careflow.com", UserRole.HOSPITAL_ADMIN)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-[#0b1c30] block">Hospital Admin</span>
                    <span className="text-[9px] text-[#3e4850]">hadmin@careflow.com / password123</span>
                  </div>
                  <span className="text-[9px] font-black text-[#0ea5e9] uppercase">Approve Staff</span>
                </button>
                <button 
                  onClick={() => handleQuickLogin("pavaneshvuchuru@gmail.com", UserRole.MAIN_ADMIN)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-red-700 block flex items-center gap-1">Super Admin (Pavanesh)</span>
                    <span className="text-[9px] text-[#3e4850]">pavaneshvuchuru@gmail.com / V.pavanesh$13</span>
                  </div>
                  <span className="text-[9px] font-black text-rose-500 uppercase">Master Admin</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Traditional Nav buttons */}
        {!currentUser && (
          <div className="flex gap-4 text-xs font-bold items-center">
            <button 
              onClick={() => { setCurrentView("home"); }}
              className="text-[#3e4850] hover:text-[#0b1c30] transition-colors"
            >
              Overview
            </button>
            <a 
              href="#ai-symptom-section" 
              onClick={() => { setCurrentView("home"); }}
              className="text-[#0ea5e9] hover:underline flex items-center gap-1"
            >
              <Compass className="w-3.5 h-3.5" /> AI Triage Tests
            </a>
            <button 
              onClick={() => { setCurrentView("login"); }}
              className="bg-[#006591] text-white px-4 py-2 rounded-lg hover:bg-[#004c6e] flex items-center gap-1.5 transition-transform"
            >
              <LogIn className="w-3.5 h-3.5" /> Secure Sign-in
            </button>
          </div>
        )}
      </header>

      {/* Primary Application Pages Screen router switcher */}
      <div className="flex-1 flex flex-col">
        {currentView === "home" && !currentUser && (
          <Landing 
            onNavigate={(target) => {
              if (target === "register-patient") {
                setCurrentView("register-patient");
              } else if (target === "login") {
                setCurrentView("login");
              }
            }}
            onOpenChatBot={() => setIsBotOpen(true)}
          />
        )}

        {(currentView === "login" || currentView === "register-patient") && !currentUser && (
          <Auth 
            onLoginSuccess={handleLoginSuccess}
            onNavigateLanding={() => setCurrentView("home")}
          />
        )}

        {currentUser && currentView === "portal" && (
          <div className="flex-1 flex flex-col">
            {/* Header profile trace details */}
            <div className="bg-slate-900 text-teal-400 font-mono text-[10px] px-6 py-2 flex justify-between items-center select-none border-b border-white/10 shrink-0">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#0ea5e9]" />
                Identity active trace: {currentUser.email}
              </span>
              <span>Authenticated via CareFlow Cloud Engine node</span>
            </div>

            {/* Dashboard role distribution routing */}
            {currentUser.role === UserRole.PATIENT && (
              <DashboardPatient user={currentUser} onLogout={handleLogout} />
            )}
            {currentUser.role === UserRole.DOCTOR && (
              <DashboardDoctor user={currentUser} onLogout={handleLogout} />
            )}
            {currentUser.role === UserRole.RECEPTIONIST && (
              <DashboardReceptionist user={currentUser} onLogout={handleLogout} />
            )}
            {currentUser.role === UserRole.LAB_TECHNICIAN && (
              <DashboardLabTech user={currentUser} onLogout={handleLogout} />
            )}
            {currentUser.role === UserRole.HOSPITAL_ADMIN && (
              <DashboardHospitalAdmin user={currentUser} onLogout={handleLogout} />
            )}
            {currentUser.role === UserRole.MAIN_ADMIN && (
              <DashboardMainAdmin user={currentUser} onLogout={handleLogout} />
            )}
          </div>
        )}
      </div>

      {/* PERSISTENT FLOATING AI CHATBOT WIDGET */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isBotOpen ? (
          <div className="w-[320px] sm:w-[360px] bg-white rounded-2xl shadow-2xl border border-[#bec8d2] overflow-hidden flex flex-col combine-anim text-xs max-h-[460px]">
            {/* Header */}
            <div className="bg-[#0b1c30] text-white px-4 py-3 flex items-center justify-between font-extrabold shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#4ef89f] rounded-full animate-pulse" />
                <span className="tracking-tight text-rose-50">CareFlow AI clinical assistant</span>
              </div>
              <button onClick={() => setIsBotOpen(false)} className="text-white hover:text-rose-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 bg-[#f8f9ff] overflow-y-auto space-y-3 min-h-[250px] max-h-[300px]">
              {botMessages.map((m, idx) => (
                <div key={idx} className={`flex gap-2 ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  {m.sender !== "user" && (
                    <div className="w-6 h-6 rounded-full bg-[#006591] flex items-center justify-center text-white text-[9px] shrink-0 font-bold">AI</div>
                  )}
                  <div className={`p-2.5 rounded-lg text-xs leading-normal max-w-[80%] ${
                    m.sender === "user" 
                      ? "bg-[#006591] text-white rounded-tr-none" 
                      : "bg-white text-[#0b1c30] border border-[#bec8d2]/50 rounded-tl-none shadow-xs"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#006591] flex items-center justify-center text-white text-[9px] font-bold">AI</div>
                  <div className="bg-white p-2.5 rounded-lg text-xs text-slate-400">typing clinical advice...</div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleBotSubmit} className="border-t border-[#bec8d2]/30 p-2 bg-white flex gap-2 shrink-0">
              <input 
                type="text"
                value={botInput}
                onChange={(e) => setBotInput(e.target.value)}
                placeholder="Type 'fever', cardiology, custom question..."
                className="flex-1 px-3 py-2 border border-[#bec8d2] rounded-md text-xs focus:outline-none"
              />
              <button type="submit" className="bg-[#006591] hover:bg-[#004c6e] text-white px-3 py-1.5 rounded-md flex items-center justify-center transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setIsBotOpen(true)}
            className="bg-[#006591] hover:bg-[#004c6e] active:scale-95 text-white px-4 py-3 rounded-full flex items-center gap-2 shadow-2xl shadow-slate-400 hover:shadow-cyan-100 transition-all font-bold text-xs"
            title="Open CareFlow AI Triage Desk"
          >
            <MessageSquare className="w-4 h-4" />
            AI Symptom Triage Desk
          </button>
        )}
      </div>

    </div>
  );
}

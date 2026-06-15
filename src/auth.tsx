import React, { useState } from "react";
import { UserRole, Hospital } from "./types";
import { MockDB } from "./mockData";
import { supabase } from "./supabaseClient";
import { 
  Building, User, ShieldAlert, BadgeInfo, KeyRound, 
  Mail, Phone, Lock, Eye, EyeOff, CalendarCheck2, ArrowRight, ShieldCheck, CheckCircle2
} from "lucide-react";

interface AuthProps {
  onLoginSuccess: (user: any) => void;
  onNavigateLanding: () => void;
  initialMode?: "login" | "register" | "forgot" | "reset";
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
    <path
      fill="#EA4335"
      d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582l2.99-2.99C17.583 1.8 14.964 1 12 1 7.244 1 3.178 3.734 1.258 7.72l3.966 3.012z"
    />
    <path
      fill="#4285F4"
      d="M23.04 12.261c0-.82-.089-1.618-.24-2.386H12v4.51h6.24a5.377 5.377 0 0 1-2.324 3.526l3.527 3.526c2.07-1.9 3.597-4.7 3.597-8.98l.04-.67z"
    />
    <path
      fill="#FBBC05"
      d="M5.266 14.235A7.09 7.09 0 0 1 4.9 12c0-.79.135-1.558.366-2.265L1.258 6.723A11.934 11.934 0 0 0 0 12c0 1.92.455 3.734 1.258 5.277l4.008-3.042z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.462-.977 7.283-2.66l-3.527-3.527c-.98.654-2.225 1.054-3.756 1.054-2.88 0-5.32-1.927-6.208-4.527L1.22 16.382A11.947 11.947 0 0 0 12 23z"
    />
  </svg>
);

export default function Auth({ onLoginSuccess, onNavigateLanding, initialMode }: AuthProps) {
  // Tabs: 'login' | 'register' | 'forgot' | 'reset'
  const [activeMode, setActiveMode] = useState<"login" | "register" | "forgot" | "reset">(initialMode || "login");
  
  // Registration Role active tabs
  const [registerRole, setRegisterRole] = useState<UserRole>(UserRole.PATIENT);
  
  // Login Role Tab
  const [loginRole, setLoginRole] = useState<UserRole>(UserRole.PATIENT);

  // Simulated OTP flow variables
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [pendingPatientFields, setPendingPatientFields] = useState<any>(null);

  React.useEffect(() => {
    if (initialMode) {
      setActiveMode(initialMode);
    }
  }, [initialMode]);

  // States
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Registration Fields State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Male");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Hospital Fields
  const [hospitalName, setHospitalName] = useState("");
  const [addressHosp, setAddressHosp] = useState("");
  const [city, setCity] = useState("Seattle");
  const [area, setArea] = useState("Downtown");
  const [stateCode, setStateCode] = useState("WA");
  const [pincode, setPincode] = useState("98101");

  // Doctor Fields
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialization, setSpecialization] = useState("General Physician");
  const [experience, setExperience] = useState("5");

  // Staff (receptionist or labtech)
  const [staffType, setStaffType] = useState<"receptionist" | "labtech">("receptionist");
  const [qualification, setQualification] = useState("");
  const [hospitalsList, setHospitalsList] = useState<Hospital[]>([]);

  React.useEffect(() => {
    MockDB.getHospitals().then(setHospitalsList);
  }, []);

  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        setErrorMsg(error.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during Google Sign-In.");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // 1. Supabase Auth Sign In
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (!data.user) {
        setErrorMsg("Failed to authenticate user.");
        return;
      }

      // 2. Fetch role and status from public.users table
      const { data: dbUser, error: dbErr } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      if (dbErr || !dbUser) {
        // Fallback: Check if it is the fixed main admin seeded manually
        if (email.toLowerCase() === "pavaneshvuchuru@gmail.com" && loginRole === UserRole.MAIN_ADMIN) {
          const fallbackUser = {
            id: data.user.id,
            email: email.trim(),
            role: UserRole.MAIN_ADMIN,
            status: "ACTIVE"
          };
          setSuccessMsg("Success! Secure session initiated. Redirecting...");
          setTimeout(() => {
            onLoginSuccess(fallbackUser);
          }, 800);
          return;
        }
        setErrorMsg("Failed to fetch user profiles. Verify if database synchronization trigger executed.");
        await supabase.auth.signOut();
        return;
      }

      // 3. Validate Role matching
      if (dbUser.role !== loginRole) {
        setErrorMsg(`Access denied. Found account is registered as a ${dbUser.role}, not ${loginRole}. Please select the appropriate role tab.`);
        await supabase.auth.signOut();
        return;
      }

      // 4. Validate Status
      if (dbUser.status === "PENDING") {
        setErrorMsg("Your registration is pending approval. Main Admin or Hospital Admin must approve your credentials before access.");
        await supabase.auth.signOut();
        return;
      }

      if (dbUser.status === "SUSPENDED") {
        setErrorMsg("Your account has been suspended by the administration. Please contact CareFlow corporate desk.");
        await supabase.auth.signOut();
        return;
      }

      // Success login
      setSuccessMsg("Success! Secure session initiated. Redirecting...");
      setTimeout(() => {
        onLoginSuccess(dbUser);
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during authentication.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }

    try {
      // 1. Patient OTP Form
      if (registerRole === UserRole.PATIENT) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              role: UserRole.PATIENT,
              full_name: fullName,
              gender: gender,
              dob: dob,
              address: address
            }
          }
        });

        if (error) {
          setErrorMsg(error.message);
          return;
        }

        if (data.session) {
          setSuccessMsg("Success! Account created. Initializing session...");
          let dbUser = null;
          for (let i = 0; i < 5; i++) {
            const { data: user } = await supabase
              .from("users")
              .select("*")
              .eq("id", data.user!.id)
              .maybeSingle();
            if (user) {
              dbUser = user;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          if (dbUser) {
            setTimeout(() => {
              onLoginSuccess(dbUser);
            }, 800);
            return;
          } else {
            setSuccessMsg("Registration successful! Redirecting to login...");
            handleSubmitRedirect();
            return;
          }
        }

        setPendingPatientFields({
          fullName,
          email,
          phone,
          gender,
          dob,
          address,
          password
        });
        setShowOtpScreen(true);
        setSuccessMsg("Email/SMS verification protocol initialized. Code sent!");
        return;
      }

      // 2. Hospital Admin Register
      if (registerRole === UserRole.HOSPITAL_ADMIN) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              role: UserRole.HOSPITAL_ADMIN,
              full_name: fullName
            }
          }
        });

        if (error) {
          setErrorMsg(error.message);
          return;
        }

        if (!data.user) {
          setErrorMsg("Signup succeeded but user session is empty.");
          return;
        }

        // Create hospital first
        const { data: hospital, error: hErr } = await supabase
          .from("hospitals")
          .insert({
            name: hospitalName,
            address: addressHosp,
            city,
            area,
            state: stateCode,
            pincode,
            approved: false
          })
          .select()
          .single();

        if (hErr) {
          setErrorMsg("Hospital Registration Error: " + hErr.message);
          return;
        }

        // Link hospital admin
        const { error: haErr } = await supabase
          .from("hospital_admins")
          .insert({
            id: data.user.id,
            hospital_id: hospital.id
          });

        if (haErr) {
          setErrorMsg("Hospital Admin Link Error: " + haErr.message);
          return;
        }

        setSuccessMsg("Success! Hospital Admin registered. Status: PENDING (Pending Main Admin approval). Redirecting to Login...");
        handleSubmitRedirect();
      }

      // 3. Doctor Register
      if (registerRole === UserRole.DOCTOR) {
        const { data: hospital } = await supabase
          .from("hospitals")
          .select("id")
          .ilike("name", hospitalName)
          .maybeSingle();

        const hospitalId = hospital?.id;
        if (!hospitalId) {
          setErrorMsg(`Hospital "${hospitalName}" is not registered on the CareFlow platform. Please contact Main Admin.`);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              role: UserRole.DOCTOR,
              full_name: fullName
            }
          }
        });

        if (error) {
          setErrorMsg(error.message);
          return;
        }

        if (!data.user) return;

        const { error: docErr } = await supabase
          .from("doctors")
          .insert({
            id: data.user.id,
            license_number: licenseNumber,
            specialization,
            experience: parseInt(experience) || 0,
            hospital_id: hospitalId,
            city,
            area,
            approved: false
          });

        if (docErr) {
          setErrorMsg("Doctor Profile Registration Error: " + docErr.message);
          return;
        }

        setSuccessMsg("Clinician application submitted! Status: PENDING (Approval required from corresponding Hospital Admin). Redirecting to Login...");
        handleSubmitRedirect();
      }

      // 4. Receptionist Register
      if (registerRole === UserRole.RECEPTIONIST) {
        const { data: hospital } = await supabase
          .from("hospitals")
          .select("id")
          .ilike("name", hospitalName)
          .maybeSingle();

        const hospitalId = hospital?.id;
        if (!hospitalId) {
          setErrorMsg(`Hospital "${hospitalName}" is not registered on the CareFlow platform.`);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              role: UserRole.RECEPTIONIST,
              full_name: fullName
            }
          }
        });

        if (error) {
          setErrorMsg(error.message);
          return;
        }

        if (!data.user) return;

        const { error: recepErr } = await supabase
          .from("receptionists")
          .insert({
            id: data.user.id,
            hospital_id: hospitalId,
            approved: false
          });

        if (recepErr) {
          setErrorMsg("Receptionist Profile Error: " + recepErr.message);
          return;
        }

        setSuccessMsg("Staff registration submitted! Status: PENDING (Hospital Admin approval requested). Redirecting to Login...");
        handleSubmitRedirect();
      }

      // 5. Lab Tech Register
      if (registerRole === UserRole.LAB_TECHNICIAN) {
        const { data: hospital } = await supabase
          .from("hospitals")
          .select("id")
          .ilike("name", hospitalName)
          .maybeSingle();

        const hospitalId = hospital?.id;
        if (!hospitalId) {
          setErrorMsg(`Hospital "${hospitalName}" is not registered on the CareFlow platform.`);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              role: UserRole.LAB_TECHNICIAN,
              full_name: fullName
            }
          }
        });

        if (error) {
          setErrorMsg(error.message);
          return;
        }

        if (!data.user) return;

        const { error: labErr } = await supabase
          .from("lab_technicians")
          .insert({
            id: data.user.id,
            qualification,
            hospital_id: hospitalId,
            approved: false
          });

        if (labErr) {
          setErrorMsg("Lab Technician Profile Error: " + labErr.message);
          return;
        }

        setSuccessMsg("Lab Specialist registered! Status: PENDING (Hospital Admin approval requested). Redirecting to Login...");
        handleSubmitRedirect();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during signup.");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpValue,
        type: "signup"
      });

      if (error) {
        setErrorMsg("Verification failed: " + error.message);
        return;
      }

      alert("Verification Success! Welcome to CareFlow!");
      setShowOtpScreen(false);
      setPendingPatientFields(null);
      setActiveMode("login");
      setLoginRole(UserRole.PATIENT);
      setEmail(email.trim());
      setPassword(password);
    } catch (err: any) {
      setErrorMsg(err.message || "OTP verification error.");
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Success! A password recovery link has been sent to your email.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Password successfully updated! Redirecting to login...");
        setTimeout(() => {
          supabase.auth.signOut();
          setActiveMode("login");
          setSuccessMsg("");
          setPassword("");
          setConfirmPassword("");
        }, 2000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    }
  };

  const handleSubmitRedirect = () => {
    setTimeout(() => {
      setActiveMode("login");
      setLoginRole(registerRole);
    }, 2500);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-gradient-to-br from-[#eff4ff] to-white min-h-[85vh]">
      <div className="bg-white rounded-xl shadow-xl border border-[#bec8d2]/40 w-full max-w-[550px] overflow-hidden flex flex-col">
        {/* Header Title */}
        <div className="px-6 py-5 text-center bg-[#f8f9ff] border-b border-[#bec8d2]/30">
          <h2 className="text-2xl font-black text-[#006591] tracking-tight">
            CareFlow <span className="font-light text-[#0b1c30]">Portal</span>
          </h2>
          <p className="text-xs text-[#3e4850] mt-1">Multi-Role Secured Medical SaaS Node</p>
        </div>

        {/* Outer Tabs: LOGIN vs REGISTER */}
        {!showOtpScreen && activeMode !== "forgot" && activeMode !== "reset" && (
          <div className="flex border-b border-[#bec8d2]/20">
            <button
              onClick={() => { setActiveMode("login"); setErrorMsg(""); }}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                activeMode === "login" 
                  ? "bg-white text-[#006591] border-b-2 border-[#006591]" 
                  : "bg-stone-50 text-[#3e4850] hover:bg-[#eff4ff]"
              }`}
            >
              SECURE LOGIN
            </button>
            <button
              onClick={() => { setActiveMode("register"); setErrorMsg(""); }}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                activeMode === "register" 
                  ? "bg-white text-[#006591] border-b-2 border-[#006591]" 
                  : "bg-stone-50 text-[#3e4850] hover:bg-[#eff4ff]"
              }`}
            >
              NEW REGISTRATION
            </button>
          </div>
        )}

        <div className="p-6 flex-grow">
          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 rounded flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-red-700">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="bg-[#6cf8bb]/20 border-l-4 border-emerald-500 p-3 mb-4 rounded flex items-start gap-2 animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-emerald-800">{successMsg}</p>
            </div>
          )}

          {/* SIMULATED OTP SCREEN */}
          {showOtpScreen ? (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4 text-center">
              <div className="w-12 h-12 bg-[#0ea5e9]/10 text-[#006591] rounded-full flex items-center justify-center mx-auto mb-2 border border-[#0ea5e9]/30">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0b1c30]">Verify OTP Email</h3>
              <p className="text-[11px] text-[#3e4850] max-w-sm mx-auto">
                CareFlow security sent a verification code to <span className="font-bold text-[#006591]">{email}</span>. Please enter the verification code below to activate your patient dashboard.
              </p>
              
              <div className="bg-[#eff4ff] border border-[#d3e4fe] p-2.5 rounded text-[10px] text-center font-mono my-2 text-slate-600">
                [SIMULATOR]: Enter <strong>123456</strong> as the OTP code
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold text-[#3e4850] uppercase">OTP Verification Code</label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value)}
                  className="w-full text-center tracking-widest font-mono text-base px-3 py-2 border border-[#bec8d2] rounded focus:outline-none focus:border-[#006591]"
                />
              </div>

              <button
                type="submit"
                className="bg-[#004c6e] text-white text-xs font-semibold py-2 rounded-lg hover:bg-[#003751] mt-3"
              >
                Verify Code & Register
              </button>

              <button
                type="button"
                onClick={() => { setShowOtpScreen(false); setSuccessMsg(""); }}
                className="text-[10px] text-slate-500 hover:underline"
              >
                ← Cancel registration
              </button>
            </form>
          ) : activeMode === "forgot" ? (
            <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-[#0ea5e9]/10 text-[#006591] rounded-full flex items-center justify-center mx-auto mb-2 border border-[#0ea5e9]/30">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0b1c30] text-center">Reset your password</h3>
              <p className="text-[11px] text-[#3e4850] text-center max-w-sm mx-auto">
                CareFlow security will email you instructions to safely reset your password.
              </p>
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold text-[#3e4850] uppercase flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email Address
                </label>
                <input
                  required
                  type="email"
                  placeholder="name@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#006591] text-white text-xs font-bold py-2.5 rounded hover:bg-[#004c6e] flex items-center justify-center gap-2 mt-2 transition-colors shadow-xs"
              >
                Send Recovery Instructions
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setActiveMode("login"); setErrorMsg(""); setSuccessMsg(""); }}
                className="text-[10px] text-[#006591] hover:underline text-center mt-2"
              >
                ← Back to Secure Login
              </button>
            </form>
          ) : activeMode === "reset" ? (
            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-250">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0b1c30] text-center">Choose new password</h3>
              <p className="text-[11px] text-[#3e4850] text-center max-w-sm mx-auto">
                Type your new secure account password below.
              </p>
              
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold text-[#3e4850] uppercase flex items-center gap-1">
                  New Password
                </label>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold text-[#3e4850] uppercase flex items-center gap-1">
                  Confirm Password
                </label>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#006591] text-white text-xs font-bold py-2.5 rounded hover:bg-[#004c6e] flex items-center justify-center gap-2 mt-2 transition-colors shadow-xs"
              >
                Update password & Sign-in
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : activeMode === "login" ? (
            /* --- LOGIN MODE --- */
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              {/* Role select mini-tabs */}
              <div>
                <label className="block text-[10px] font-extrabold text-[#3e4850] uppercase mb-1.5 text-center">
                  Select your role portal
                </label>
                <div className="grid grid-cols-3 gap-1 bg-stone-50 p-1 rounded border border-[#bec8d2]/30">
                  {[
                    { role: UserRole.PATIENT, label: "Patient" },
                    { role: UserRole.DOCTOR, label: "Doctor" },
                    { role: UserRole.RECEPTIONIST, label: "Reception" },
                    { role: UserRole.LAB_TECHNICIAN, label: "Lab Tech" },
                    { role: UserRole.HOSPITAL_ADMIN, label: "Hosp Admin" },
                    { role: UserRole.MAIN_ADMIN, label: "Main Admin" }
                  ].map((r) => (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => setLoginRole(r.role)}
                      className={`py-1.5 text-[9px] font-black rounded transition-all uppercase ${
                        loginRole === r.role 
                          ? "bg-[#006591] text-white shadow-xs" 
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>


              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#3e4850] uppercase flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email Address
                </label>
                <input
                  required
                  type="email"
                  placeholder="name@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[#3e4850] uppercase flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> Password
                  </label>
                  <button type="button" onClick={() => { setActiveMode("forgot"); setErrorMsg(""); setSuccessMsg(""); }} className="text-[10px] text-[#006591] hover:underline hover:text-[#004c6e]">Forgot Password?</button>
                </div>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#006591] text-white text-xs font-bold py-2.5 rounded hover:bg-[#004c6e] flex items-center justify-center gap-2 mt-2 transition-colors shadow-xs"
              >
                PROCEED SECURE LOGIN
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="relative my-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <span className="relative bg-white px-2 text-[10px] uppercase text-slate-400 font-bold">Or</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold py-2.5 rounded flex items-center justify-center transition-colors shadow-xs"
              >
                <GoogleIcon />
                Sign in with Google
              </button>
            </form>
          ) : (
            /* --- REGISTER MODE --- */
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
              {/* Select registration role tab */}
              <div>
                <label className="block text-[10px] font-extrabold text-[#3e4850] uppercase mb-1.5 text-center">
                  Select System Role to Apply
                </label>
                <div className="grid grid-cols-5 gap-1 bg-stone-50 p-1 rounded border border-[#bec8d2]/30">
                  {[
                    { role: UserRole.PATIENT, label: "Patient" },
                    { role: UserRole.DOCTOR, label: "Doctor" },
                    { role: UserRole.RECEPTIONIST, label: "Reception" },
                    { role: UserRole.LAB_TECHNICIAN, label: "Lab Tech" },
                    { role: UserRole.HOSPITAL_ADMIN, label: "Hosp Admin" }
                  ].map((r) => (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => setRegisterRole(r.role)}
                      className={`py-2 text-[8px] font-black rounded transition-all uppercase leading-none ${
                        registerRole === r.role 
                          ? "bg-[#0ea5e9] text-white shadow-xs" 
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SHARED REQUIRED FIELDS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#3e4850] uppercase">Full name</label>
                  <input
                    required
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#3e4850] uppercase">Email Address</label>
                  <input
                    required
                    type="email"
                    placeholder="email@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                  />
                </div>
              </div>

              {/* DYNAMIC FIELDS PER SELECTED REGISTERING ROLE */}

              {/* 1. Patient Fields */}
              {registerRole === UserRole.PATIENT && (
                <div className="grid grid-cols-2 gap-3 bg-[#eff4ff]/30 p-3 rounded border border-[#d3e4fe]/50">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Phone Number</label>
                    <input
                      required
                      type="tel"
                      placeholder="+1 (206) 555-0199"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Gender Selection</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Date of Birth</label>
                    <input
                      required
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Address</label>
                    <input
                      required
                      type="text"
                      placeholder="123 Pike St, Seattle"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                </div>
              )}

              {/* 2. Hospital Admin Fields */}
              {registerRole === UserRole.HOSPITAL_ADMIN && (
                <div className="grid grid-cols-2 gap-3 bg-[#eff4ff]/30 p-3 rounded border border-[#d3e4fe]/50">
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Hospital Name</label>
                    <input
                      required
                      type="text"
                      placeholder="Seattle Medical Center"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Address</label>
                    <input
                      required
                      type="text"
                      placeholder="850 Health Plaza"
                      value={addressHosp}
                      onChange={(e) => setAddressHosp(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">City</label>
                    <input
                      required
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Area</label>
                    <input
                      required
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">State</label>
                    <input
                      required
                      type="text"
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Pincode</label>
                    <input
                      required
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                </div>
              )}

              {/* 3. Doctor Fields */}
              {registerRole === UserRole.DOCTOR && (
                <div className="grid grid-cols-2 gap-3 bg-[#eff4ff]/30 p-3 rounded border border-[#d3e4fe]/50">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Phone Number</label>
                    <input
                      required
                      type="tel"
                      placeholder="+1 (206) ..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Medical License #</label>
                    <input
                      required
                      type="text"
                      placeholder="LIC-CODE..."
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Specialization</label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                    >
                      <option value="General Physician">General Physician</option>
                      <option value="Cardiologist">Cardiologist</option>
                      <option value="Orthopedic">Orthopedic Specialist</option>
                      <option value="Physiotherapist">Physiotherapist</option>
                      <option value="Dermatologist">Dermatologist</option>
                      <option value="Neurologist">Neurologist</option>
                      <option value="Pediatrician">Pediatrician</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Experience (Years)</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Hospital Name</label>
                    <select
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                    >
                      <option value="">-- Associate Clinic --</option>
                      {hospitalsList.map(h => (
                        <option key={h.id} value={h.name}>{h.name} ({h.city})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Work City</label>
                    <input
                      required
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Work Area</label>
                    <input
                      required
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                </div>
              )}

              {/* 4. Receptionist & Lab Tech form fields */}
              {(registerRole === UserRole.RECEPTIONIST || registerRole === UserRole.LAB_TECHNICIAN) && (
                <div className="grid grid-cols-2 gap-3 bg-[#eff4ff]/30 p-3 rounded border border-[#d3e4fe]/50">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Phone Number</label>
                    <input
                      required
                      type="tel"
                      placeholder="+1 (206) ..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>

                  {registerRole === UserRole.LAB_TECHNICIAN ? (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#3e4850] uppercase">Qualification</label>
                      <input
                        required
                        type="text"
                        placeholder="M.Sc. Microbiology etc."
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#3e4850] uppercase">Desk Role</label>
                      <input
                        readOnly
                        type="text"
                        value="Senior Reception Officer"
                        className="w-full px-3 py-1.5 border border-[#bec8d2] bg-slate-50 text-slate-500 rounded text-xs focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Hospital Name</label>
                    <select
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] bg-white rounded text-xs focus:outline-none focus:border-[#006591]"
                    >
                      <option value="">-- Select Associate Hospital --</option>
                      {hospitalsList.map(h => (
                        <option key={h.id} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">City</label>
                    <input
                      required
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#3e4850] uppercase">Area</label>
                    <input
                      required
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                    />
                  </div>
                </div>
              )}

              {/* SHARED PASSWORD FIELDS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#3e4850] uppercase">Password</label>
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#3e4850] uppercase">Confirm Password</label>
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#bec8d2] rounded text-xs focus:outline-none focus:border-[#006591]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#006591] hover:bg-[#004c6e] text-white text-xs font-bold py-2.5 rounded flex items-center justify-center gap-2 mt-2 transition-colors shadow-xs"
              >
                SUBMIT SYSTEM APPLICATION
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="relative my-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <span className="relative bg-white px-2 text-[10px] uppercase text-slate-400 font-bold">Or</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold py-2.5 rounded flex items-center justify-center transition-colors shadow-xs"
              >
                <GoogleIcon />
                Register with Google
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

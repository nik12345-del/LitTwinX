import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  Mail,
  Lock,
  User,
  KeyRound,
} from "lucide-react";

import { login, signup } from "../services/api";


const SignUp = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);


  const handleSignup = async (event) => {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      await signup({
        full_name: fullName.trim(),
        professional_id: professionalId.trim(),
        email: normalizedEmail,
        password,
      });

      await login({
        email: normalizedEmail,
        password,
      });

     navigate("/patient-info");

    } catch (signupError) {
      setError(signupError.message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]"></div>

      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md bg-surface/80 backdrop-blur-xl p-10 rounded-3xl border border-white/10 shadow-2xl relative z-10">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black rounded-xl flex justify-center items-center shadow-inner">
              <Activity className="text-primary" size={28} />
            </div>

            <span className="font-extrabold text-3xl tracking-tight text-white">
              Li<span className="text-primary">TwinX</span>
            </span>
          </div>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">
            Create Account
          </h2>

          <p className="text-textMuted text-sm">
            Join the next-gen AI medical network
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-textMuted ml-1">
              Full Name
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-textMuted" />
              </div>

              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white transition-all outline-none"
                placeholder="Dr. John Doe"
                autoComplete="name"
                minLength={2}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-textMuted ml-1">
              Medical ID / License
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-textMuted" />
              </div>

              <input
                type="text"
                value={professionalId}
                onChange={(event) =>
                  setProfessionalId(event.target.value)
                }
                className="w-full pl-11 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white transition-all outline-none"
                placeholder="MED-XXX-XXXX"
                maxLength={50}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-textMuted ml-1">
              Email
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-textMuted" />
              </div>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white transition-all outline-none"
                placeholder="doctor@hospital.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-textMuted ml-1">
              Password
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-textMuted" />
              </div>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white transition-all outline-none"
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-primary hover:bg-primaryHover text-white rounded-xl font-semibold shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all transform hover:-translate-y-0.5 mt-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-textMuted">
          Already have an account?{" "}
          <Link
            to="/"
            className="text-primary hover:text-primaryHover font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};


export default SignUp;
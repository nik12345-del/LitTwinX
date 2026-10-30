import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Scan } from "lucide-react";

import DigitalTwin from "../components/DigitalTwin";
import { login } from "../services/api";


const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);


  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      await login({
        email: email.trim(),
        password,
      });

     navigate("/patient-info");
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8">
        <div className="hidden lg:flex flex-col justify-center rounded-[2rem] bg-[#111111] border border-white/10 p-10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="mb-8">
            <span className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              <Scan size={18} /> LiTwinX Engine
            </span>
          </div>

          <div className="mt-6 rounded-[2rem] overflow-hidden border border-white/10 bg-black/50">
            <DigitalTwin
              analysisActive={true}
              riskFactor={0.55}
              currentMonth={0}
              tumorType="Hepatocellular Carcinoma"
            />
          </div>

          <h1 className="text-5xl font-black leading-tight mb-6 mt-8">
            AI-powered liver tumor analysis made simple.
          </h1>

          <p className="max-w-lg text-gray-400 text-sm leading-7">
            Upload an MRI scan and get explainable tumor analysis with
            confidence scores, risk prediction, and visual AI results.
          </p>

          <div className="mt-10 grid gap-4">
            <div className="rounded-3xl bg-white/5 border border-white/10 p-5">
              <p className="text-xs uppercase text-gray-500 tracking-[0.35em] mb-2">
                Fast analysis
              </p>
              <p className="font-semibold text-white">
                Secure backend inference with liver diagnostics.
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 border border-white/10 p-5">
              <p className="text-xs uppercase text-gray-500 tracking-[0.35em] mb-2">
                Explainable AI
              </p>
              <p className="font-semibold text-white">
                See why the model predicted tumor type and location.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-[#111111] border border-white/10 p-10 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-3">Welcome Back</h1>
            <p className="text-gray-400">
              Login and start your MRI analysis workflow.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-sm text-gray-400 block mb-2">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                className="w-full rounded-2xl border border-white/10 bg-[#070707] px-4 py-3 text-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-white/10 bg-[#070707] px-4 py-3 text-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                required
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-white text-black font-semibold py-3 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            New user?{" "}
            <Link
              to="/signup"
              className="text-white font-semibold hover:underline"
            >
              Sign up here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};


export default Login;
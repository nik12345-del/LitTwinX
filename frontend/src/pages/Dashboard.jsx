import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarDays,
  Download,
  FileText,
  History,
  LogOut,
  MessageCircle,
  Minus,
  Ruler,
  Send,
  Shield,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import DigitalTwin from "../components/DigitalTwin";
import {
  askAnalysisQuestion,
  downloadAnalysisReport,
  getAnalysis,
  getPatientAnalyses,
  isAuthenticated,
  logout,
} from "../services/api";


const RESULT_KEY = "mri_analysis_result";
const PATIENT_KEYS = [
  "selected_patient",
  "patient_info",
  "current_patient",
  "patient",
];


function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}


function firstValue(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== ""
  );
}


function normalizePatient(patient, result) {
  const resultPatient = result?.patient || {};
  const firstName = firstValue(patient?.first_name, patient?.firstName);
  const lastName = firstValue(patient?.last_name, patient?.lastName);
  const joinedName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    databaseId: firstValue(
      patient?.id,
      resultPatient?.id,
      result?.patient_id,
      result?.analyzed_for_patient_id
    ),
    code: firstValue(
      patient?.patient_code,
      patient?.patientCode,
      resultPatient?.patient_code,
      "Not available"
    ),
    name: firstValue(
      patient?.full_name,
      patient?.name,
      joinedName,
      resultPatient?.full_name,
      result?.patient_name,
      "Not available"
    ),
    age: firstValue(
      patient?.age,
      resultPatient?.age,
      result?.patient_age,
      "Not available"
    ),
    gender: firstValue(
      patient?.sex,
      patient?.gender,
      resultPatient?.sex,
      result?.patient_gender,
      "Not available"
    ),
  };
}


function metric(value, suffix = "", digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(digits)}${suffix}` : "—";
}


function formatDate(value) {
  if (!value) return "Unknown date";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}


function TrendIcon({ trend }) {
  if (trend === "increased") return <TrendingUp className="text-red-400" size={22} />;
  if (trend === "decreased") return <TrendingDown className="text-green-400" size={22} />;
  return <Minus className="text-yellow-400" size={22} />;
}


const Dashboard = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [activeView, setActiveView] = useState("xai");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "Ask me about this scan's size, confidence, uncertainty, location, tumor type, XAI, or previous-scan comparison.",
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (!isAuthenticated()) {
        navigate("/", { replace: true });
        return;
      }

      const storedPatient = PATIENT_KEYS.map(readJson).find(Boolean) || {};
      const storedResult = readJson(RESULT_KEY);
      const patientId = firstValue(
        storedPatient?.id,
        storedResult?.patient?.id,
        storedResult?.patient_id,
        storedResult?.analyzed_for_patient_id
      );

      try {
        let activeResult = storedResult;
        let patientHistory = [];

        if (patientId) {
          patientHistory = await getPatientAnalyses(patientId);
          if (!activeResult && patientHistory.length > 0) {
            activeResult = await getAnalysis(patientHistory[0].analysis_id);
          }
        }

        if (!activeResult) {
          throw new Error(
            patientId
              ? "This patient has no saved analysis yet. Upload a scan first."
              : "Select a patient and analyze an image first."
          );
        }

        if (
          activeResult.analysis_id &&
          !activeResult.original_image &&
          !activeResult.xai_overlay_image
        ) {
          activeResult = await getAnalysis(activeResult.analysis_id);
        }

        if (!cancelled) {
          setResult(activeResult);
          setPatient(
            normalizePatient(
              activeResult.patient || storedPatient,
              activeResult
            )
          );
          setHistory(patientHistory);
          setComparison(activeResult.comparison || null);
          localStorage.setItem(RESULT_KEY, JSON.stringify(activeResult));
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const views = useMemo(() => {
    if (!result) return [];
    return [
      {
        id: "xai",
        label: "Tumor XAI Overlay",
        image: result.xai_overlay_image || result.overlay_image,
      },
      {
        id: "probability",
        label: "Tumor Probability Heatmap",
        image: result.tumor_probability_heatmap,
      },
      {
        id: "uncertainty",
        label: "Prediction Uncertainty",
        image: result.uncertainty_heatmap,
      },
      {
        id: "segmentation",
        label: "Liver–Tumor Segmentation",
        image: result.overlay_image || result.mask_image,
      },
    ];
  }, [result]);

  const selectedView = views.find((view) => view.id === activeView) || views[0];

  const activateAnalysis = async (analysisId) => {
    if (analysisId === result?.analysis_id) return;
    setLoadError("");
    try {
      const selected = await getAnalysis(analysisId);
      setResult(selected);
      setComparison(selected.comparison || null);
      setPatient(normalizePatient(selected.patient || patient, selected));
      setActiveView("xai");
      setChatMessages([
        {
          role: "assistant",
          text: "This saved scan is loaded. Ask about its result or comparison with the preceding scan.",
        },
      ]);
      localStorage.setItem(RESULT_KEY, JSON.stringify(selected));
    } catch (error) {
      setLoadError(error.message);
    }
  };

  const handleDownload = async () => {
    if (!result?.analysis_id) return;
    setIsDownloading(true);
    setLoadError("");
    try {
      await downloadAnalysisReport(result.analysis_id);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const submitQuestion = async (event, suggestedQuestion) => {
    event?.preventDefault();
    const nextQuestion = (suggestedQuestion || question).trim();
    if (!nextQuestion || !result?.analysis_id || isAsking) return;

    setQuestion("");
    setChatMessages((current) => [
      ...current,
      { role: "user", text: nextQuestion },
    ]);
    setIsAsking(true);

    try {
      const response = await askAnalysisQuestion(
        result.analysis_id,
        nextQuestion
      );
      setChatMessages((current) => [
        ...current,
        { role: "assistant", text: response.answer },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        { role: "assistant", text: `Unable to answer: ${error.message}` },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem(RESULT_KEY);
    localStorage.removeItem("selected_patient");
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <Activity className="animate-pulse text-primary mr-3" /> Loading patient analysis...
      </div>
    );
  }

  if (!result || !patient) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center text-white">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Analysis not available</h2>
        <p className="text-textMuted text-sm mb-5">{loadError}</p>
        <button
          onClick={() => navigate("/patient-info")}
          className="px-5 py-2 bg-primary rounded-lg font-semibold"
        >
          Select patient
        </button>
      </div>
    );
  }

  const tumorDetected = Boolean(result.tumor_detected);
  const trend = comparison?.trend || "baseline";
  const historyAvailable = Boolean(comparison?.available);

  return (
    <div className="min-h-screen bg-background text-white">
      <nav className="sticky top-0 z-50 w-full px-6 py-4 border-b border-white/10 bg-background/90 backdrop-blur-md flex justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
            <Activity className="text-primary" size={22} />
          </div>
          <span className="font-extrabold text-2xl tracking-tight">
            Li<span className="text-primary">TwinX</span>
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-textMuted hover:text-white bg-white/5 py-2 px-4 rounded-full border border-white/10"
        >
          <LogOut size={16} /> Logout
        </button>
      </nav>

      <main className="max-w-7xl mx-auto w-full p-5 md:p-8">
        {loadError && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <aside className="space-y-6">
            <section className="bg-surface border border-white/10 rounded-2xl p-5 shadow-xl">
              <h3 className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm border-b border-white/10 pb-3 mb-4">
                <User className="text-primary" size={17} /> Patient Profile
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-textMuted">Name</p>
                  <p className="font-semibold">{patient.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-textMuted">Age</p>
                    <p className="font-semibold">{patient.age}</p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Gender</p>
                    <p className="font-semibold">{patient.gender}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-textMuted">Patient ID</p>
                  <p className="font-semibold">{patient.code}</p>
                </div>
                <button
                  onClick={() => navigate("/patient-info")}
                  className="text-xs text-primary hover:underline"
                >
                  Change patient
                </button>
              </div>
            </section>

            <section className="bg-surface border border-white/10 rounded-2xl p-5 shadow-xl">
              <h3 className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm border-b border-white/10 pb-3 mb-4">
                <History className="text-primary" size={17} /> Scan History
              </h3>
              {history.length === 0 ? (
                <p className="text-xs text-textMuted">No saved history yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {history.map((item) => (
                    <button
                      type="button"
                      key={item.analysis_id}
                      onClick={() => activateAnalysis(item.analysis_id)}
                      className={`w-full text-left rounded-lg border p-3 text-xs ${
                        item.analysis_id === result.analysis_id
                          ? "border-primary bg-primary/15"
                          : "border-white/10 bg-black/20 hover:border-white/30"
                      }`}
                    >
                      <span className="font-semibold block">
                        {formatDate(item.scan_date)}
                      </span>
                      <span className="text-textMuted block truncate mt-1">
                        {item.filename} · {item.tumor_pixel_count} tumor pixels
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-surface border border-white/10 rounded-2xl p-5 shadow-xl">
              <h3 className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm border-b border-white/10 pb-3 mb-5">
                <Brain className="text-primary" size={17} /> Current AI Finding
              </h3>
              <div
                className={`inline-block px-3 py-2 rounded-md text-sm font-bold border ${
                  tumorDetected
                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                    : "bg-green-500/20 text-green-400 border-green-500/40"
                }`}
              >
                {tumorDetected ? "TUMOR REGION DETECTED" : "NO TUMOR REGION DETECTED"}
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-textMuted">Confidence</span>
                  <strong>{metric(result.tumor_confidence, "%")}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-textMuted">Peak probability</span>
                  <strong>{metric(result.peak_tumor_probability, "%")}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-textMuted">Mean uncertainty</span>
                  <strong>{metric(result.mean_uncertainty, "%")}</strong>
                </div>
              </div>
              <p className="text-xs text-yellow-400 mt-5 pt-4 border-t border-white/10">
                Confidence is a model score, not clinical disease risk.
              </p>
            </section>
          </aside>

          <section className="xl:col-span-3 bg-surfaceHigh rounded-2xl p-5 md:p-7 border border-white/10">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
              <div>
                <h1 className="text-3xl font-extrabold">LiTwinX Liver Analysis</h1>
                <p className="text-textMuted flex items-center gap-2 mt-1">
                  <CalendarDays size={15} /> Scan: {formatDate(result.scan_date)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownload}
                  disabled={!result.analysis_id || isDownloading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primaryHover rounded-full font-semibold disabled:opacity-50"
                >
                  <Download size={16} />
                  {isDownloading ? "Creating PDF..." : "Download PDF"}
                </button>
                <button
                  onClick={() => navigate("/mri-upload")}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold"
                >
                  Scan New Image
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-surface/50 rounded-2xl border border-white/10 p-4">
                <h3 className="flex items-center gap-2 text-textMuted mb-4">
                  <Brain size={17} /> {selectedView?.label || "XAI Visualization"}
                </h3>
                <div className="h-[390px] bg-black rounded-xl border border-white/10 flex items-center justify-center overflow-hidden">
                  {selectedView?.image ? (
                    <img
                      src={selectedView.image}
                      alt={selectedView.label}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <p className="text-textMuted text-sm">Visualization not available.</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {views.map((view) => (
                    <button
                      key={view.id}
                      onClick={() => setActiveView(view.id)}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                        activeView === view.id
                          ? "bg-primary text-white border-primary"
                          : "bg-black/20 text-textMuted border-white/10 hover:text-white"
                      }`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-textMuted">
                  Heatmaps visualize tumor-class probability and uncertainty; they do not identify tumor subtype.
                </p>
              </section>

              <section className="bg-surface/50 rounded-2xl border border-white/10 p-4">
                <h3 className="flex items-center gap-2 text-textMuted mb-4">
                  <Activity size={17} /> 3D Liver Twin Prototype
                </h3>
                <div className="h-[440px] bg-black rounded-xl border border-white/10 overflow-hidden">
                  <DigitalTwin
                    analysisActive={true}
                    riskFactor={0}
                    currentMonth={0}
                    tumorType={null}
                  />
                </div>
                <p className="mt-3 text-xs text-textMuted">
                  Visualization only; a single 2D PNG cannot produce a patient-specific 3D liver.
                </p>
              </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <section className="bg-surface/50 rounded-2xl border border-white/10 p-5">
                <h3 className="flex items-center gap-2 text-textMuted mb-5">
                  <FileText size={17} /> Segmentation Metrics
                </h3>
                <div className="space-y-4 text-sm">
                  <MetricRow label="Detected class" value={tumorDetected ? "Tumor region" : "No tumor region"} />
                  <MetricRow label="Tumor area within liver" value={metric(result.tumor_percentage_of_liver, "%", 2)} />
                  <MetricRow label="Liver pixels" value={result.liver_pixel_count} />
                  <MetricRow label="Tumor pixels" value={result.tumor_pixel_count} />
                  <MetricRow label="Tumor regions" value={result.tumor_region_count} />
                  <MetricRow label="Largest region" value={`${result.largest_tumor_region_pixels} processed pixels`} />
                  <MetricRow label="Image-relative location" value={result.tumor_location} />
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-textMuted">Tumor type</p>
                    <strong className="text-yellow-400">Not classified</strong>
                    <p className="text-xs text-textMuted mt-1">
                      Separate labeled subtype classifier is required.
                    </p>
                  </div>
                </div>
              </section>

              <section className="lg:col-span-2 bg-surface/50 rounded-2xl border border-white/10 p-5">
                <h3 className="flex items-center gap-2 text-textMuted mb-5">
                  <BarChart3 size={17} /> Explainable AI Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InfoCard label="XAI method" value={result.xai_method} />
                  <InfoCard label="Model confidence" value={metric(result.tumor_confidence, "%")} large />
                  <InfoCard label="Mean uncertainty" value={metric(result.mean_uncertainty, "%")} large />
                </div>
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h4 className="text-textMuted mb-3">Why the model produced this result</h4>
                  <p className="text-sm leading-6 text-white/90">{result.xai_explanation}</p>
                  {Array.isArray(result.xai_explanation_points) && (
                    <ul className="mt-3 space-y-2 list-disc pl-5 text-sm leading-6 text-textMuted">
                      {result.xai_explanation_points.map((point, index) => (
                        <li key={`${index}-${point}`}>{point}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-yellow-400">{result.xai_limitations}</p>
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <section className="bg-surface/50 rounded-2xl border border-white/10 p-5">
                <h3 className="flex items-center gap-2 text-textMuted mb-5">
                  <Ruler size={17} /> Tumor Size
                </h3>
                {result.physical_size_available ? (
                  <div className="grid grid-cols-2 gap-4">
                    <InfoCard label="2D tumor area" value={`${metric(result.tumor_area_mm2, "", 2)} mm²`} large />
                    <InfoCard label="Equivalent diameter" value={`${metric(result.largest_region_equivalent_diameter_mm, "", 2)} mm`} large />
                  </div>
                ) : (
                  <div className="rounded-xl bg-black/25 p-4">
                    <p className="font-semibold">
                      {metric(result.largest_region_equivalent_diameter_pixels, " pixels", 2)} equivalent diameter
                    </p>
                    <p className="text-xs text-textMuted mt-2">
                      Physical mm/cm size is unavailable because pixel spacing was not supplied. Enter spacing from scan metadata on the upload page.
                    </p>
                  </div>
                )}
                <p className="text-xs text-yellow-400 mt-4">
                  This is a 2D slice measurement, not 3D tumor volume.
                </p>
              </section>

              <section className="bg-surface/50 rounded-2xl border border-white/10 p-5">
                <h3 className="flex items-center gap-2 text-textMuted mb-5">
                  <TrendIcon trend={trend} /> Previous vs Current Scan
                </h3>
                {historyAvailable ? (
                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoCard label={`Previous · ${formatDate(comparison.previous_scan_date)}`} value={`${comparison.previous_tumor_pixels} pixels`} />
                      <InfoCard label={`Current · ${formatDate(comparison.current_scan_date)}`} value={`${comparison.current_tumor_pixels} pixels`} />
                    </div>
                    <p className="mt-4 font-semibold capitalize">
                      Observed trend: <span className="text-primary">{trend}</span> ({comparison.tumor_pixel_change >= 0 ? "+" : ""}{comparison.tumor_pixel_change} pixels)
                    </p>
                    <p className="text-xs text-textMuted mt-3">{comparison.limitations}</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-black/25 p-4">
                    <p className="font-semibold">Baseline scan</p>
                    <p className="text-xs text-textMuted mt-2">
                      Add another dated scan for this patient to calculate observed change.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <section className="mt-6 bg-surface/50 rounded-2xl border border-white/10 p-5">
              <h3 className="flex items-center gap-2 text-textMuted mb-4">
                <MessageCircle size={18} /> Ask LiTwinX XAI Assistant
              </h3>
              <p className="text-xs text-textMuted mb-4">
                Answers are grounded only in this saved segmentation result and its patient history.
              </p>
              <div className="max-h-72 overflow-auto space-y-3 rounded-xl bg-black/20 p-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[90%] rounded-xl px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "ml-auto bg-primary text-white"
                        : "bg-white/5 text-white/90"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
                {isAsking && <p className="text-xs text-textMuted">Checking saved result...</p>}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {["What is the tumor size?", "Why was tumor detected?", "Compare with previous scan", "What is the tumor type?"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => submitQuestion(null, item)}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-textMuted hover:text-white"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <form onSubmit={submitQuestion} className="flex gap-2 mt-4">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question about this result..."
                  maxLength={500}
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || isAsking}
                  className="rounded-xl bg-primary px-4 py-3 disabled:opacity-50"
                  aria-label="Send question"
                >
                  <Send size={18} />
                </button>
              </form>
            </section>

            <div className="mt-6 flex gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              <Shield className="shrink-0 text-yellow-400" size={20} />
              <p>
                Research prototype only. Results are not clinically validated and must not replace a radiologist&apos;s diagnosis. Future-risk prediction and tumor subtype remain unavailable until separately labeled models are trained and validated.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};


function MetricRow({ label, value }) {
  return (
    <div className="border-t border-white/10 pt-4 first:border-0 first:pt-0">
      <p className="text-textMuted">{label}</p>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}


function InfoCard({ label, value, large = false }) {
  return (
    <div className="bg-black/25 rounded-xl p-4">
      <p className="text-xs text-textMuted mb-2">{label}</p>
      <strong className={large ? "text-2xl" : "text-sm"}>{value ?? "—"}</strong>
    </div>
  );
}


export default Dashboard;

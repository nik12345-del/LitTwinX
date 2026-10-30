import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Clock3, UserRoundPlus } from "lucide-react";

import {
  createPatient,
  getPatients,
  isAuthenticated,
} from "../services/api";


const PatientInfo = () => {
  const navigate = useNavigate();
  const [patientData, setPatientData] = useState({
  fullName: "",
  age: "",
  sex: "Male",
});
  const [patients, setPatients] = useState([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/", { replace: true });
      return;
    }

    getPatients()
      .then(setPatients)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoadingPatients(false));
  }, [navigate]);

  const selectPatient = (patient) => {
    localStorage.setItem("selected_patient", JSON.stringify(patient));
    localStorage.removeItem("mri_analysis_result");
    navigate("/mri-upload");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setPatientData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const savedPatient = await createPatient({
      full_name: patientData.fullName.trim(),
      age: Number(patientData.age),
      sex: patientData.sex,
    });
      selectPatient(savedPatient);
    } catch (saveError) {
      setError(
        saveError.status === 409
          ? "This Patient ID already exists. Select the patient from Existing Patients."
          : saveError.message
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 relative overflow-hidden text-white">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />

      <div className="max-w-6xl mx-auto relative z-10 py-8">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black rounded-xl flex justify-center items-center">
              <Activity className="text-primary" size={28} />
            </div>
            <span className="font-extrabold text-3xl tracking-tight">
              Li<span className="text-primary">TwinX</span>
            </span>
          </div>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="bg-surface/80 backdrop-blur-xl p-7 rounded-3xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <Clock3 className="text-primary" size={22} />
              <h2 className="text-2xl font-bold">Existing Patients</h2>
            </div>
            <p className="text-textMuted text-sm mb-5">
              Select a saved patient to analyze another scan or view history.
            </p>

            {isLoadingPatients ? (
              <p className="text-textMuted py-8 text-center">Loading patients...</p>
            ) : patients.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-textMuted">
                No saved patient yet. Create the first patient using the form.
              </div>
            ) : (
              <div className="space-y-3 max-h-[540px] overflow-auto pr-1">
                {patients.map((patient) => (
                  <button
                    type="button"
                    key={patient.id}
                    onClick={() => selectPatient(patient)}
                    className="w-full text-left rounded-xl border border-white/10 bg-black/25 hover:border-primary/60 hover:bg-primary/10 p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{patient.full_name}</p>
                        <p className="text-xs text-textMuted mt-1">
                          {patient.patient_code} · {patient.age} years · {patient.sex}
                        </p>
                      </div>
                      <ArrowRight className="text-primary shrink-0" size={18} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="bg-surface/80 backdrop-blur-xl p-7 rounded-3xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <UserRoundPlus className="text-primary" size={22} />
              <h2 className="text-2xl font-bold">New Patient</h2>
            </div>
            <p className="text-textMuted text-sm mb-6">
              Create this once. Future scans can reuse the same patient record.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm text-textMuted">
                Patient Name
                <input
                  type="text"
                  name="fullName"
                  value={patientData.fullName}
                  onChange={handleChange}
                  className="mt-1 w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:border-primary text-white outline-none"
                  placeholder="e.g. Demo Patient"
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>

              <label className="block text-sm text-textMuted">
                Age
                <input
                  type="number"
                  name="age"
                  value={patientData.age}
                  onChange={handleChange}
                  className="mt-1 w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:border-primary text-white outline-none"
                  min="1"
                  max="120"
                  required
                />
              </label>

              <label className="block text-sm text-textMuted">
                Sex
                <select
                  name="sex"
                  value={patientData.sex}
                  onChange={handleChange}
                  className="mt-1 w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:border-primary text-white outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 bg-primary hover:bg-primaryHover rounded-xl font-semibold disabled:opacity-60"
              >
                {isSaving ? "Saving Patient..." : "Create and Analyze"}
                {!isSaving && <ArrowRight size={18} />}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};


export default PatientInfo;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Activity, ArrowRight } from 'lucide-react';

const PatientInfo = () => {
    const navigate = useNavigate();
    const [patientData, setPatientData] = useState({
        name: '',
        age: '',
        gender: 'Male'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        // optionally store in localStorage or context, for now just pass to next page
        localStorage.setItem('patient_info', JSON.stringify(patientData));
        navigate('/mri-upload');
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]"></div>

            <div className="w-full max-w-md bg-surface/80 backdrop-blur-xl p-10 rounded-3xl border border-white/10 shadow-2xl relative z-10">
                <div className="flex justify-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-black rounded-xl flex justify-center items-center shadow-inner">
                            <Activity className="text-primary" size={28} />
                        </div>
                        <span className="font-extrabold text-3xl tracking-tight text-white">
                            Li<span className="text-primary">TwinX</span>
                        </span>
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Patient Details</h2>
                    <p className="text-textMuted text-sm">Enter patient information to begin</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-textMuted ml-1">Patient Name</label>
                        <input
                            type="text"
                            required
                            value={patientData.name}
                            onChange={(e) => setPatientData({ ...patientData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white outline-none"
                            placeholder="e.g. John Doe"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-textMuted ml-1">Age</label>
                        <input
                            type="number"
                            required
                            min="1"
                            value={patientData.age}
                            onChange={(e) => setPatientData({ ...patientData, age: e.target.value })}
                            className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white outline-none"
                            placeholder="e.g. 45"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-textMuted ml-1">Gender</label>
                        <select
                            value={patientData.gender}
                            onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
                            className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-white outline-none"
                        >
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-primary hover:bg-primaryHover text-white rounded-xl font-semibold transition-all transform hover:-translate-y-0.5"
                    >
                        Start Liver Analysis <ArrowRight size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PatientInfo;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import PatientInfo from './pages/PatientInfo';
import MriUpload from './pages/MriUpload';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/patient-info" element={<PatientInfo />} />
        <Route path="/mri-upload" element={<MriUpload />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Fallbacks */}
       <Route path="/home" element={<PatientInfo />} />
        <Route path="/header" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;

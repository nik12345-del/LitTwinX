const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8003";

const TOKEN_KEY = "litwinx_access_token";


async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...options.headers,
  };

  // FormData ka Content-Type browser automatically set karta hai
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.detail ||
      "Something went wrong. Please try again."
    );

    error.status = response.status;
    throw error;
  }

  return data;
}


export function signup(userData) {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}


export async function login(loginData) {
  const data = await request(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify(loginData),
    }
  );

  localStorage.setItem(
    TOKEN_KEY,
    data.access_token
  );

  return data;
}


export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}


export function getCurrentUser() {
  return request("/api/auth/me");
}


export function createPatient(patientData) {
  return request("/api/patients", {
    method: "POST",
    body: JSON.stringify(patientData),
  });
}


export function getPatients() {
  return request("/api/patients");
}


export function getPatient(patientId) {
  return request(
    `/api/patients/${patientId}`
  );
}


export function analyzeCtImage(file, scanDetails) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("patient_id", String(scanDetails.patientId));
  formData.append("scan_date", scanDetails.scanDate);

  if (scanDetails.pixelSpacingX && scanDetails.pixelSpacingY) {
    formData.append("pixel_spacing_x_mm", scanDetails.pixelSpacingX);
    formData.append("pixel_spacing_y_mm", scanDetails.pixelSpacingY);
  }

  return request("/analyze", {
    method: "POST",
    body: formData,
  });
}


export function getPatientAnalyses(patientId) {
  return request(`/api/patients/${patientId}/analyses`);
}


export function getAnalysis(analysisId) {
  return request(`/api/analyses/${analysisId}`);
}


export function getAnalysisComparison(analysisId) {
  return request(`/api/analyses/${analysisId}/comparison`);
}


export function askAnalysisQuestion(analysisId, question) {
  return request(`/api/analyses/${analysisId}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}


export async function downloadAnalysisReport(analysisId) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(
    `${API_BASE_URL}/api/analyses/${analysisId}/report.pdf`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.detail || "PDF report could not be created.");
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || `LiTwinX-analysis-${analysisId}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


export function isAuthenticated() {
  return Boolean(
    localStorage.getItem(TOKEN_KEY)
  );
}

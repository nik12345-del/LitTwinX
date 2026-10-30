import React, {
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  Upload,
  Activity,
  Shield,
  LogOut,
  Brain,
  BarChart3,
  Eye,
  Target,
} from "lucide-react";

import {
  analyzeCtImage,
  isAuthenticated,
  logout,
} from "../services/api";


const MriUpload = () => {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [imagePreview, setImagePreview] =
    useState(null);

  const [isUploading, setIsUploading] =
    useState(false);

  const [uploadError, setUploadError] =
    useState(null);

  const [uploadProgress, setUploadProgress] =
    useState(0);

  const [analysisResult, setAnalysisResult] =
    useState(null);

  const [showResults, setShowResults] =
    useState(false);

  const [patient, setPatient] = useState(null);
  const [scanDate, setScanDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [pixelSpacingX, setPixelSpacingX] = useState("");
  const [pixelSpacingY, setPixelSpacingY] = useState("");


  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/", { replace: true });
      return;
    }

    try {
      const savedPatient = JSON.parse(
        localStorage.getItem("selected_patient") || "null"
      );
      if (!savedPatient?.id) {
        navigate("/patient-info", { replace: true });
        return;
      }
      setPatient(savedPatient);
    } catch {
      navigate("/patient-info", { replace: true });
    }
  }, [navigate]);


  const handleLogout = () => {
    logout();

    localStorage.removeItem("mri_image");
    localStorage.removeItem(
      "mri_analysis_result"
    );

    navigate("/", { replace: true });
  };


  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const extension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    const allowedExtensions = [
      "png",
      "jpg",
      "jpeg",
    ];

    if (!allowedExtensions.includes(extension)) {
      setUploadError(
        "Only PNG, JPG or JPEG CT images are supported."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError(
        "File size exceeds the 20 MB limit."
      );

      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setAnalysisResult(null);
    setShowResults(false);

    const reader = new FileReader();

    reader.onloadend = () => {
      setImagePreview(reader.result);
    };

    reader.readAsDataURL(file);
  };


  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError(
        "Please select a CT image first."
      );

      return;
    }

    if (!patient?.id) {
      setUploadError("Please select a patient before analyzing a scan.");
      navigate("/patient-info");
      return;
    }

    if ((pixelSpacingX && !pixelSpacingY) || (!pixelSpacingX && pixelSpacingY)) {
      setUploadError("Enter both pixel spacing values or leave both blank.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(20);

    try {
      const response = await analyzeCtImage(selectedFile, {
        patientId: patient.id,
        scanDate,
        pixelSpacingX,
        pixelSpacingY,
      });

      setUploadProgress(90);

      if (
        !response ||
        typeof response.tumor_detected !== "boolean"
      ) {
        throw new Error(
          "Invalid response received from AI server."
        );
      }

      const result = response;



      setAnalysisResult(result);
      setShowResults(true);
      setUploadProgress(100);

      try {
        localStorage.setItem(
          "mri_analysis_result",
          JSON.stringify(result)
        );
      } catch (storageError) {
        console.warn(
          "Result could not be stored:",
          storageError
        );
      }
    } catch (error) {
      console.error(
        "CT analysis failed:",
        error
      );

      if (error.status === 401) {
        setUploadError(
          "Your login session has expired. Please log in again."
        );
      } else if (error.status === 413) {
        setUploadError(
          "File is too large. Maximum size is 20 MB."
        );
      } else if (error.status === 415) {
        setUploadError(
          "Unsupported file. Please upload PNG, JPG or JPEG."
        );
      } else if (error.status === 500) {
        setUploadError(
          `AI inference failed: ${error.message}`
        );
      } else {
        setUploadError(
          error.message ||
          "Unable to connect to the AI server."
        );
      }

      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };


  const handleReset = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setShowResults(false);
    setUploadError(null);
    setUploadProgress(0);

    localStorage.removeItem(
      "mri_analysis_result"
    );
  };


  return (
    <div className="dashboard-container relative flex flex-col pt-16 min-h-screen">
      <nav className="navbar absolute top-0 w-full px-6 py-4 border-b border-white/10 z-50 bg-background/80 backdrop-blur-md flex justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/20 rounded-xl flex justify-center items-center shadow-inner">
            <Activity
              className="text-primary"
              size={20}
            />
          </div>

          <span className="font-extrabold text-2xl tracking-tight text-white">
            Li
            <span className="text-primary">
              TwinX
            </span>
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="text-textMuted hover:text-white flex items-center gap-2 bg-white/5 py-2 px-4 rounded-full border border-white/10"
        >
          <LogOut size={16} />
          <span className="text-sm">
            Logout
          </span>
        </button>
      </nav>


      <main className="flex-1 flex flex-col items-center p-6 relative z-10 w-full mt-10 pb-16">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h1 className="hero-title text-4xl font-bold mb-3">
            Upload Liver CT Scan
          </h1>

          <p className="hero-subtitle text-textMuted">
            Upload one liver CT slice in PNG or
            JPEG format. The trained U-Net model
            will segment the liver and possible
            tumor region.
          </p>
        </div>

        {patient && (
          <div className="w-full max-w-lg mb-4 rounded-2xl border border-white/10 bg-surface/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-textMuted">Selected patient</p>
                <p className="font-semibold">
                  {patient.full_name} · {patient.patient_code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/patient-info")}
                className="text-xs px-3 py-2 rounded-lg border border-white/10 hover:border-primary"
              >
                Change Patient
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <label className="text-xs text-textMuted">
                Scan date
                <input
                  type="date"
                  value={scanDate}
                  onChange={(event) => setScanDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                  required
                />
              </label>
              <label className="text-xs text-textMuted">
                Pixel spacing X (mm)
                <input
                  type="number"
                  min="0.001"
                  max="20"
                  step="0.001"
                  value={pixelSpacingX}
                  onChange={(event) => setPixelSpacingX(event.target.value)}
                  placeholder="optional"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </label>
              <label className="text-xs text-textMuted">
                Pixel spacing Y (mm)
                <input
                  type="number"
                  min="0.001"
                  max="20"
                  step="0.001"
                  value={pixelSpacingY}
                  onChange={(event) => setPixelSpacingY(event.target.value)}
                  placeholder="optional"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </label>
            </div>
            <p className="text-[11px] text-textMuted mt-3">
              Pixel spacing is optional. Enter it only from scan metadata; it enables a 2D mm² estimate.
            </p>
          </div>
        )}


        <div className="w-full max-w-lg bg-surface border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {uploadError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm font-medium">
                {uploadError}
              </p>
            </div>
          )}


          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-12">
              {imagePreview && (
                <div className="relative w-48 h-48 mb-8 rounded-2xl overflow-hidden border border-white/20">
                  <img
                    src={imagePreview}
                    className="w-full h-full object-contain bg-black grayscale opacity-50"
                    alt="Selected CT"
                  />

                  <div className="scanning-line" />
                </div>
              )}

              <Activity
                size={48}
                className="spinning-icon text-primary mb-4"
              />

              <h2 className="text-2xl font-bold mb-2">
                Analyzing CT Image...
              </h2>

              <p className="text-textMuted text-sm text-center mb-6">
                Running the trained LiTwinX
                TensorFlow U-Net model
              </p>

              <div className="w-full max-w-xs bg-black/40 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-red-600 transition-all"
                  style={{
                    width: `${uploadProgress}%`,
                  }}
                />
              </div>

              <p className="text-textMuted text-xs mt-3">
                {uploadProgress}% – Processing
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {imagePreview ? (
                <div className="w-56 h-56 rounded-xl overflow-hidden border border-white/20 mb-6 shadow-xl">
                  <img
                    src={imagePreview}
                    className="w-full h-full object-contain bg-black"
                    alt="Selected CT preview"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-black/40 flex items-center justify-center mb-6 border border-white/5">
                  <Upload
                    size={48}
                    className="text-primary/70"
                  />
                </div>
              )}

              <div className="text-center w-full mb-6">
                <p className="font-semibold text-lg text-white mb-1 truncate px-4">
                  {selectedFile
                    ? selectedFile.name
                    : "Select a Liver CT Image"}
                </p>

                <p className="text-sm text-white/50">
                  PNG, JPG or JPEG — maximum 20 MB
                </p>
              </div>

              <div className="flex gap-4 w-full">
                <input
                  type="file"
                  id="file-upload"
                  hidden
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={handleFileChange}
                />

                <label
                  htmlFor="file-upload"
                  className="flex-1 py-3 text-center bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl text-white font-medium cursor-pointer text-sm"
                >
                  {imagePreview
                    ? "Change File"
                    : "Browse File"}
                </label>

                <button
                  disabled={
                    !selectedFile || isUploading
                  }
                  onClick={handleUpload}
                  className={`flex-1 py-3 bg-primary hover:bg-primaryHover text-white text-sm font-semibold rounded-xl ${!selectedFile
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                    }`}
                >
                  Analyze Image
                </button>
              </div>

              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-white/10 text-xs text-white/40">
                <span className="flex items-center gap-1">
                  <Shield size={12} />
                  Authenticated API
                </span>

                <span className="flex items-center gap-1">
                  <Activity size={12} />
                  TensorFlow U-Net
                </span>
              </div>
            </div>
          )}
        </div>


        {showResults && analysisResult && (
          <div className="w-full max-w-6xl mt-8">
            <div className="bg-surface border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3">
                  <Brain
                    className="text-primary"
                    size={32}
                  />
                  AI Segmentation Results
                </h2>

                <p className="text-textMuted">
                  Real prediction generated by the
                  trained LiTwinX U-Net model and saved to this patient&apos;s history
                </p>
              </div>


              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                  <h3 className="text-center font-semibold mb-3">
                    Original CT
                  </h3>

                  <img
                    src={imagePreview}
                    alt="Original CT"
                    className="w-full h-64 object-contain bg-black rounded-lg"
                  />
                </div>


                <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                  <h3 className="text-center font-semibold mb-3">
                    Segmentation Overlay
                  </h3>

                  <img
                    src={
                      analysisResult.overlay_image
                    }
                    alt="Segmentation overlay"
                    className="w-full h-64 object-contain bg-black rounded-lg"
                  />
                </div>


                <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                  <h3 className="text-center font-semibold mb-3">
                    Predicted Mask
                  </h3>

                  <img
                    src={
                      analysisResult.mask_image
                    }
                    alt="Predicted mask"
                    className="w-full h-64 object-contain bg-black rounded-lg"
                  />
                </div>
              </div>


              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-black/20 rounded-xl p-6 border border-white/10">
                  <h3 className="text-xl font-semibold mb-5 flex items-center gap-2">
                    <Target
                      className="text-primary"
                      size={20}
                    />
                    Tumor Detection
                  </h3>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-textMuted">
                        Tumor detected
                      </span>

                      <span
                        className={
                          analysisResult.tumor_detected
                            ? "text-red-400 font-bold"
                            : "text-green-400 font-bold"
                        }
                      >
                        {analysisResult.tumor_detected
                          ? "Yes"
                          : "No"}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-textMuted">
                        Model confidence
                      </span>

                      <span className="font-medium">
                        {Number(
                          analysisResult.tumor_confidence
                        ).toFixed(1)}
                        %
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-textMuted">
                        Tumor area within liver
                      </span>

                      <span className="font-medium">
                        {Number(
                          analysisResult.tumor_percentage_of_liver
                        ).toFixed(2)}
                        %
                      </span>
                    </div>
                  </div>
                </div>


                <div className="bg-black/20 rounded-xl p-6 border border-white/10">
                  <h3 className="text-xl font-semibold mb-5 flex items-center gap-2">
                    <BarChart3
                      className="text-primary"
                      size={20}
                    />
                    Segmentation Details
                  </h3>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-textMuted">
                        Liver pixels
                      </span>

                      <span className="font-medium">
                        {
                          analysisResult.liver_pixel_count
                        }
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-textMuted">
                        Tumor pixels
                      </span>

                      <span className="font-medium">
                        {
                          analysisResult.tumor_pixel_count
                        }
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-textMuted">
                        Processed resolution
                      </span>

                      <span className="font-medium">
                        {analysisResult.image_width}
                        ×
                        {analysisResult.image_height}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-textMuted">
                        Filename
                      </span>

                      <span className="font-medium truncate ml-4">
                        {analysisResult.filename}
                      </span>
                    </div>
                  </div>
                </div>
              </div>


              <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
                <h3 className="font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                  <Eye size={18} />
                  Model Scope
                </h3>

                <p className="text-sm text-textMuted">
                  This model segments background,
                  liver and tumor regions from one
                  2D CT image. It does not currently
                  determine cancer type or future clinical risk. A 2D physical
                  estimate appears only when valid pixel spacing is supplied;
                  3D volume requires a complete scan series.
                </p>
              </div>


              <div className="flex gap-4 mt-8 justify-center">
                <button
                  onClick={() =>
                    navigate("/dashboard")
                  }
                  className="px-6 py-3 bg-primary hover:bg-primaryHover text-white font-semibold rounded-xl"
                >
                  Open Dashboard
                </button>

                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-black/40 hover:bg-black/60 border border-white/10 text-white font-medium rounded-xl"
                >
                  Analyze Another Image
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};


export default MriUpload;

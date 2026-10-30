# 🏥 LitTwinX – Explainable AI-Powered Liver Cancer Detection

### Progression-Oriented Digital Twin for Liver Cancer Detection with Explainable AI

LitTwinX is an AI-powered medical imaging application designed to assist in liver cancer analysis using CT scan images. It combines deep learning, medical image segmentation, tumor classification, and Explainable AI (XAI) to provide visual and interpretable analysis results.

## 🚀 Key Features

- **Liver and Tumor Segmentation:** Identifies and segments liver and tumor regions from medical images using a U-Net-based deep learning model.
- **Tumor Classification:** Supports classification of different liver tumor categories.
- **Explainable AI:** Provides visual explanations through XAI overlays and tumor probability maps.
- **Uncertainty Visualization:** Generates uncertainty maps to highlight areas where model predictions are less certain.
- **Tumor Analysis:** Displays pixel measurements, tumor percentage, and estimated tumor size when pixel spacing is provided.
- **Patient Management:** Supports patient registration, login, and patient history.
- **Patient History Comparison:** Allows comparison of previous analysis results.
- **PDF Report Generation:** Generates reports containing analysis results.
- **AI Assistant:** Provides answers grounded in the available analysis results.

## 🧠 Deep Learning Models

- U-Net for liver and tumor segmentation.
- Deep learning-based tumor classification.
- Explainable AI visualization techniques.

## 📊 Model Performance

The segmentation model achieved the following evaluation results:

| Metric | Score |
|---|---:|
| Liver Dice Score | 0.9389 |
| Tumor Dice Score | 0.6843 |
| Pixel Accuracy | 0.9918 |
| Loss | 0.4865 |

*These are model evaluation results, not clinical validation results.*

## 🛠️ Technology Stack

**Frontend**
- React.js
- Vite
- JavaScript
- Tailwind CSS

**Backend**
- Python
- FastAPI
- REST APIs
- SQLAlchemy / Database integration

**AI and Machine Learning**
- TensorFlow
- Keras
- U-Net
- Medical Image Processing
- Explainable AI

## 📁 Project Structure

```text
LitTwinX/
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── analysis_service.py
│   │   ├── inference.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── database.py
│   │
│   ├── models/
│   │   └── litwinx_lits_unet.keras
│   │
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/nik12345-del/LitTwinX.git
cd LitTwinX
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
```

Activate the environment on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8003
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local frontend URL displayed by Vite in your browser.

## 🎯 Project Objective

The primary objective of LitTwinX is to combine medical image analysis with explainable deep learning to make liver cancer analysis more interpretable. The system aims to provide visual insights into segmentation, tumor regions, classification, and analysis history through an integrated digital twin application.

## ⚠️ Disclaimer

LitTwinX is an academic research project and is intended for educational and experimental purposes. It is not a clinically validated diagnostic system and should not replace professional medical evaluation.

## 👩‍💻 Developer

**Nikita Dubey**

B.Tech – Artificial Intelligence and Data Science

Yeshwantrao Chavan College of Engineering (YCCE), Nagpur

GitHub: https://github.com/nik12345-del

---

⭐ If you find this project interesting, feel free to explore the repository and share your feedback.
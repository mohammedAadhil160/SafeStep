# 🛡️ SafeStep — AI-Powered Safety Navigation

SafeStep is a real-time personal safety navigation app that uses machine learning and crowdsourced data to score route safety, highlight safe/risky paths, and help users navigate with confidence.

## 📁 Project Structure

```
SafeStep/
├── backend/          # FastAPI + PostgreSQL/PostGIS + Scikit-Learn
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── database.py
│   │   ├── ai/
│   │   │   └── safety_engine.py
│   │   └── routers/
│   │       ├── analyze.py
│   │       ├── reports.py
│   │       └── routes.py
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── mobile/           # React Native App
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/
│   │   └── utils/
│   ├── App.js
│   └── package.json
│
└── docker-compose.yml
```

## 🚀 Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Mobile
```bash
cd mobile
npm install
npx react-native run-android  # or run-ios
```

### Full Stack (Docker)
```bash
docker-compose up --build
```

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Get safety score for coordinates |
| GET | `/routes/safe` | Get safe route between two points |
| POST | `/reports` | Submit user safety report |
| GET | `/incidents/nearby` | Get nearby incidents |
| GET | `/health` | Health check |

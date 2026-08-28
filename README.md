# VendorCRM with AI Sentiment Analysis

A full-stack CRM system that combines vendor, lead, and sales pipeline management with AI-driven sentiment analysis of customer feedback.

**Live Demo:** https://epics-pied.vercel.app/

## Features

- **Vendor & Lead Management** – track vendors and leads with a visual sales pipeline
- **AI Sentiment Analysis** – automatically classifies customer feedback as positive, negative, or neutral using a fine-tuned BERTweet (RoBERTa) transformer model
- **Model Comparison** – compares predictions between BERTweet and RoBERTa models with confidence scores and batch support
- **Analytics Dashboard** – interactive charts (Chart.js) for sales and sentiment trends
- **Secure Authentication** – user signup and login
- **Email Notifications** – automated vendor-approval emails via SendGrid

## Tech Stack

**Frontend:** React, Vite, Chart.js, react-chartjs-2, react-router-dom
**Backend:** Python, FastAPI, PyTorch, Hugging Face Transformers, Uvicorn
**Database:** Supabase (PostgreSQL)
**Testing:** Playwright (e2e), Vitest
**Deployment:** Vercel, Render

## Project Structure

```
├── frontend/    # React + Vite frontend
├── backend/     # FastAPI sentiment analysis API
├── models/      # BERTweet & RoBERTa transformer models
├── supabase/    # Database schema/config
└── vercel.json  # Deployment rewrites
```

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
```

## Testing

```bash
cd frontend
npm test          # unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright)
```

## Deployment

- Frontend: https://epics-pied.vercel.app/
- Backend API: hosted on Render

# ShopEase AI Customer Support Agent

A full-stack web application that uses an LLM-powered agent to process or deny e-commerce refund requests. The agent dynamically calls tools to validate customers against a strict refund policy, with real-time reasoning logs visible in an admin dashboard.

![Stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

## Features

- **AI Agent Backend** — LangGraph agent loop with GPT-4o-mini that dynamically calls 7 tools to validate refund policy rules
- **Mock CRM Database** — 15 customer profiles with orders, tiers, and refund history
- **Strict Refund Policy** — Documented rules for return windows, category limits, final sale items, digital products, and annual refund caps
- **Customer Chat UI** — Clean chat interface with text and voice input (Web Speech API)
- **Admin Dashboard** — Real-time agent reasoning logs via WebSocket (tool calls, policy checks, decisions)
- **Test Scenarios** — One-click buttons to demo approve/deny flows

## Architecture

```
┌─────────────────┐     REST/WS      ┌──────────────────────────────┐
│  React Frontend │ ◄──────────────► │  FastAPI Backend             │
│  - Chat + Voice │                  │  - LangGraph Agent Loop      │
│  - Admin Logs   │                  │  - 7 Policy Validation Tools │
└─────────────────┘                  │  - WebSocket Log Broadcaster │
                                     └──────────┬───────────────────┘
                                                │
                                     ┌──────────▼───────────────────┐
                                     │  Mock Data                     │
                                     │  - crm_profiles.json (15)      │
                                     │  - refund_policy.md            │
                                     └────────────────────────────────┘
```

### Agent Tools

| Tool | Purpose |
|------|---------|
| `tool_lookup_customer` | Find customer by email, name, or order ID |
| `tool_get_order_details` | Retrieve order items, status, delivery date |
| `tool_get_refund_history` | Check annual refund count (max 3/year) |
| `tool_check_refund_eligibility` | Run all policy checks (window, category, final sale, etc.) |
| `tool_process_refund` | Approve and issue refund reference number |
| `tool_deny_refund` | Deny with documented policy reason |
| `tool_get_refund_policy` | Read the full policy document |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY

uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Open the App

- **Customer Chat:** [http://localhost:5173](http://localhost:5173)
- **Admin Dashboard:** [http://localhost:5173/admin](http://localhost:5173/admin)
- **API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

## Usage

### Customer Chat

1. Open the Customer Chat page
2. Type or use the microphone button to speak your refund request
3. Provide your email or order ID, the item SKU, and reason for return
4. The agent will look up your account, validate policy rules, and approve or deny

### Test Scenarios

Click any scenario button on the right panel to auto-fill a refund request:

| Scenario | Expected Result |
|----------|----------------|
| Eligible refund (Sarah Mitchell) | **Approved** — within return window, standard item |
| Refund limit reached (James Rodriguez) | **Denied** — 3 refunds already used this year |
| Final sale item (Michael Thompson) | **Denied** — item marked final sale |
| Digital product (Christopher Lee) | **Denied** — digital products non-refundable |
| Undelivered order (Amanda Foster) | **Denied** — order not yet delivered |

### Admin Dashboard

Open the Admin Dashboard to watch real-time logs as the agent works:

- **User Message** — incoming customer text
- **Agent Reasoning** — LLM thought process
- **Tool Call** — which tool was invoked with what arguments
- **Tool Result** — policy check results and CRM data

## Refund Policy Summary

| Rule | Details |
|------|---------|
| Return window | Standard: 30d, Gold: 45d, Platinum: 60d |
| Electronics | 14-day window (overrides tier) |
| Digital products | Non-refundable |
| Final sale items | Non-refundable |
| Annual limit | Max 3 refunds per customer per year |
| Order status | Must be "delivered" |

Full policy: `backend/data/refund_policy.md`

## CRM Test Data

15 customer profiles in `backend/data/crm_profiles.json`. Sample customers:

| Name | Email | Tier | Refunds This Year |
|------|-------|------|-------------------|
| Sarah Mitchell | sarah.mitchell@email.com | Gold | 1 |
| James Rodriguez | j.rodriguez@email.com | Standard | 3 |
| Emily Chen | emily.chen@email.com | Platinum | 0 |
| Michael Thompson | mthompson@email.com | Standard | 0 |
| Christopher Lee | c.lee@email.com | Gold | 0 |

## Project Structure

```
AI_Customer_Support_Agent/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + routes
│   │   ├── crm.py               # CRM data access + policy logic
│   │   ├── websocket.py         # Real-time log broadcaster
│   │   └── agent/
│   │       ├── graph.py         # LangGraph agent loop
│   │       ├── tools.py         # LangChain tool definitions
│   │       └── prompts.py       # System prompt
│   ├── data/
│   │   ├── crm_profiles.json    # 15 mock customer profiles
│   │   └── refund_policy.md     # Strict refund policy
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/          # Chat, Voice, Log panel
│   │   ├── pages/               # Chat + Admin pages
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/customers` | List CRM profiles |
| POST | `/api/chat` | Send message to agent |
| WS | `/ws/logs` | Real-time reasoning logs |

## Tech Stack

- **Backend:** Python, FastAPI, LangGraph, LangChain, OpenAI GPT-4o-mini
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Real-time:** WebSocket for admin log streaming
- **Voice:** Web Speech API (browser-native, no extra API key needed)

## License

MIT

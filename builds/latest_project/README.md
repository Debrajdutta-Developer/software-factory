# ContractPulse — Enterprise API Contract Studio & Intelligent Mock Engine

> **Problem Statement:** Modern microservice and frontend/backend engineering teams face frequent API specification drift, unexpected breaking changes in production, high setup overhead for realistic mock servers, and complex multi-step integration testing bottlenecks. Traditional tools are either overly heavyweight, require remote cloud setups, or fail to catch breaking schema diffs early in the local development lifecycle.

**ContractPulse** is a 100% client-side, local-first API contract management suite, interactive spec auditor, dynamic mock engine, and multi-step sequence visualizer designed for enterprise software teams.

---

## 🌟 Key Features

1. **OpenAPI 3.0/3.1 & Schema Inspector**
   - Browse endpoints, request payloads, header requirements, and nested schemas.
   - Pre-loaded enterprise templates (Stripe-like Payment API, E-Commerce Microservices, Patient Healthcare Records API).
   - In-browser interactive sandbox to simulate real API calls against dynamic mock engines.

2. **Automated Breaking Change & Contract Diff Engine**
   - Compare two versions of API specifications (Version A vs Version B).
   - Instant categorization of schema diffs:
     - 🔴 **Breaking Changes** (Removed endpoints, type mutations, added required parameters).
     - 🟡 **Deprecations & Warnings** (Deprecated endpoints, field soft-deletions).
     - 🟢 **Non-Breaking Additions** (New endpoints, optional query params, added response fields).

3. **Dynamic In-Browser Mock Server & Traffic Controller**
   - Live Fetch intercept simulation with configurable:
     - Artificial Network Latency (0ms to 5000ms jitter).
     - Simulated Failure Rates (0% to 100% random 500 Internal Error / 429 Rate Limit responses).
     - Dynamic Payload Generation (UUIDs, ISO Timestamps, Random Emails, Currencies, Hashes).
     - Status code overrides (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Error).

4. **Multi-Step Workflow Sequence Pipeline Simulator**
   - Visually model and execute complex API sequences (e.g., `POST /auth/token` ➡️ `POST /customers` ➡️ `POST /payments/charge`).
   - Automated context extraction: dynamically extract fields from step responses (e.g., `{{auth.token}}`) and pass them into subsequent request headers/bodies.
   - Real-time step execution visualization with time-to-first-byte metrics and assertion status.

5. **Contract Compliance & Assertion Test Suite**
   - Run automated validation rules against active schemas.
   - Generates instant pass/fail audit reports exportable for CI/CD documentation.

6. **Local-First & Zero Lock-in Export Options**
   - Export mock configurations, spec diff reports, postman-compatible collections, and project states directly as JSON/Markdown files.

---

## 🏗️ Architecture & Technical Design

ContractPulse is built as a zero-dependency, high-performance Web Application leveraging pure ES6 JavaScript, HTML5, and custom reactive state architecture.

```
       ┌────────────────────────────────────────────────────────┐
       │                   ContractPulse UI                     │
       │  (Workspace | Spec Diff | Mock Engine | Flow Simulator) │
       └───────────────────────────┬────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
     │  Spec Parse &   │  │ Contract Diff & │  │ Workflow Engine │
     │ Dynamic Engine  │  │ Audit Analyzer  │  │ & State Mapper  │
     └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │             In-Browser Synthetic Network               │
       │     (Latency Injector, Chaos Engine, Dynamic Mock)     │
       └────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

1. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari). No `npm install`, node runtime, or server backend required!
2. **Explore Pre-loaded APIs:** Click "Load Sample" in the top bar to toggle between Payment, E-Commerce, or Healthcare specs.
3. **Execute Requests:** Select an endpoint in the Workspace tab, adjust params or JSON body, and click **Send Request**.
4. **Audit Spec Diff:** Switch to the **Spec Diff Auditor** tab, select Version 1.0 vs 2.0, and review automatically highlighted breaking changes.
5. **Run Workflow Pipelines:** Switch to the **Workflow Simulator** tab and hit **Execute Sequence** to watch dynamic multi-step token propagation in real-time.

---

## 💻 Keyboard Shortcuts

- `Ctrl / Cmd + Enter` : Send Request in active endpoint sandbox.
- `Alt + 1` : Switch to Spec Workspace.
- `Alt + 2` : Switch to Spec Diff Auditor.
- `Alt + 3` : Switch to Workflow Simulator.
- `Alt + 4` : Switch to Dynamic Mock Configurator.

---

## 🔒 Privacy & Security

ContractPulse executes 100% of data parsing, mock generation, and schema diffing inside your web browser's local sandbox memory. No payloads, API specs, or keys are ever sent to external cloud servers.
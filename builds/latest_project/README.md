# APIForge Studio — Autonomous Micro-SaaS API Designer, Stateful Mock Engine & SDK Synthesizer

> **Problem Solved:** Frontend developers, mobile engineers, and product managers often face severe productivity bottlenecks waiting for backend APIs to be designed, deployed, or stabilized. Existing solutions either require complex backend setups, paid cloud services, or produce static mock data without state persistence or client SDK generation.

**APIForge Studio** is a browser-native, zero-dependency workspace that enables developers to design RESTful API contracts, run stateful synthetic mock servers with low-latency dynamic dynamic routing directly in browser memory, fuzz dynamic test data, and synthesize client SDKs (TypeScript, Python, Go, JavaScript, Curl) alongside valid OpenAPI 3.0 specs in real-time.

---

## 🌟 Key Features

1. **Visual Endpoint & Schema Designer**:
   - Support for `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` methods.
   - Dynamic route params (e.g. `/api/v1/users/:id`).
   - Smart dynamic templates (`{{uuid}}`, `{{name}}`, `{{email}}`, `{{company}}`, `{{date}}`, `{{price}}`, `{{req.params.id}}`).

2. **Stateful In-Browser Mock Engine**:
   - Persistent virtual database backed by LocalStorage & IndexedDB semantics.
   - Instant CRUD logic automatically executed for endpoints (`POST` creates items, `PUT` updates, `DELETE` removes, `GET` reads).
   - Configurable latency simulation (0ms to 3000ms) and random error injection (0% to 50% fault rate).

3. **Multi-Language SDK & Client Synthesizer**:
   - Instant code generation for:
     - **TypeScript** (Strongly typed Async Client with interfaces)
     - **JavaScript** (Fetch & Axios variants)
     - **Python** (`requests` & `httpx` with `dataclasses`)
     - **Go** (`net/http` client structs)
     - **cURL** command line calls
   - Full **OpenAPI 3.0 Spec Synthesizer** (JSON export).

4. **Synthetic Data Fuzzer & Generator**:
   - Pre-built dataset templates: E-Commerce, SaaS User Directory, Financial Ledger, IoT Sensor Metrics, Task Tracker.
   - Export synthetic data sets in JSON, CSV, and SQL `INSERT` formats.

5. **Interactive API Sandbox & Request Inspector**:
   - Native HTTP runner for both internal dynamic dynamic dynamic mock routes and real external CORS-enabled APIs.
   - Request history, execution latency charts, HTTP response status indicators, and headers viewer.

6. **Zero-Touch Local Workspace Engine**:
   - 100% Client-Side. No login required, zero server deployments, local JSON import/export project workspace.

---

## 🛠 Project Architecture

```
APIForge Studio
├── index.html        # Single Page Application structure with tabbed workspace UI
├── style.css         # Production CSS design system (Dark mode studio theme, responsive design)
└── app.js            # Core App Engine:
                      #   ├── Data Generator / Templating Engine
                      #   ├── Stateful Mock DB & Route Resolver
                      #   ├── HTTP Request Sandbox Execution Core
                      #   ├── SDK Code Synthesizers (TS, Python, Go, Curl)
                      #   └── Project Import/Export Manager
```

---

## 🚀 Getting Started

1. Open `index.html` in any modern web browser.
2. Explore the pre-loaded **PulseMetrics SaaS API** or create your own custom endpoints.
3. Switch to the **API Tester Sandbox** to execute mock requests with real state persistence.
4. Open **SDK Synthesizer** to generate ready-to-use client libraries for your project.
5. Export your OpenAPI 3.0 specification or backup your workspace JSON at any time.

---

## 💻 Tech Stack
- **Frontend Core:** Standard HTML5, CSS Variables, Native JavaScript ES6+
- **Icons:** Embedded Inline SVG System (Lucide style)
- **Data Engine:** Web Storage API, Synthetic AST Evaluator
- **Dependencies:** None (0 external CDN scripts, pure standalone application)
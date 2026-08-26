# PayloadRelay - Local-First API & Webhook Studio

> **Zero-Telemetry, Offline-First API Sandbox, Webhook Inspector, JSON Schema Engine & Synthetic Payload Synthesizer.**

![PayloadRelay Interface](https://img.shields.io/badge/Security-100%25%20Local%20%26%20Zero--Telemetry-emerald?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## 💡 The Problem

Modern software teams face significant friction and privacy risks when developing, testing, and debugging APIs:
1. **Data Leakage & Privacy Violations**: Popular online tools like Postman, Webhook.site, and JSON formatters transmit authorization tokens, PII, production secrets, and customer data to third-party cloud servers.
2. **Context Switching & Tool Fragmentation**: Developers juggle separate tools for sending requests, converting JSON to TypeScript/Zod types, decoding JWTs, generating mock datasets, and inspecting headers.
3. **Flaky Mocking Environments**: Backend endpoints under development are often incomplete or unreliable, blocking frontend development and end-to-end automated testing.
4. **Payload Validation Overhead**: Manually creating JSON Schemas or Pydantic/Zod validation models from raw API payloads is tedious and prone to human error.

---

## 🚀 The Solution: PayloadRelay

**PayloadRelay** is an all-in-one, 100% client-side web application designed for high-velocity software engineering. It operates entirely in the browser with **zero external server dependencies, zero telemetry, and complete offline availability**.

### Core Capabilities

- 📡 **API Request Builder & Virtual Network Interceptor**:
  - Dispatch real HTTP requests (`fetch`) or simulate mock local responses with custom latency and status codes.
  - Auto-parse cURL commands into structured requests.
  - Export code snippets instantly to `JavaScript fetch`, `Python requests`, `cURL`, and `Go net/http`.

- ⚡ **Payload Studio & Multi-Format Schema Synthesizer**:
  - Paste raw JSON and instantly infer standard **JSON Schema (Draft-07)**.
  - Auto-generate strongly typed schemas: **TypeScript Interfaces**, **Zod Validation Schemas**, **Python Pydantic Models**, and **Rust Structs**.
  - Built-in strict JSON syntax validation, formatting, and minify engine.

- 🎲 **Synthetic Data Generator Engine**:
  - Synthesize up to 500 structured mock JSON or CSV records on demand.
  - Pre-built industry templates: *E-Commerce Orders*, *SaaS User Profiles*, *Financial Transactions*, *IoT Sensor Streams*, and *API Security Logs*.
  - Flexible schema builder: UUIDv4, ISO Timestamps, Emails, Names, Currency, Coordinates, Custom Enums, and Numerical Ranges.

- 🔑 **JWT & Security Header Inspector**:
  - Decode and inspect JWT Headers, Payloads, and Expiration claims locally.
  - Calculate claim expiration status (`exp`, `iat`, `nbf`) with real-time countdowns.
  - Evaluate response security headers against modern web defense standards (CORS, CSP, HSTS, X-Content-Type-Options).

- 💾 **IndexedDB Local Storage**:
  - High-performance local persistence for request history, custom schemas, and saved environment collections.
  - Quick search, filtering, tags, and one-click JSON collection import/export.

---

## 🏗 Architecture & Tech Stack

PayloadRelay is built with standard Web API standards for maximum compatibility and performance:

```
+-----------------------------------------------------------------------+
|                       Browser Client Layer                           |
|                                                                       |
|  +---------------------+  +--------------------+  +----------------+  |
|  | Request Builder     |  | Payload Studio     |  | Synthetic      |  |
|  | & cURL Converter    |  | & Schema Engine    |  | Data Generator |  |
|  +----------+----------+  +---------+----------+  +-------+--------+  |
|             |                       |                     |           |
|  +----------v-----------------------v---------------------v--------+  |
|  |                     PayloadRelay Core Engine                    |  |
|  |  - Virtual HTTP Dispatcher     - Code Generator (TS/Zod/Py/Rust)  |  |
|  |  - JWT Decoder Engine          - Rule-Based Mock Synthesizer      |  |
|  +----------------------------------+------------------------------+  |
|                                     |                                 |
|  +----------------------------------v------------------------------+  |
|  |               Persistence Layer (IndexedDB / WebStorage)        |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

- **Frontend**: HTML5, Modern Modular CSS (Variables, Flexbox, CSS Grid), Vanilla JavaScript (ES2023+).
- **Storage Engine**: Browser `IndexedDB` API with `localStorage` fallback.
- **Dependencies**: **Zero** external libraries, zero CDN calls, zero node_modules required for execution.

---

## 🛠 Quick Start

1. Download or clone this repository.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge, Brave).
3. No build step, node runtime, or server required!

### Offline PWA Installation
Double click `index.html` or host via any static web server (e.g., `python -m http.server 8000` or GitHub Pages).

---

## 📖 Usage Guide

### 1. Request Builder & cURL Import
- Paste a cURL command into the input modal or click **Import cURL**.
- Modify headers, auth bearer tokens, or query parameters.
- Toggle between **Real HTTP** execution or **Virtual Mock Response** mode to test offline user experiences.

### 2. Payload Studio (Type & Schema Generation)
- Navigate to the **Payload Studio** tab.
- Paste any JSON object or array into the source input.
- Click **Infer Schema** to view generated **JSON Schema**, **TypeScript**, **Zod**, **Python Pydantic**, or **Rust Structs**.
- Download or copy the code directly into your code repository.

### 3. Synthetic Data Synthesizer
- Navigate to **Data Synthesizer**.
- Select a preset (e.g., *E-Commerce Orders*) or add custom field definitions.
- Set the desired record count (e.g., `50`).
- Click **Generate Synthetic Data** and export as `.json` or `.csv`.

### 4. JWT & Security Analysis
- Navigate to **JWT & Header Inspector**.
- Paste an encoded JWT string to view decoded header JSON, payload claims, and token expiration analysis.
- Inspect incoming HTTP headers for standard security practices.

---

## 🔒 Security & Privacy Guarantee

- **Zero Network Transmission**: PayloadRelay does NOT send telemetry, logs, or analytics to any backend server.
- **Local Key Storage**: API tokens and JWTs remain isolated inside your browser's local sandbox environment.
- **Compliance Ready**: Suitable for enterprise environments bound by HIPAA, GDPR, SOC2, and strict data privacy regulations.

---

## 📄 License
Released under the [MIT License](LICENSE).
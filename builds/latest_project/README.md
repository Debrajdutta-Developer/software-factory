# CloudCraft Studio - Autonomous Cloud Architecture, Cost & Security Risk Synthesizer

## Overview
**CloudCraft Studio** is a client-side cloud architecture modeling engine, security auditor, and Infrastructure-as-Code (IaC) synthesizer. It allows developers, DevOps engineers, and cloud architects to visually design cloud topologies (AWS/GCP/Azure concepts), perform real-time cost estimation, run automated security and reliability audits, and instantly synthesize valid Terraform HCL code.

## The Pain Point
Designing cloud infrastructure often suffers from fragmented workflows:
1. **Diagramming tools (e.g., Lucidchart/Draw.io)** produce static images that drift from reality and lack cost/security logic.
2. **Cost estimation (e.g., AWS Calculator)** is disconnected from architectural visual topologies.
3. **Security static analysis (e.g., Checkov, tfsec)** occurs late in the DevOps pipeline after infrastructure code is written.
4. **Writing IaC manually** is repetitive and prone to syntax or misconfiguration errors.

CloudCraft Studio solves this by unifying **Visual Canvas Modeling**, **Real-Time Cost Calculations**, **Architectural Security & Reliability Auditing**, and **Bi-directional Terraform IaC Generation** into a single client-side application.

---

## Key Features

### 1. Interactive Topology Canvas
- Visual node placement with smart snap grid.
- Vector-based connection wiring with curve routing.
- Node categories: Compute (EC2/VM, Lambda), Storage (S3/Bucket, EFS), Database (RDS, DynamoDB, Redis), Networking (VPC, Gateway, CDN, Load Balancer), Security (WAF, IAM, KMS), Containers (Kubernetes Cluster).

### 2. Real-Time Cost Estimation Engine
- Calculates monthly infrastructure costs dynamically based on node properties (instances, storage size, requests/sec, throughput, high availability multi-AZ toggles).
- Detailed itemized cost breakdowns and visual cost metrics.

### 3. Automated Security & Reliability Audit Engine
- Evaluates active topologies against cloud best practices (CIS Benchmarks, AWS Well-Architected Framework).
- Identifies critical misconfigurations:
  - Database directly exposed to Public Internet Gateways without Subnet/WAF insulation.
  - Storage buckets lacking KMS encryption or versioning.
  - Single Points of Failure (SPOF) - database or compute instances without High Availability or Auto-Scaling.
  - Missing CDN/WAF on edge-facing load balancers.
- **1-Click Auto-Fix**: Automatically resolves architectural risks (e.g., applies encryption, inserts firewalls/subnets).

### 4. SLA & Availability Multiplier Engine
- Computes aggregated availability SLAs based on series and parallel component dependencies (e.g., `99.9% x 99.95% = 99.85%` uptime).

### 5. Production-Ready Terraform HCL Exporter
- Synthesizes fully formatted, deployable Terraform code (`main.tf`) matching the designed visual canvas.
- Includes provider configurations, resource declarations, VPC associations, and security groups.

### 6. Architecture Templates & State Export
- Pre-loaded enterprise templates:
  - Scalable High-Availability 3-Tier Web Application
  - Event-Driven Serverless Microservices Pipeline
  - Enterprise Kubernetes (EKS) Microservices Stack
  - Big Data & Analytics Lake
- Export/Import workspace JSON files and download comprehensive Architecture PDF/PNG audit reports.

---

## Technical Architecture
- **Language**: Pure Vanilla JavaScript (ES6+), HTML5 Canvas/SVG, CSS3 (Modern Flexbox/Grid UI).
- **Dependencies**: Zero external npm packages or CDNs required. Lightweight, offline-capable, and ultra-fast.
- **State Management**: Reactive State Store driving canvas UI, security engine, cost calculator, and IaC parser simultaneously.

---

## How to Run
1. Clone or download the repository.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).
3. Start designing cloud architectures, loading templates, and exporting Terraform manifests immediately.
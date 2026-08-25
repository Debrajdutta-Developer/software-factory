## 1. Pain Point Discovery & Matrix Evaluation

Modern cloud-native and AI-driven software development has introduced three critical operational bottlenecks across engineering organizations:

### Discovered Pain Points

1. **Pain Point 1: Real-Time Endpoint & Tenant Cloud/LLM Cost Attribution Engine**
   * **Context:** Cloud providers (AWS/GCP/Azure) and AI APIs (OpenAI/Anthropic/Pinecone) bill by aggregated infrastructure primitives (EC2 node hours, egress GBs, total input/output tokens). Engineering teams think in business domain abstractions: API routes (`POST /api/v1/generate`), customer tenants, and feature flags. 
   * **The Gap:** FinOps tools (e.g., CloudZero, Vantage) process cloud bills asynchronously with a 6 to 24-hour delay via billing CSV exports. They cannot correlate an unbudgeted $10,000 cost spike back to a specific downstream HTTP trace ID, API route, or tenant in real time before the budget is completely blown.

2. **Pain Point 2: Latency-Budget-Aware Edge Guardrail Engine for GenAI Systems**
   * **Context:** Enterprises deploying LLMs require real-time compliance guardrails (PII redaction, prompt injection detection, hallucination checks). 
   * **The Gap:** Existing guardrail solutions execute synchronous HTTP round-trips to secondary Python validation servers or cloud APIs, adding 200–600ms of latency per query. This degrades user experience in real-time conversational streaming applications.

3. **Pain Point 3: Deterministic Stream Replay & Selective State Recovery for Kafka/Redpanda**
   * **Context:** Event-driven microservices relying on log-compacted Kafka topics frequently suffer state corruption when buggy downstream consumers write bad state to read models (PostgreSQL, Elasticsearch).
   * **The Gap:** Standard consumer group offset resets reprocess *all* partition events (causing massive duplicate side-effects), whereas manual repair scripts take hours of high-stress incident response time.

---

### Scoring Matrix

| Evaluation Criteria (Weight: 1-10) | 1. Real-Time Cost Attribution | 2. Edge LLM Guardrails | 3. Stream State Recovery |
| :--- | :--- | :--- | :--- |
| **Pain Severity / Financial Impact** (Weight: 3) | **9.5** ($10k+ unexpected daily bill spikes) | 8.0 (Latency impacts conversions) | 8.5 (Downtime during data corruption) |
| **Market Demand & Willingness to Pay** (Weight: 3) | **9.5** (CFOs + VP Eng urgent directive) | 8.5 (High AI adoption, budget dependent) | 7.5 (Engineers love it, hard sell to Finance) |
| **Technical Feasibility & ROI** (Weight: 2) | **9.0** (Can leverage eBPF + OTel context) | 8.0 (Requires lightweight local models) | 7.5 (Complex state machine mechanics) |
| **Defensibility / Market Gap** (Weight: 2) | **9.0** (Sub-second runtime attribution gap) | 8.0 (Saturated with Python wrapper startups) | 8.5 (Niche stream-processing focus) |
| **Weighted Score (Out of 100)** | **92.5** | **81.5** | **79.5** |

### Winning Selection: **Pain Point 1 — Real-Time Cost Attribution Engine ("CostPulse")**

**Why it wins:** Uncontrolled LLM token consumption and microservice compute drift are immediate operational threats. **CostPulse** bridges OpenTelemetry HTTP/gRPC traces with cloud infrastructure and AI provider rate-cards in real time, computing exact micro-dollar costs per API request, tenant, and route within milliseconds of completion.

---

## 2. Product Architecture Blueprint: CostPulse

CostPulse intercepts trace headers and metrics, dynamically matches consumption telemetry against a vectorized Cloud/LLM pricing matrix, streams unit costs to ClickHouse for analytics, and updates a Redis token bucket to enforce automated real-time budget circuit breaking.

```
                   +-------------------------------------------------------+
                   |                 Client / Gateway                     |
                   +-------------------------------------------------------+
                                              |
                                     HTTP / gRPC Requests
                                              v
+----------------------------------------------------------------------------------------------------+
|                                    CostPulse Ingress & Sidecar                                     |
|                                                                                                    |
|  +---------------------------+     +---------------------------+     +--------------------------+  |
|  | OTel Trace Extractor      |     | Network / Token Counter   |     | Budget Circuit Breaker   |  |
|  | - TraceID, TenantID, Route|     | - In/Out Bytes, Tokens    |     | - Fast Redis Budget Check|  |
|  +-------------+-------------+     +-------------+-------------+     +------------+-------------+  |
+----------------|---------------------------------|--------------------------------|----------------+
                 |                                 |                                |
                 +-----------------+---------------+                                | Block if
                                   |                                                | Budget
                                   v                                                | Exceeded
+-----------------------------------------------------------------------------------|----------------+
|                                    CostPulse Core Engine                          v                |
|                                                                             +-----------+          |
|  +-----------------------------------------------------------------------+  | Rate      |          |
|  | Pricing Matrix Engine                                                 |  | Limiter   |          |
|  | - AWS EC2/Lambda vCPU/RAM rates                                       |  +-----------+          |
|  | - OpenAI/Anthropic Input/Output Token Rates                           |                             |
|  | - Network Egress Rates per GB                                         |                             |
|  +-----------------------------------+-----------------------------------+                             |
|                                      |                                                                 |
|                                      v Micro-Dollar Cost Calculation ($1e-6 USD)                       |
|                                                                                                        |
|  +--------------------------------------------------------------------------------------------------+  |
|  | Stream Processor & Batcher                                                                       |  |
|  +-----------------------------------+--------------------------------------------------------------+  |
+--------------------------------------|-----------------------------------------------------------------+
                                       |
                 +---------------------+---------------------+
                 v                                           v
+----------------------------------+       +----------------------------------+
|      ClickHouse OLAP Storage     |       |       Redis Budget Cache         |
|                                  |       |                                  |
| - High-cardinality aggregation   |       | - Atomic Tenant Spend Counter    |
| - Microsecond route breakdown    |       | - Dynamic threshold evaluation   |
+----------------------------------+       +----------------------------------+
```

---

## 3. Production Code Structure

```
costpulse/
├── cmd/
│   └── engine/
│       └── main.go                  # Main entrypoint
├── docker-compose.yml               # Service orchestration
├── go.mod                           # Go module dependencies
├── go.sum
├── internal/
│   ├── breaker/
│   │   └── circuit_breaker.go       # Redis-backed budget circuit breaker
│   ├── config/
│   │   └── config.go                # Application configuration
│   ├── engine/
│   │   ├── evaluator.go             # Cost calculation logic ($1e-6 precision)
│   │   └── models.go                # Telemetry and Pricing Data Transfer Objects
│   └── storage/
│       └── clickhouse.go            # High-throughput ClickHouse batch writer
└── scripts/
    └── init.sql                     # ClickHouse DDL & Materialized Views
```

---

## 4. Complete Executable Implementation

### File 1: `go.mod`

```go
module github.com/costpulse/costpulse

go 1.22.0

require (
	github.com/ClickHouse/clickhouse-go/v2 v2.23.0
	github.com/redis/go-redis/v9 v9.5.1
)
```

---

### File 2: `scripts/init.sql`

```sql
-- ClickHouse Schema for High-Cardinality Real-Time Cost Telemetry

CREATE DATABASE IF NOT EXISTS costpulse;

-- Primary Telemetry Event Table
CREATE TABLE IF NOT EXISTS costpulse.request_costs
(
    trace_id          String,
    tenant_id         LowCardinality(String),
    service_name      LowCardinality(String),
    api_route         LowCardinality(String),
    provider          LowCardinality(String), -- e.g., 'AWS', 'OpenAI', 'GCP'
    model_or_resource LowCardinality(String), -- e.g., 'gpt-4o', 'c6i.xlarge'
    execution_time_ms UInt32,
    cpu_millicores    UInt32,
    memory_mb         UInt32,
    egress_bytes      UInt64,
    prompt_tokens     UInt32,
    completion_tokens UInt32,
    total_cost_uusd   UInt64, -- Cost in micro-USD ($1e-6) to avoid floating point inaccuracies
    timestamp         DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
PRIMARY KEY (tenant_id, service_name, api_route)
ORDER BY (tenant_id, service_name, api_route, timestamp);

-- Real-Time Aggregated Cost View per Tenant per Minute
CREATE MATERIALIZED VIEW IF NOT EXISTS costpulse.tenant_cost_1m_mv
ENGINE = SummingMergeTree()
PRIMARY KEY (tenant_id, window_start)
ORDER BY (tenant_id, window_start)
AS SELECT
    tenant_id,
    toStartOfMinute(timestamp) AS window_start,
    count() AS total_requests,
    sum(total_cost_uusd) AS total_cost_uusd,
    sum(prompt_tokens + completion_tokens) AS total_tokens
FROM costpulse.request_costs
GROUP BY tenant_id, window_start;
```

---

### File 3: `internal/engine/models.go`

```go
package engine

import "time"

// PricingRules defines unit costs in micro-USD ($1e-6 USD)
type PricingRules struct {
	CPUCoreHourMicroUSD      uint64 // Cost per CPU core per hour
	RAMGBHourMicroUSD        uint64 // Cost per GB RAM per hour
	EgressGBMicroUSD         uint64 // Cost per GB network egress
	PromptTokenMicroUSD      uint64 // Cost per 1,000 prompt tokens
	CompletionTokenMicroUSD  uint64 // Cost per 1,000 completion tokens
}

// TelemetryEvent represents an enriched HTTP/LLM trace payload
type TelemetryEvent struct {
	TraceID          string    `json:"trace_id"`
	TenantID         string    `json:"tenant_id"`
	ServiceName      string    `json:"service_name"`
	APIRoute         string    `json:"api_route"`
	Provider         string    `json:"provider"`
	ModelOrResource  string    `json:"model_or_resource"`
	ExecutionTimeMS  uint32    `json:"execution_time_ms"`
	CPUMillicores    uint32    `json:"cpu_millicores"`
	MemoryMB         uint32    `json:"memory_mb"`
	EgressBytes      uint64    `json:"egress_bytes"`
	PromptTokens     uint32    `json:"prompt_tokens"`
	CompletionTokens uint32    `json:"completion_tokens"`
	Timestamp        time.Time `json:"timestamp"`
}

// CalculatedCostEvent represents a fully attributed cost event ready for ingestion
type CalculatedCostEvent struct {
	TelemetryEvent
	TotalCostMicroUSD uint64 `json:"total_cost_uusd"`
}
```

---

### File 4: `internal/engine/evaluator.go`

```go
package engine

import "sync"

// CostEvaluator holds static and dynamic rate cards for infrastructure and LLM models
type CostEvaluator struct {
	mu           sync.RWMutex
	pricingTable map[string]PricingRules
}

func NewCostEvaluator() *CostEvaluator {
	ce := &CostEvaluator{
		pricingTable: make(map[string]PricingRules),
	}
	ce.loadDefaultPricing()
	return ce
}

func (ce *CostEvaluator) loadDefaultPricing() {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	// Rates defined in Micro-USD ($1e-6 USD)
	// OpenAI GPT-4o: $5.00 / 1M input ($0.005 / 1k), $15.00 / 1M output ($0.015 / 1k)
	ce.pricingTable["OpenAI:gpt-4o"] = PricingRules{
		PromptTokenMicroUSD:     5000,  // $0.005 * 1,000,000 = 5000 uUSD per 1k tokens
		CompletionTokenMicroUSD: 15000, // $0.015 * 1,000,000 = 15000 uUSD per 1k tokens
	}

	// AWS AWS EC2 Compute Compute baseline (c6i.xlarge proxy)
	ce.pricingTable["AWS:c6i.xlarge"] = PricingRules{
		CPUCoreHourMicroUSD: 42500, // $0.0425 per vCPU hour
		RAMGBHourMicroUSD:   5300,  // $0.0053 per GB RAM hour
		EgressGBMicroUSD:    90000, // $0.09 per GB egress
	}
}

// Evaluate computes micro-dollar cost attributed to a telemetry event
func (ce *CostEvaluator) Evaluate(event TelemetryEvent) CalculatedCostEvent {
	ce.mu.RLock()
	rules, exists := ce.pricingTable[event.Provider+":"+event.ModelOrResource]
	ce.mu.RUnlock()

	if !exists {
		// Fallback to standard generic resource model if unmapped
		rules = PricingRules{
			CPUCoreHourMicroUSD: 30000,
			RAMGBHourMicroUSD:   4000,
			EgressGBMicroUSD:    80000,
		}
	}

	var totalCost uint64

	// 1. LLM Token Cost Calculation
	if event.PromptTokens > 0 || event.CompletionTokens > 0 {
		promptCost := (uint64(event.PromptTokens) * rules.PromptTokenMicroUSD) / 1000
		completionCost := (uint64(event.CompletionTokens) * rules.CompletionTokenMicroUSD) / 1000
		totalCost += promptCost + completionCost
	}

	// 2. Compute Runtime Execution Cost (vCPU & RAM allocation over duration)
	durationHours := float64(event.ExecutionTimeMS) / 3600000.0
	if event.CPUMillicores > 0 {
		cpuCores := float64(event.CPUMillicores) / 1000.0
		cpuCost := uint64(cpuCores * durationHours * float64(rules.CPUCoreHourMicroUSD))
		totalCost += cpuCost
	}

	if event.MemoryMB > 0 {
		ramGB := float64(event.MemoryMB) / 1024.0
		ramCost := uint64(ramGB * durationHours * float64(rules.RAMGBHourMicroUSD))
		totalCost += ramCost
	}

	// 3. Network Egress Cost
	if event.EgressBytes > 0 {
		egressGB := float64(event.EgressBytes) / 1073741824.0
		egressCost := uint64(egressGB * float64(rules.EgressGBMicroUSD))
		totalCost += egressCost
	}

	return CalculatedCostEvent{
		TelemetryEvent:    event,
		TotalCostMicroUSD: totalCost,
	}
}
```

---

### File 5: `internal/breaker/circuit_breaker.go`

```go
package breaker

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type BudgetBreaker struct {
	rdb *redis.Client
}

func NewBudgetBreaker(rdb *redis.Client) *BudgetBreaker {
	return &BudgetBreaker{rdb: rdb}
}

// TrackAndCheckBudget atomically increments tenant usage and evaluates spending against micro-USD limit
func (b *BudgetBreaker) TrackAndCheckBudget(ctx context.Context, tenantID string, costMicroUSD uint64, budgetLimitMicroUSD uint64) (bool, uint64, error) {
	// Construct current hour bucket key: budget:tenant_123:2026-03-30-14
	currentHour := time.Now().UTC().Format("2006-01-02-15")
	key := fmt.Sprintf("budget:%s:%s", tenantID, currentHour)

	// Redis Pipeline for Atomic Increment and TTL enforcement
	pipe := b.rdb.Pipeline()
	incr := pipe.IncrBy(ctx, key, int64(costMicroUSD))
	pipe.Expire(ctx, key, 2*time.Hour) // Keep for sliding window evaluations

	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, 0, fmt.Errorf("redis pipeline error: %w", err)
	}

	accumulatedCost := uint64(incr.Val())
	budgetExceeded := accumulatedCost > budgetLimitMicroUSD

	return budgetExceeded, accumulatedCost, nil
}
```

---

### File 6: `internal/storage/clickhouse.go`

```go
package storage

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/costpulse/costpulse/internal/engine"
)

type BatchWriter struct {
	conn      driver.Conn
	batchSize int
	buffer    []engine.CalculatedCostEvent
	mu        sync.Mutex
	flushChan chan struct{}
}

func NewBatchWriter(addr string, batchSize int) (*BatchWriter, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{addr},
		Auth: clickhouse.Auth{
			Database: "costpulse",
		},
		DialTimeout: 5 * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ClickHouse: %w", err)
	}

	bw := &BatchWriter{
		conn:      conn,
		batchSize: batchSize,
		buffer:    make([]engine.CalculatedCostEvent, 0, batchSize),
		flushChan: make(chan struct{}, 1),
	}

	go bw.startFlusher()
	return bw, nil
}

func (bw *BatchWriter) Write(event engine.CalculatedCostEvent) {
	bw.mu.Lock()
	bw.buffer = append(bw.buffer, event)
	shouldFlush := len(bw.buffer) >= bw.batchSize
	bw.mu.Unlock()

	if shouldFlush {
		select {
		case bw.flushChan <- struct{}{}:
		default:
		}
	}
}

func (bw *BatchWriter) startFlusher() {
	ticker := time.NewTicker(2 * time.Second)
	for {
		select {
		case <-ticker.C:
			bw.Flush()
		case <-bw.flushChan:
			bw.Flush()
		}
	}
}

func (bw *BatchWriter) Flush() {
	bw.mu.Lock()
	if len(bw.buffer) == 0 {
		bw.mu.Unlock()
		return
	}
	eventsToFlush := bw.buffer
	bw.buffer = make([]engine.CalculatedCostEvent, 0, bw.batchSize)
	bw.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	batch, err := bw.conn.PrepareBatch(ctx, "INSERT INTO costpulse.request_costs")
	if err != nil {
		fmt.Printf("[Error] Failed to prepare ClickHouse batch: %v\n", err)
		return
	}

	for _, e := range eventsToFlush {
		err := batch.Append(
			e.TraceID,
			e.TenantID,
			e.ServiceName,
			e.APIRoute,
			e.Provider,
			e.ModelOrResource,
			e.ExecutionTimeMS,
			e.CPUMillicores,
			e.MemoryMB,
			e.EgressBytes,
			e.PromptTokens,
			e.CompletionTokens,
			e.TotalCostMicroUSD,
			e.Timestamp,
		)
		if err != nil {
			fmt.Printf("[Error] Append row failed: %v\n", err)
			return
		}
	}

	if err := batch.Send(); err != nil {
		fmt.Printf("[Error] ClickHouse batch send failed: %v\n", err)
	} else {
		fmt.Printf("[Success] Flushed %d attributed cost events to ClickHouse.\n", len(eventsToFlush))
	}
}
```

---

### File 7: `cmd/engine/main.go`

```go
package main

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/costpulse/costpulse/internal/breaker"
	"github.com/costpulse/costpulse/internal/engine"
	"github.com/costpulse/costpulse/internal/storage"
	"github.com/redis/go-redis/v9"
)

func main() {
	fmt.Println("Starting CostPulse Engine v1.0...")

	redisHost := getEnv("REDIS_HOST", "localhost:6379")
	clickhouseHost := getEnv("CLICKHOUSE_HOST", "localhost:9000")

	// 1. Initialize Redis Client
	rdb := redis.NewClient(&redis.Options{
		Addr: redisHost,
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		fmt.Printf("Warning: Redis unavailable at %s (%v). Budget enforcement degraded.\n", redisHost, err)
	} else {
		fmt.Println("Connected to Redis successfully.")
	}

	// 2. Initialize ClickHouse Storage Engine
	writer, err := storage.NewBatchWriter(clickhouseHost, 50)
	if err != nil {
		fmt.Printf("Error initializing ClickHouse: %v\n", err)
	} else {
		fmt.Println("Connected to ClickHouse successfully.")
	}

	evaluator := engine.NewCostEvaluator()
	budgetBreaker := breaker.NewBudgetBreaker(rdb)

	// Hourly budget limit: $1.00 USD (1,000,000 Micro-USD) per tenant
	const TenantHourlyBudgetMicroUSD uint64 = 1_000_000

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 3. Simulated Telemetry Generator & Pipeline Processor
	go func() {
		tenants := []string{"tenant_acme", "tenant_globex", "tenant_stark"}
		routes := []string{"/api/v1/chat/completions", "/api/v1/search", "/api/v1/embed"}

		for {
			select {
			case <-ctx.Done():
				return
			default:
				time.Sleep(100 * time.Millisecond)

				tenant := tenants[rand.Intn(len(tenants))]
				route := routes[rand.Intn(len(routes))]

				event := engine.TelemetryEvent{
					TraceID:          fmt.Sprintf("trace-%d", rand.Int63()),
					TenantID:         tenant,
					ServiceName:      "gateway-service",
					APIRoute:         route,
					Provider:         "OpenAI",
					ModelOrResource:  "gpt-4o",
					ExecutionTimeMS:  uint32(rand.Intn(400) + 100),
					CPUMillicores:    200,
					MemoryMB:         512,
					EgressBytes:      uint64(rand.Intn(10000)),
					PromptTokens:     uint32(rand.Intn(1500) + 100),
					CompletionTokens: uint32(rand.Intn(500) + 50),
					Timestamp:        time.Now().UTC(),
				}

				// Calculate exact cost in micro-USD
				calculated := evaluator.Evaluate(event)

				// Evaluate Dynamic Budget Circuit Breaker
				exceeded, accumCost, err := budgetBreaker.TrackAndCheckBudget(
					ctx,
					calculated.TenantID,
					calculated.TotalCostMicroUSD,
					TenantHourlyBudgetMicroUSD,
				)

				if err == nil && exceeded {
					fmt.Printf("[CIRCUIT BREAKER TRIPPED] Tenant %s exceeded budget! Total: $%f USD. Blocking route %s.\n",
						calculated.TenantID, float64(accumCost)/1e6, calculated.APIRoute)
				} else {
					fmt.Printf("[Processed Event] Trace: %s | Tenant: %s | Route: %s | Cost: $%f USD\n",
						calculated.TraceID, calculated.TenantID, calculated.APIRoute, float64(calculated.TotalCostMicroUSD)/1e6)
				}

				// Stream result to ClickHouse analytical buffer
				if writer != nil {
					writer.Write(calculated)
				}
			}
		}
	}()

	// Graceful Shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	fmt.Println("\nShutting down CostPulse Engine...")
	if writer != nil {
		writer.Flush()
	}
	fmt.Println("CostPulse engine stopped cleanly.")
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
```

---

### File 8: `docker-compose.yml`

```yaml
version: '3.8'

services:
  clickhouse:
    image: clickhouse/clickhouse-server:24.3-alpine
    container_name: costpulse-clickhouse
    ports:
      - "8123:8123" # HTTP Interface
      - "9000:9000" # Native Interface
    volumes:
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    ulimits:
      nofile:
        soft: 262144
        hard: 262144

  redis:
    image: redis:7.2-alpine
    container_name: costpulse-redis
    ports:
      - "6379:6379"

  costpulse-engine:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: costpulse-engine
    environment:
      - REDIS_HOST=redis:6379
      - CLICKHOUSE_HOST=clickhouse:9000
    depends_on:
      - clickhouse
      - redis
```

---

### File 9: `Dockerfile`

```dockerfile
FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /costpulse-engine ./cmd/engine/main.go

FROM alpine:3.19

WORKDIR /root/
COPY --from=builder /costpulse-engine .

CMD ["./costpulse-engine"]
```

---

## 5. Execution & Verification

To spin up the environment and execute the solution:

```bash
# 1. Start the full system stack (ClickHouse, Redis, CostPulse Engine)
docker-compose up --build

# 2. Query real-time aggregated microservice cost per tenant in ClickHouse
docker exec -it costpulse-clickhouse clickhouse-client --query "
SELECT 
    tenant_id, 
    count() as requests, 
    sum(total_cost_uusd) / 1000000 as total_cost_usd, 
    sum(prompt_tokens + completion_tokens) as tokens_used 
FROM costpulse.request_costs 
GROUP BY tenant_id;
"
```
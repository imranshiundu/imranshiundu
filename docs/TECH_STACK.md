# Imran Shiundu — Full Tech Stack

> This is the source of truth for my complete technical toolkit.
> The main [README.md](../README.md) shows only the icon summary.
> Everything here is real — built, shipped, or actively in use.

---

## Languages

| Language | Depth | Where I Use It |
|---|---|---|
| TypeScript | Primary | Next.js apps, APIs, AI tooling, full-stack products |
| Java | Primary | Spring Boot microservices, trading engines, enterprise backends |
| Python | Comfortable | AI agents, data pipelines, automation systems, research tools |
| JavaScript | Comfortable | Frontend, Node.js scripts, browser tooling |
| Rust | Learning | Systems-level tools — `pickup` productivity system |
| SQL | Comfortable | PostgreSQL schema design, complex queries, migrations |
| HTML / CSS | Comfortable | Semantic markup, layout systems, custom styling |
| Bash / Shell | Comfortable | Linux automation, CI scripts, server provisioning |

---

## AI Systems — Built & Shipped

This is not a list of tools I've read about. These are systems I designed, built, and deployed.

| System | What It Does |
|---|---|
| **Griot** | Full AI-powered trading platform — cognitive analysis engine, real-time market scanning, autonomous trade execution, risk management, and admin dashboard. Built with Java, Spring Boot, Next.js, and LLM integration. |
| **AgentPrometheus** | Hierarchical multi-agent system — agents that plan, research, write code, and execute tasks autonomously. Built in Python with custom orchestration. |
| **Patricia** | Legal intelligence platform — AI searches case law, synthesises findings, and generates audio summaries. TypeScript + AI APIs. |
| **Jarvis** | Personal AI assistant system — command routing, task execution, local knowledge base, voice-ready interface. |
| **Neko** | AI-powered interface system. Private project — context-aware interactions and adaptive UI behaviour. |
| **C3NTR-L-COMM-ND** | Telegram bot as an AI command interface for Linux — remote system control, self-healing automation, real-time feedback. |

---

## AI & LLM Tooling

| Tool | How I Use It |
|---|---|
| **Groq API** | Production LLM inference — ultra-low latency, llama-3.3-70b. Used in Griot, profile automation, and AI products. |
| **Ollama** | Self-hosted local AI — running LLMs without cloud dependency. Full offline inference on local machines. |
| **OpenAI API** | GPT models for product features, classification, summarisation. |
| **LangChain** | Agent orchestration, chain composition, tool calling for multi-step reasoning. |
| **Custom agents** | Multi-agent architectures built from scratch — no framework lock-in. Own orchestration logic. |
| **pgvector** | Semantic search in PostgreSQL — vector embeddings for retrieval-augmented generation (RAG). |
| **Whisper** | Audio transcription pipeline used in Patricia. |

---

## Trading & Financial Systems

I have designed, built, and deployed multiple trading systems — not toy examples.

| Component | What I Built |
|---|---|
| **Trading Engine** | Core execution engine with order routing, position management, and strategy runner. Built in Java. |
| **Signal System** | Real-time market data ingestion, indicator computation, and signal generation pipelines. |
| **AI-Driven Strategy** | LLM integrated into trade decision loop — cognitive analysis of market conditions before execution. |
| **Risk Controls** | Position sizing rules, drawdown protection, exposure caps, circuit breakers. |
| **Trade Bots** | Automated execution systems with configurable strategies and scheduled job runners. |
| **Admin Dashboard** | Real-time monitoring — P&L, active positions, system health, execution logs. Next.js + WebSockets. |
| **Backtesting Harness** | Historical data replay and strategy performance evaluation. |

---

## Research & Autonomous Systems

| System | Description |
|---|---|
| Multi-agent research | Agents that plan queries, search sources, cross-reference, synthesise, and generate structured reports. |
| Self-healing automation | Systems that detect failures and recover — used in C3NTR-L-COMM-ND and Griot infra. |
| Cognitive analysis engine | Griot component that runs LLM reasoning over market state before acting. |
| Data pipelines | End-to-end pipelines: ingestion → transformation → storage → visualisation. Python + PostgreSQL. |
| Scheduled workers | PM2-managed background processes for continuous signal generation and system health checks. |

---

## Frontend

| Tool | Notes |
|---|---|
| Next.js | Primary framework — App Router, SSR, API routes, full-stack usage |
| React | Component model, hooks, state management |
| TypeScript | Strict typing across all frontend work |
| Tailwind CSS | Utility-first styling system |
| Framer Motion | Animations, transitions, page motion |
| Shadcn/UI | Component primitives built on Radix |
| Radix UI | Accessible, unstyled UI primitives |
| WebSockets | Real-time dashboards and live trading UIs |

---

## Backend

| Tool | Notes |
|---|---|
| Spring Boot | Primary Java framework — REST APIs, microservices, production services |
| Spring Security | Auth, JWT, role-based access control |
| Node.js | Lightweight APIs, scripts, automation, profile tooling |
| REST API design | Versioning, pagination, error handling, API contracts |
| Microservices | Service decomposition, inter-service communication, shared auth |
| WebSockets | Real-time data push for trading dashboards and chat |

---

## Data & Storage

| Tool | Notes |
|---|---|
| PostgreSQL | Primary relational database across all projects |
| Supabase | Managed Postgres + Auth + Storage + Realtime |
| Prisma | TypeScript ORM — schema-first, migrations, type-safe queries |
| pgvector | Vector similarity search for AI/RAG use cases |
| Redis | Caching, session management, rate limiting |
| JSON stores | Lightweight structured data for scripts and local tools |

---

## Infrastructure & DevOps

| Tool | Notes |
|---|---|
| Ubuntu / Linux | Primary dev and server OS — daily driver |
| Docker | Containerisation — multi-service Compose stacks, production images |
| Nginx | Reverse proxy, SSL termination, load balancing |
| PM2 | Node.js process management — background workers, restart policies |
| GitHub Actions | CI/CD pipelines, README automation, scheduled jobs, deployments |
| AWS | EC2, S3, IAM — intermediate production usage |
| Vercel | Frontend deployments — Next.js optimised |
| DigitalOcean | VPS hosting for backend services |

---

## Productivity & Developer Tooling

| Tool | Notes |
|---|---|
| `pickup` | My own background productivity system — reduces interruption recovery cost. Built in Rust. |
| Git | Daily driver — conventional commits, branching strategy |
| GitHub CLI (`gh`) | Fast repo, issue, and PR management from terminal |
| VS Code | Primary editor |
| Postman | API testing and documentation |
| Docker Desktop | Local container management |
| Figma | UI reference and mockup review |

---

## Systems I Am Actively Exploring

| Area | Why |
|---|---|
| Advanced agent architectures | Better multi-agent coordination — building on AgentPrometheus learnings |
| Quantitative trading strategies | Moving beyond rule-based to statistically validated systems |
| Local AI deployment | Full offline inference pipelines — Ollama + custom tooling |
| Rust systems programming | More `pickup`-style tools — performance without the overhead |
| WebAssembly | Browser-native performance for compute-heavy UI |
| Public data products | Civic datasets, dashboards, open analytics — starting with Kenya/Uganda |

---

## What I Do Not Use (and Why)

| Avoided | Reason |
|---|---|
| AI code I do not understand | Adding it is technical debt, not productivity |
| Ten repos open at once | Unfinished work is worse than no work |
| Framework hype-hopping | I learn a tool deeply before moving on |
| Fake commits to grow the graph | Real commits only — every one should mean something |

---

*Last manually updated: April 2026*
*Profile README auto-refreshes daily via GitHub Actions using Groq LLM + GitHub API.*

Official E-commerce website goal document.

You can treat this as the **authoritative project brief**.

---

# **Project Overview**

You are building a **boring, predictable, production-style E-commerce application** whose purpose is **employability**, not innovation.

The project is intentionally:

* monolithic (for now),
* conventional,
* end-to-end,
* incremental,
* and finishable.

The goal is to demonstrate that you can **design, build, test, deploy, and maintain** a real web system across backend, frontend, and CI/CD — without scope collapse.

---

## **Implementation Order**

You will build the project in **three sequential phases**, each building on the previous one:

1. **Backend (first, core of the system)**
2. **Frontend (built on the finished backend)**
3. **CI/CD + Deployment (after both exist)**

This order is deliberate to avoid frontend blocking, scope explosion, and architectural churn.

---

## **Phase 1: Backend (Monolithic, Nest.js)**

### **Purpose**

Create a solid, production-style API that could realistically support a frontend and future scaling.

### **Tech Choices**

* **Framework:** Nest.js
* **Auth:** Passport.js (JWT-based)
* **Authorization:** Simple RBAC (e.g., admin / seller / customer)
* **Database:** PostgreSQL (preferred) *or* MongoDB
* **ORM / DB layer:** With migrations support
* **API Spec:** OpenAPI (Swagger)

### **Core Features**

* User authentication & authorization
* Product catalog
* Cart & order management
* Basic checkout flow (no real payments required)

### **Engineering Concerns**

* Centralized error handling
* Structured logging
* Health check endpoint
* Input validation
* Database transactions
* Indexing for performance
* Seed scripts for local dev & tests

### **Testing**

* Integration tests
* End-to-end API tests

### **Explicitly Deferred**

(Not part of the initial scope)

* Microservices
* Queues / background jobs
* Redis
* Full-text search engines
* Feature flags
* Advanced observability stacks

---

## **Phase 2: Frontend (Consumer of the API)**

### **Purpose**

Demonstrate modern frontend practices while consuming a real backend.

### **Tech Choices**

* **Framework:** Next.js
* **Rendering:** SSR where appropriate
* **API Consumption:** Directly from your backend (OpenAPI-based client if desired)

### **Features**

* Product listing pages
* Product detail pages
* Cart
* Checkout
* Authentication flows

### **Testing & Tooling**

* Integration tests
* End-to-end tests
* Storybook (added after core UI stabilizes)
* MSW optional (backend already exists, so mocking is not required)

---

## **Phase 3: CI/CD & Deployment**

### **Purpose**

Prove you can ship and operate software, not just write code.

### **Local Development**

* Docker
* Docker Compose (frontend + backend)

### **CI**

* GitHub Actions

  * Run tests
  * Build frontend & backend
  * Lint / format (Biome)
  * Fail fast on errors

### **Deployment**

* **Backend:** AWS Elastic Beanstalk
* **Database:** AWS RDS (PostgreSQL)
* **Frontend:** Vercel *or* AWS Amplify
* **Logs & Monitoring:** CloudWatch (basic)

### **General Tooling**

* Biome (instead of ESLint + Prettier)
* Pre-commit hooks
* Environment variable management

---

## **Design Principles**

* One monolith before any micro-architecture ideas
* Vertical progress over architectural perfection
* Finish core functionality before optimizations
* Avoid AWS rabbit holes
* Prefer boring, industry-standard solutions
* Incremental, slice-by-slice development

---

## **What This Project Demonstrates**

* Backend API design maturity
* Practical database usage
* Authentication & authorization
* Testing discipline
* Frontend + backend integration
* Deployment to real cloud infrastructure
* CI/CD literacy
* Ability to finish and ship software

---

## **Future / Parked Idea (Post-Completion Only)**

**After the project is fully finished and deployed**, you may revisit the idea of adding **one optional, well-contained “agentic” or AI-assisted layer** to make the project more contemporary and exploratory.

Examples (conceptual only, not commitments):

* An AI-assisted product discovery or recommendation flow
* A conversational commerce helper (admin-side or customer-side)
* A natural-language query interface over the product catalog
* Inspiration from ideas such as Google’s *Universal Commerce Model*

**Constraints for this future phase:**

* Must not alter the core backend architecture
* Must be optional and edge-bound
* Must be explainable in simple terms to a recruiter
* Must come *after* backend, frontend, CI/CD, and deployment are complete

This is explicitly **Phase 2+**, not part of the employability-critical core.

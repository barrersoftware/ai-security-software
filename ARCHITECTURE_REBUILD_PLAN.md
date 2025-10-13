# Architecture Rebuild Plan 🏗️

**Project:** AI Security Scanner  
**Version:** 4.0.0 (Architecture Overhaul)  
**Date:** October 13, 2025  
**Status:** Planning  

---

## 🎯 Problem Statement

The current system has grown organically with features added incrementally:
- Core security scanner (scripts)
- Web UI (Express.js monolith)
- MFA, OAuth, IDS, Backup, Secrets rotation
- Multiple route files, middleware stacked on middleware
- **Result:** Complex, hard to maintain, difficult to extend

**Now adding VPN would make it worse.** Time to rebuild properly.

---

## 🏛️ New Architecture: Microservices Approach

### Core Principle: Separation of Concerns

Each service does ONE thing well and communicates via clean APIs.

```
┌─────────────────────────────────────────────────────────────┐
│                     Reverse Proxy (Nginx)                   │
│                    API Gateway & Load Balancer              │
└──────────────┬──────────────┬──────────────┬────────────────┘
               │              │              │
       ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
       │   Web UI     │ │   API    │ │     VPN     │
       │   Frontend   │ │  Gateway │ │   Service   │
       └──────────────┘ └────┬─────┘ └──────┬──────┘
                             │               │
              ┌──────────────┴───────────────┴─────────┐
              │                                         │
    ┌─────────▼────────┐  ┌──────────┐  ┌─────────────▼──────┐
    │  Auth Service    │  │  Event   │  │  Scanner Service   │
    │  (MFA/OAuth/IDS) │  │   Bus    │  │  (Core Security)   │
    └──────────────────┘  │ (Redis)  │  └────────────────────┘
                          └────┬─────┘
              ┌────────────────┴──────────────────┐
              │                                    │
    ┌─────────▼─────────┐            ┌───────────▼────────┐
    │  Storage Service  │            │  Analytics Service │
    │  (Reports/Logs)   │            │  (AI/ML Analysis)  │
    └───────────────────┘            └────────────────────┘
```

---

## 📦 Service Breakdown

### 1. Core Services (Essential)

#### 1.1 Scanner Service
**Purpose:** Run security scans, compliance checks  
**Port:** 5001  
**Tech:** Node.js + Shell scripts  
**Responsibilities:**
- Execute security scans
- Run compliance frameworks
- System analysis
- File scanning
- Process monitoring

**API Endpoints:**
- `POST /scan/start` - Start new scan
- `GET /scan/status/:id` - Check scan status
- `GET /scan/results/:id` - Get scan results
- `GET /scan/history` - List past scans

#### 1.2 Auth Service
**Purpose:** Authentication & authorization  
**Port:** 5002  
**Tech:** Node.js + SQLite/PostgreSQL  
**Responsibilities:**
- User authentication
- MFA/2FA management
- OAuth integration
- Session management
- JWT token issuance
- Intrusion detection
- Account lockout

**API Endpoints:**
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/mfa/setup` - Setup MFA
- `POST /auth/mfa/verify` - Verify MFA token
- `GET /auth/oauth/:provider` - OAuth login
- `GET /auth/user` - Get current user

#### 1.3 VPN Service
**Purpose:** VPN server management  
**Port:** 5003  
**Tech:** Node.js + WireGuard/OpenVPN + Docker  
**Responsibilities:**
- VPN server management
- Client provisioning
- Traffic monitoring
- Threat detection
- Network security

**API Endpoints:**
- `GET /vpn/status` - Server status
- `POST /vpn/clients` - Create client
- `GET /vpn/clients` - List clients
- `GET /vpn/clients/:id/config` - Get client config
- `GET /vpn/traffic/stats` - Traffic statistics
- `GET /vpn/threats` - Detected threats

#### 1.4 Storage Service
**Purpose:** Report storage, logs, backups  
**Port:** 5004  
**Tech:** Node.js + File system + S3-compatible (optional)  
**Responsibilities:**
- Store scan reports
- Store logs
- Manage backups
- File retrieval
- Data retention

**API Endpoints:**
- `POST /storage/reports` - Save report
- `GET /storage/reports/:id` - Get report
- `GET /storage/reports` - List reports
- `POST /storage/backup` - Create backup
- `GET /storage/backups` - List backups
- `POST /storage/restore/:id` - Restore backup

#### 1.5 Analytics Service
**Purpose:** AI analysis, threat intelligence  
**Port:** 5005  
**Tech:** Node.js + Ollama + Python (optional)  
**Responsibilities:**
- AI-powered analysis
- Threat correlation
- Pattern recognition
- Report generation
- Recommendations

**API Endpoints:**
- `POST /analytics/analyze` - Analyze data
- `GET /analytics/threats` - Threat summary
- `GET /analytics/trends` - Trends analysis
- `POST /analytics/chat` - AI assistant

### 2. Supporting Services

#### 2.1 API Gateway
**Purpose:** Single entry point, routing, rate limiting  
**Port:** 5000  
**Tech:** Node.js (Express) or Kong/Tyk  
**Responsibilities:**
- Route requests to services
- Rate limiting
- Request validation
- API versioning
- Load balancing
- Service discovery

#### 2.2 Event Bus (Optional but Recommended)
**Purpose:** Service communication, real-time updates  
**Tech:** Redis Pub/Sub or RabbitMQ  
**Responsibilities:**
- Inter-service messaging
- Real-time notifications
- Event logging
- WebSocket backend

### 3. Frontend

#### Web UI
**Purpose:** User interface  
**Port:** 3000 (dev) / 80,443 (prod behind Nginx)  
**Tech:** Modern framework (React/Vue/Svelte) or enhanced vanilla JS  
**Responsibilities:**
- Dashboard
- Scan management
- VPN management
- User management
- Reports viewing
- Settings

---

## 🗂️ New Directory Structure

```
ai-security-scanner/
├── services/                      # All microservices
│   ├── gateway/                   # API Gateway
│   │   ├── server.js
│   │   ├── routes.js
│   │   ├── middleware/
│   │   ├── config/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── auth/                      # Authentication Service
│   │   ├── server.js
│   │   ├── auth.js
│   │   ├── mfa.js
│   │   ├── oauth.js
│   │   ├── intrusion-detection.js
│   │   ├── database/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── scanner/                   # Scanner Service
│   │   ├── server.js
│   │   ├── scanner-manager.js
│   │   ├── scripts/              # Existing scan scripts
│   │   ├── compliance/           # Compliance frameworks
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── vpn/                       # VPN Service (NEW)
│   │   ├── server.js
│   │   ├── wireguard/
│   │   ├── openvpn/
│   │   ├── traffic-analyzer/
│   │   ├── threat-detector/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── storage/                   # Storage Service
│   │   ├── server.js
│   │   ├── report-manager.js
│   │   ├── backup-manager.js
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── analytics/                 # Analytics Service
│       ├── server.js
│       ├── ai-analyzer.js
│       ├── threat-intelligence.js
│       ├── package.json
│       └── Dockerfile
│
├── frontend/                      # Web UI (Rebuilt)
│   ├── public/
│   │   ├── index.html
│   │   ├── css/
│   │   ├── js/
│   │   └── assets/
│   ├── src/                       # If using framework
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── Dockerfile
│
├── shared/                        # Shared utilities
│   ├── logger.js
│   ├── config.js
│   ├── constants.js
│   └── utils.js
│
├── docker/                        # Docker configurations
│   ├── docker-compose.yml         # All services
│   ├── docker-compose.dev.yml     # Development
│   ├── docker-compose.prod.yml    # Production
│   └── nginx/
│       ├── nginx.conf
│       └── Dockerfile
│
├── scripts/                       # Deployment scripts
│   ├── setup.sh                   # Complete setup
│   ├── deploy.sh                  # Deployment
│   ├── migrate.sh                 # Migration from old version
│   └── health-check.sh            # Health monitoring
│
├── docs/                          # Documentation
│   ├── API.md                     # API documentation
│   ├── ARCHITECTURE.md            # This document
│   ├── DEPLOYMENT.md              # Deployment guide
│   └── DEVELOPMENT.md             # Dev guide
│
├── tests/                         # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example                   # Environment template
├── docker-compose.yml             # Main compose file
└── README.md                      # Updated README
```

---

## 🔄 Migration Strategy

### Phase 1: Create New Structure (Week 1-2)
**Goal:** Set up new architecture without breaking current system

1. Create new `services/` directory structure
2. Set up API Gateway skeleton
3. Create shared utilities
4. Set up Docker configurations
5. Document APIs

**Current system continues running.**

### Phase 2: Extract Services (Week 3-6)
**Goal:** Move functionality to new services one at a time

**Order:**
1. **Storage Service** (easiest, least dependencies)
   - Move report storage
   - Move backup functionality
   - Test independently

2. **Analytics Service**
   - Move AI analysis
   - Move Ollama integration
   - Test with Storage Service

3. **Scanner Service**
   - Move scan scripts
   - Move compliance checks
   - Test with Storage and Analytics

4. **Auth Service**
   - Move authentication
   - Move MFA/OAuth
   - Move IDS
   - Test thoroughly (most critical)

**After each service:**
- Update API Gateway to route to it
- Run integration tests
- Keep old system as fallback

### Phase 3: Add VPN Service (Week 7-9)
**Goal:** Build VPN as brand new service

1. Create VPN service from scratch
2. Implement WireGuard integration
3. Add traffic monitoring
4. Connect to Analytics for AI analysis
5. Add to API Gateway

**Advantage:** Clean implementation, no legacy baggage

### Phase 4: Rebuild Frontend (Week 10-12)
**Goal:** Modern, clean UI

**Options:**

**Option A: Modern Framework (Recommended)**
- React + Next.js or Vite
- Vue 3 + Vite
- Svelte + SvelteKit

**Option B: Enhanced Vanilla JS**
- Modern ES6+ modules
- Web Components
- Better organization
- Progressive enhancement

**Features:**
- Single Page Application (SPA)
- Real-time updates (WebSocket)
- Responsive design
- Dark mode
- Mobile-friendly

### Phase 5: Testing & Migration (Week 13-14)
**Goal:** Validate and switch over

1. Comprehensive testing
2. Performance testing
3. Security audit
4. Migration script for existing users
5. Documentation update
6. Release v4.0.0

### Phase 6: Deprecate Old System (Week 15)
**Goal:** Clean up

1. Move old code to `legacy/` folder
2. Update all references
3. Create migration guide
4. Final testing
5. Celebrate! 🎉

---

## 🐳 Docker Deployment

### Development Environment

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  gateway:
    build: ./services/gateway
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development
    volumes:
      - ./services/gateway:/app
    depends_on:
      - redis

  auth:
    build: ./services/auth
    ports:
      - "5002:5002"
    environment:
      - NODE_ENV=development
    volumes:
      - ./services/auth:/app
    depends_on:
      - redis

  scanner:
    build: ./services/scanner
    ports:
      - "5001:5001"
    volumes:
      - ./services/scanner:/app

  vpn:
    build: ./services/vpn
    ports:
      - "5003:5003"
      - "51820:51820/udp"  # WireGuard
    cap_add:
      - NET_ADMIN
    volumes:
      - ./services/vpn:/app

  storage:
    build: ./services/storage
    ports:
      - "5004:5004"
    volumes:
      - ./services/storage:/app
      - ./data:/data

  analytics:
    build: ./services/analytics
    ports:
      - "5005:5005"
    volumes:
      - ./services/analytics:/app

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
    environment:
      - API_GATEWAY=http://gateway:5000
```

### Production Environment

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - gateway
      - frontend

  redis:
    image: redis:alpine
    restart: always
    volumes:
      - redis-data:/data

  gateway:
    build: ./services/gateway
    restart: always
    environment:
      - NODE_ENV=production
    depends_on:
      - redis

  auth:
    build: ./services/auth
    restart: always
    environment:
      - NODE_ENV=production
    depends_on:
      - redis

  scanner:
    build: ./services/scanner
    restart: always

  vpn:
    build: ./services/vpn
    restart: always
    ports:
      - "51820:51820/udp"
    cap_add:
      - NET_ADMIN

  storage:
    build: ./services/storage
    restart: always
    volumes:
      - storage-data:/data

  analytics:
    build: ./services/analytics
    restart: always

  frontend:
    build: ./frontend
    restart: always
    environment:
      - NODE_ENV=production

volumes:
  redis-data:
  storage-data:
```

---

## 🔧 Technology Decisions

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js (proven, familiar)
- **Database:** SQLite (small) or PostgreSQL (scalable)
- **Cache/Events:** Redis
- **WebSocket:** ws library
- **API Style:** RESTful + WebSocket for real-time

### Frontend
**Decision Point - Choose One:**

**Option 1: React (Most Popular)**
- ✅ Huge ecosystem
- ✅ Great tooling
- ✅ Many developers know it
- ⚠️ Larger bundle size
- ⚠️ More complex

**Option 2: Vue 3 (Balanced)**
- ✅ Easy to learn
- ✅ Good performance
- ✅ Clean syntax
- ✅ Smaller bundle
- ⚠️ Smaller ecosystem than React

**Option 3: Svelte (Fastest)**
- ✅ Fastest performance
- ✅ Smallest bundle
- ✅ Simplest code
- ✅ Compile-time magic
- ⚠️ Newer, smaller community

**Option 4: Enhanced Vanilla JS (Simplest)**
- ✅ No build step
- ✅ Fastest load time
- ✅ No dependencies
- ✅ Easy to understand
- ⚠️ More manual work

**Recommendation:** Svelte or Vue 3 (modern, fast, not overkill)

### DevOps
- **Containerization:** Docker + Docker Compose
- **Orchestration:** Docker Compose (simple) or Kubernetes (scalable)
- **Reverse Proxy:** Nginx
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana (optional)

---

## 📊 Comparison: Old vs New

### Old Architecture (Current v3.1.1)

**Pros:**
- ✅ Works
- ✅ Feature complete
- ✅ Battle-tested

**Cons:**
- ❌ Monolithic server.js (8,000+ lines with all imports)
- ❌ Tightly coupled components
- ❌ Hard to test individual parts
- ❌ Difficult to scale
- ❌ One failure affects everything
- ❌ Hard to add new features without breaking things

### New Architecture (Planned v4.0.0)

**Pros:**
- ✅ Modular services
- ✅ Each service can scale independently
- ✅ Easy to test (isolated units)
- ✅ Easy to add new services
- ✅ Services can be in different languages
- ✅ Failure isolation (one service down ≠ all down)
- ✅ Clear separation of concerns
- ✅ Better for team development

**Cons:**
- ⚠️ More complex deployment (Docker Compose simplifies this)
- ⚠️ Network overhead (minimal with proper setup)
- ⚠️ Need to manage multiple services
- ⚠️ More resource usage (offset by better scaling)

**Verdict:** Benefits far outweigh costs, especially for future growth

---

## 🎯 VPN Service Integration (Clean Approach)

### VPN as Independent Service

```
VPN Service (Port 5003)
├── API Server (Node.js)
├── WireGuard Manager
├── OpenVPN Manager (optional)
├── Traffic Analyzer
└── Threat Detector

Communicates with:
- Auth Service → User authentication
- Analytics Service → AI threat analysis
- Storage Service → Log storage
- Gateway → API access
```

### VPN Service API

```javascript
// services/vpn/server.js
const express = require('express');
const app = express();

// VPN Service - Clean, focused, independent
app.post('/vpn/clients', createClient);
app.get('/vpn/clients', listClients);
app.get('/vpn/status', getServerStatus);
app.get('/vpn/traffic', getTrafficStats);

// Communicates with other services via HTTP/Events
async function createClient(req, res) {
    // Verify with Auth Service
    const user = await authService.verifyToken(req.headers.authorization);
    
    // Create VPN client
    const client = await wireguardManager.createClient(user.id);
    
    // Log to Storage Service
    await storageService.log('vpn_client_created', { userId: user.id });
    
    // Send to Analytics for monitoring
    await analyticsService.track('vpn.client.created', client);
    
    res.json(client);
}
```

**Clean, modular, testable!**

---

## 💡 Quick Win: Hybrid Approach

**Instead of full rebuild immediately:**

### Phase 0: Prepare for Migration (This Session)

1. **Document Current Architecture** ✓
2. **Create Services Directory Structure**
3. **Set up Docker Compose skeleton**
4. **Build VPN as First Microservice**
   - Proof of concept
   - Tests the architecture
   - Provides immediate value
5. **Connect VPN service to existing system via API**
   - Existing web UI calls new VPN service
   - VPN service calls existing APIs

**Benefits:**
- ✅ Get VPN working quickly
- ✅ Test microservices approach
- ✅ Don't break existing system
- ✅ Gradual migration path
- ✅ Can stop/rollback anytime

**Timeline:**
- Week 1-2: Build VPN service independently
- Week 3: Connect to existing system
- Week 4-12: Migrate other services gradually
- No pressure, no deadline, no risk

---

## 🚀 Recommended Next Steps

### Immediate (This Session):
1. ✅ Create `ARCHITECTURE_REBUILD_PLAN.md` (this file)
2. Create basic services directory structure
3. Create Docker Compose skeleton
4. Build VPN service as first microservice (proof of concept)

### Short Term (Next Few Sessions):
1. Complete VPN service with full features
2. Connect VPN to existing web UI
3. Test end-to-end
4. Document learnings

### Medium Term (Next Few Weeks):
1. Extract Storage Service
2. Extract Scanner Service
3. Extract Auth Service
4. Build API Gateway
5. Update web UI to use Gateway

### Long Term (Next Few Months):
1. Rebuild frontend with modern framework
2. Add monitoring and logging
3. Performance optimization
4. Release v4.0.0
5. Deprecate old architecture

---

## 🎓 Learning from the Best

### Industry Examples

**Netflix:** Monolith → Microservices
- Started with monolithic DVD rental app
- Now 1000+ microservices
- Each team owns their services
- Can deploy independently

**Amazon:** Same journey
- Started monolithic
- Broke into services
- "Two pizza teams" - small, focused
- Led to AWS

**Spotify:** Squad model
- Small, autonomous teams
- Each owns their services
- Fast iteration
- Independent deployment

**Our Approach:** Start small, proven patterns, gradual migration

---

## ❓ Questions to Answer

Before we start building:

1. **Frontend Framework:**
   - Rebuild with React/Vue/Svelte?
   - Enhance current vanilla JS?
   - **Your preference?**

2. **Database:**
   - Keep SQLite (simple)?
   - Switch to PostgreSQL (scalable)?
   - **Your preference?**

3. **Message Bus:**
   - Add Redis for events?
   - Keep simple HTTP?
   - **Your preference?**

4. **Migration Speed:**
   - Aggressive (full rebuild in 3 months)?
   - Gradual (migrate over 6 months)?
   - **Your preference?**

5. **VPN Priority:**
   - Build VPN first as proof of concept?
   - Migrate existing first?
   - **Your preference?**

---

## 🎯 Decision Time

**I recommend:** Build VPN service as first microservice (proof of concept)

**Why:**
1. You want VPN (your stated goal)
2. Tests new architecture with real feature
3. Doesn't break existing system
4. Clean slate for best practices
5. Learn what works before migrating everything
6. Provides value immediately

**What do you think?** Should we:

**Option A:** Build VPN service first (recommended)
- Start fresh with clean architecture
- Proof of concept for microservices
- Get VPN working quickly
- Learn from experience

**Option B:** Migrate existing first
- Move current features to services
- Then add VPN
- More comprehensive but slower

**Option C:** Hybrid
- Build VPN service
- Keep existing system as-is for now
- Migrate gradually in background

---

**Your choice determines next steps!** What sounds best to you?

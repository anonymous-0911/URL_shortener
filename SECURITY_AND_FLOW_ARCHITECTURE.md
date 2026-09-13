# 🛡️ System Flow & Security Architecture Documentation

This document provides an end-to-end breakdown of the **Short-URL Node.js Application**, covering the system design, request execution flows, state management, security architecture, and identified security vulnerabilities with recommended fixes.

---

## 1. Architectural Overview (MVC Pattern)

The application is built using the **Model-View-Controller (MVC)** design pattern on top of **Node.js, Express, and MongoDB (Mongoose)**.

```
                  ┌──────────────────────────────────────────┐
                  │               Client (Browser)           │
                  └────────────────────┬─────────────────────┘
                                       │
                               HTTP Request (Cookie: uid)
                                       │
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │           Express App (index.js)         │
                  └────────────────────┬─────────────────────┘
                                       │
                              Middlewares (cookieParser, auth)
                                       │
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │                 Routers                  │
                  │   (/user, /url, /, /url/:shortId)        │
                  └────────────────────┬─────────────────────┘
                                       │
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │               Controllers                │
                  │   (user.js, url.js, staticRouter.js)     │
                  └───────┬──────────────────────────┬───────┘
                          │                          │
           Session Store  │                          │ Mongoose DB Operations
           (service/auth) │                          │ (models/user, models/url)
                          ▼                          ▼
                  ┌───────────────┐          ┌───────────────┐
                  │ In-Memory Map │          │ MongoDB Atlas │
                  └───────────────┘          └───────────────┘
```

### Component Breakdown

| Directory / File | Layer | Role & Responsibility |
| :--- | :--- | :--- |
| [index.js](file:///c:/Users/vinee/wisdom/short-url-nodejs/index.js) | **Entry Point** | App initialization, middleware setup, database connection, global route mounting, and direct short URL redirection handler. |
| [connect.js](file:///c:/Users/vinee/wisdom/short-url-nodejs/connect.js) | **Database** | Establishes connection to MongoDB via Mongoose. |
| [models/user.js](file:///c:/Users/vinee/wisdom/short-url-nodejs/models/user.js) | **Model** | Mongoose schema defining User structure (`name`, `email`, `password`). |
| [models/url.js](file:///c:/Users/vinee/wisdom/short-url-nodejs/models/url.js) | **Model** | Mongoose schema defining Short URL structure (`shortId`, `redirectURL`, `visitHistory`, `createdBy`). |
| [views/](file:///c:/Users/vinee/wisdom/short-url-nodejs/views) | **View** | EJS templates (`home.ejs`, `login.ejs`, `signup.ejs`) rendered server-side. |
| [controllers/user.js](file:///c:/Users/vinee/wisdom/short-url-nodejs/controllers/user.js) | **Controller** | Manages user registration (`handleUserSignup`) and login/authentication logic (`handleUserLogin`). |
| [controllers/url.js](file:///c:/Users/vinee/wisdom/short-url-nodejs/controllers/url.js) | **Controller** | Handles short URL creation (`handleGenerateNewShortURL`) and analytics lookup (`handleGetAnalytics`). |
| [routes/](file:///c:/Users/vinee/wisdom/short-url-nodejs/routes) | **Router** | Maps endpoint paths (`/user`, `/url`, `/`) to corresponding controller functions. |
| [middlewares/auth.js](file:///c:/Users/vinee/wisdom/short-url-nodejs/middlewares/auth.js) | **Middleware** | Custom authentication and route restriction logic (`restrictToLoggedinUserOnly`, `checkAuth`). |
| [service/auth.js](file:///c:/Users/vinee/wisdom/short-url-nodejs/service/auth.js) | **Service/Store** | In-memory session store mapping Session UUIDs to User objects (`sessionIdToUserMap`). |

---

## 2. Comprehensive Request & Execution Flows

### Flow A: User Registration & Authentication (Signup & Login)

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Browser)
    participant Server as Express App (index.js)
    participant AuthCtrl as User Controller (user.js)
    participant DB as MongoDB (User Model)
    participant Service as Session Store (service/auth.js)

    %% Signup Process
    Note over User, DB: Registration Flow (POST /user)
    User->>Server: POST /user { name, email, password }
    Server->>AuthCtrl: handleUserSignup(req, res)
    AuthCtrl->>DB: User.create({ name, email, password })
    DB-->>AuthCtrl: User Created
    AuthCtrl-->>User: Redirect to GET /

    %% Login Process
    Note over User, Service: Authentication Flow (POST /user/login)
    User->>Server: POST /user/login { email, password }
    Server->>AuthCtrl: handleUserLogin(req, res)
    AuthCtrl->>DB: User.findOne({ email, password })
    alt Credentials Invalid
        DB-->>AuthCtrl: null
        AuthCtrl-->>User: Render login.ejs with Error
    else Credentials Valid
        DB-->>AuthCtrl: user Object
        AuthCtrl->>AuthCtrl: Generate UUID (sessionId)
        AuthCtrl->>Service: setUser(sessionId, user)
        AuthCtrl-->>User: Set-Cookie: uid=sessionId + Redirect to GET /
    end
```

#### Step-by-Step Explanation:
1. **Signup**: User submits credentials to `POST /user`. The controller creates a new document in MongoDB's `users` collection and redirects the client to `/`.
2. **Login**: User submits `POST /user/login`. Controller queries MongoDB for matching `email` and `password`.
3. **Session Creation**: If matched, a v4 UUID `sessionId` is generated.
4. **Session Mapping**: `setUser(sessionId, user)` saves `sessionId => user` inside `sessionIdToUserMap` (an in-memory `Map`).
5. **Cookie Response**: Server sends a `Set-Cookie` header storing `uid=<sessionId>` on the browser and redirects to `/`.

---

### Flow B: Authenticated Request Execution & Route Guarding

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Browser)
    participant CookieMW as cookie-parser Middleware
    participant AuthMW as Auth Middleware (auth.js)
    participant Service as Session Store (service/auth.js)
    participant Router as staticRouter / urlRouter
    participant DB as MongoDB (URL Model)
    participant EJS as Views (home.ejs)

    User->>CookieMW: GET / (Cookie: uid=sessionId)
    CookieMW->>AuthMW: req.cookies populated
    AuthMW->>Service: getUser(sessionId)
    
    alt Session Not Found / Expired
        Service-->>AuthMW: undefined
        AuthMW-->>User: Redirect /login (if restricted) or req.user = null
    else Session Valid
        Service-->>AuthMW: user Object
        AuthMW->>AuthMW: Attach req.user = user
        AuthMW->>Router: next()
        Router->>DB: URL.find({ createdBy: req.user._id })
        DB-->>Router: Array of User's URLs
        Router->>EJS: render("home", { urls })
        EJS-->>User: HTML Response
    end
```

#### Middleware Guard Breakdown:
- **`checkAuth`** (used on `/`): Soft check. Extracts `uid` cookie, retrieves user object if present, sets `req.user`. If invalid, `req.user` is undefined, and `staticRouter` redirects unauthenticated users to `/login`.
- **`restrictToLoggedinUserOnly`** (used on `/url`): Strict check. If `uid` cookie is missing or unmapped in `sessionIdToUserMap`, immediately halts request and redirects to `/login`.

---

### Flow C: URL Shortening & Custom Alias Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Browser)
    participant AuthMW as restrictToLoggedinUserOnly
    participant URLCtrl as URL Controller (url.js)
    participant DB as MongoDB (URL Model)

    User->>AuthMW: POST /url { url: "https://example.com", customAlias: "my-link" }
    AuthMW->>URLCtrl: Passes check (req.user populated)
    
    alt Custom Alias Provided
        URLCtrl->>DB: URL.findOne({ shortId: "my-link" })
        alt Alias Already Taken
            DB-->>URLCtrl: Existing Document Found
            URLCtrl-->>User: Render home.ejs with Error ("Custom alias taken")
        else Alias Available
            URLCtrl->>URLCtrl: shortID = "my-link"
        end
    else No Alias Provided
        URLCtrl->>URLCtrl: shortID = nanoid(8)
    end

    URLCtrl->>DB: URL.create({ shortId, redirectURL, visitHistory: [], createdBy: req.user._id })
    URLCtrl->>DB: URL.find({ createdBy: req.user._id })
    DB-->>URLCtrl: Updated URL List
    URLCtrl-->>User: Render home.ejs with new URL
```

---

### Flow D: URL Redirection & Analytics Tracking

```mermaid
sequenceDiagram
    autonumber
    actor User as Any Visitor
    participant App as Express (index.js)
    participant DB as MongoDB (URL Model)

    User->>App: GET /url/:shortId (e.g., GET /url/my-link)
    App->>DB: URL.findOneAndUpdate({ shortId }, { $push: { visitHistory: { timestamp } } })
    DB-->>App: Return original document (entry)
    App-->>User: HTTP 302 Redirect to entry.redirectURL
```

---

## 3. Security Architecture & Threat Analysis

### Current Security Posture Summary

```
                       SECURITY LANDSCAPE
┌──────────────────────────────────────────────────────────────┐
│  Authentication : Cookie-based Stateful Session ID (UUID v4) │
│  Authorization  : Scope-based querying (createdBy filter)   │
│  State Store    : Node.js In-Memory JS Map                   │
│  Transport      : HTTP / Plain Cookie                        │
└──────────────────────────────────────────────────────────────┘
```

---

### Critical Vulnerabilities & Architectural Risks

#### 1. Plain-Text Passwords (High Severity 🔴)
- **Vulnerability**: Passwords are saved in plain text in `controllers/user.js` during registration (`User.create({ name, email, password })`).
- **Impact**: If MongoDB is compromised or read access is leaked, all user accounts and raw credentials are fully exposed.
- **Remediation**: Use `bcryptjs` or `argon2` to salt and hash passwords before DB insertion:
  ```javascript
  const hashedPassword = await bcrypt.hash(password, 10);
  ```

#### 2. In-Memory Stateful Session Storage (Medium/High Severity 🟠)
- **Vulnerability**: `sessionIdToUserMap` lives inside `service/auth.js` in Node.js process memory.
- **Impact**:
  - **Data Loss**: Restarting or crashing the Node process invalidates all logged-in user sessions.
  - **Memory Leak**: The `Map` grows indefinitely without expiration/cleanup mechanisms, leading to `ERR_OUT_OF_MEMORY`.
  - **Horizontal Scaling Failure**: Cannot scale to multiple server instances/cluster mode as sessions aren't shared across processes.
- **Remediation**: Transition to **JWT (JSON Web Tokens)** (stateless) or **Redis / Connect-Mongo** (persistent session store).

#### 3. Insecure Cookie Configurations (Medium Severity 🟠)
- **Vulnerability**: `res.cookie("uid", sessionId)` in `controllers/user.js` sets plain cookies without flags.
- **Impact**:
  - Missing `HttpOnly`: Client-side scripts can read `document.cookie`, opening vectors to XSS session theft.
  - Missing `SameSite`: Risk of Cross-Site Request Forgery (CSRF) attacks.
  - Missing `Secure`: Cookies are transmitted in cleartext over HTTP.
- **Remediation**: Set cookie parameters explicitly:
  ```javascript
  res.cookie("uid", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });
  ```

#### 4. Hardcoded Credentials & Missing Environment Variables (High Severity 🔴)
- **Vulnerability**: Connection string in `index.js` contains hardcoded MongoDB Atlas credentials (`mongodb+srv://harry123:harry123xx@...`).
- **Impact**: Credentials checked into source control (Git) expose database cluster to unauthorized remote access.
- **Remediation**: Use `dotenv` package and reference `process.env.MONGO_URL`.

#### 5. Broken Object Level Authorization (BOLA) on Analytics (Medium Severity 🟠)
- **Vulnerability**: In `controllers/url.js`, `handleGetAnalytics` queries `URL.findOne({ shortId })` without checking `createdBy: req.user._id`.
- **Impact**: Any authenticated user can view analytics for short IDs created by other users by querying `/url/analytics/:shortId`.
- **Remediation**: Add owner verification in analytics lookup:
  ```javascript
  const result = await URL.findOne({ shortId, createdBy: req.user._id });
  ```

#### 6. Missing Input Validation & Open Redirect / SSRF Vulnerabilities (Medium Severity 🟠)
- **Vulnerability**: `handleGenerateNewShortURL` does not validate `body.url` format or protocol (e.g. allowing `javascript:alert(1)` or internal local IPs `http://127.0.0.1`).
- **Impact**: Can lead to malicious redirects or cross-site scripting when redirected.
- **Remediation**: Validate incoming URLs using standard URL parsers and enforce HTTP/HTTPS protocols.

---

## 4. Hardened Architecture Recommendation

```
 ┌────────────────┐         ┌───────────────────────┐         ┌───────────────────┐
 │ Browser Client │ ──────> │ Express App / Server  │ ──────> │  MongoDB Atlas    │
 └───────┬────────┘         └───────────┬───────────┘         └───────────────────┘
         │                              │
  Secure, HttpOnly               JWT Secret / Redis
  SameSite Cookie                  Session Store
```

1. **Password Hashing**: Hash user passwords using `bcrypt` (cost factor 10+).
2. **Stateless JWT Authorization**: Encode user `_id` and `email` inside a signed JWT token stored in an `HttpOnly` cookie.
3. **Environment Security**: Isolate DB strings and secrets in `.env`.
4. **Input Validation & Sanitization**: Enforce string sanitization and schema validation (e.g., using `zod` or `joi`).
5. **Strict Authorization Guards**: Ensure every endpoint requiring data enforces both Authentication (Who are you?) and Authorization (Do you own this resource?).

---
*Documented for repository `short-url-nodejs`.*

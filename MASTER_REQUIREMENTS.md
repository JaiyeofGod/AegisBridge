# AegisBridge Security Operations & GRC Platform

## Master Requirements, Architecture, Dataset, Hosting, Cyber-Range, and Development Specification

**Document version:** 2.0  
**Planning baseline:** October 19, 2026  
**Project type:** Enterprise Cybersecurity / SOC / GRC / Vulnerability Management / Detection Engineering / Incident Response / DevSecOps portfolio environment  
**Primary development workstation:** macOS + Cursor IDE  
**Primary cyber-range host:** Lenovo workstation/laptop (target 16–32 GB RAM, high-core-count CPU; exact hardware to be verified)  
**Public application hosting:** Render  
**Object/evidence storage:** Cloudflare R2  
**Source control and CI/CD:** GitHub + GitHub Actions

> **Purpose of this document:** This is the authoritative engineering and security plan for AegisBridge. Cursor should treat it as the design baseline and should not make major architectural changes without recording an Architecture Decision Record (ADR).

---

# Part I — Vision, Scope, and Operating Model

## 1. Executive Decision

AegisBridge will be built as a **browser-based enterprise cybersecurity platform** connected to a separate, isolated **cyber range**. It will not be a native desktop application in its primary form. A web application provides cross-platform access from macOS, Windows, and Linux while allowing one codebase, a proper API architecture, role-based access control, centralized data, and professional deployment practices.

The solution has two tightly integrated components:

### Component A — AegisBridge Security Platform

A full-stack web application used by fictional enterprise security roles such as:

- CISO
- GRC Analyst
- SOC Analyst
- Security Engineer
- Auditor
- IT Administrator
- Read-Only stakeholder

The platform will manage:

- enterprise assets
- software inventory
- data assets and classifications
- business processes
- risk assessments
- control frameworks and mappings
- security control implementations
- policies and policy versions
- audit/control evidence
- IAM and access reviews
- vulnerabilities
- CVE/CVSS/EPSS/KEV/SSVC enrichment
- threat intelligence
- detection engineering
- MITRE ATT&CK coverage
- SOC alert references
- investigations
- incidents
- remediation tasks
- vendor risk
- security metrics
- executive reporting
- dataset and research registry
- DevSecOps security findings
- audit history

### Component B — AegisBridge Cyber Range

An isolated virtual enterprise environment that produces real security telemetry. It will eventually contain:

- Windows 11 endpoint
- Ubuntu/Linux application server
- Wazuh SIEM/XDR server
- Linux routing/firewall/security gateway
- Suricata NIDS
- Kali Linux authorized validation workstation
- optional additional Windows/Linux endpoints
- optional directory-services environment
- optional Velociraptor DFIR environment

Wazuh remains the authoritative platform for raw security telemetry. AegisBridge consumes **summaries, findings, state, references, and selected normalized data**, rather than attempting to become a second SIEM.

---

## 2. Plain-Language Description

AegisBridge is a miniature enterprise cybersecurity department in software. The fictional company will have employees, computers, servers, applications, business data, security risks, vulnerabilities, controls, policies, alerts, and incidents. The web platform will let a user see what the organization owns, what can go wrong, which controls exist, which weaknesses need attention, what suspicious activity has happened, what incidents are being investigated, and whether security is improving.

The cyber range makes the project more than a dashboard. Windows, Linux, Kali, Wazuh, Sysmon, and Suricata will create real telemetry that can be investigated and connected back to risks, controls, vulnerabilities, evidence, and incidents. This forces the project owner to practice the thinking of a GRC analyst, SOC analyst, security engineer, vulnerability analyst, incident responder, and security architect in one coherent environment.

---

## 3. Project Goals

The project must demonstrate that the builder can:

1. understand a business and identify what must be protected;
2. inventory assets, software, identities, and data;
3. identify threats and enterprise risks;
4. select and map appropriate controls;
5. implement technical controls in a lab;
6. collect defensible evidence that controls exist;
7. ingest current vulnerability intelligence;
8. prioritize vulnerabilities using exploitation and business context;
9. collect endpoint and network telemetry;
10. engineer and validate detections;
11. investigate suspicious activity;
12. manage incidents from triage through lessons learned;
13. conduct access reviews and basic segregation-of-duties analysis;
14. build security metrics for technical and executive audiences;
15. apply secure software development practices to AegisBridge itself;
16. deploy and operate a real web application securely;
17. document decisions in a professional engineering workflow.

---

## 4. Non-Goals

AegisBridge will **not** attempt to:

- replace a commercial SIEM;
- become a malware execution platform;
- become a full vulnerability scanner from scratch;
- become an enterprise IAM provider;
- recreate every NIST or CIS product;
- download or execute malware automatically;
- copy licensed framework content without redistribution rights;
- run offensive activity against systems not owned/authorized for the project;
- become primarily an ML research project;
- become primarily a pentesting project;
- store massive raw telemetry in PostgreSQL;
- download every available security dataset.

---

## 5. Fictional Organization

**Organization:** AegisBridge Technologies  
**Industry:** B2B technology / SaaS services  
**Size:** Approximately 120 employees

Departments:

- Executive
- Information Technology
- Cybersecurity
- Software Engineering
- Human Resources
- Finance
- Sales
- Customer Support
- Legal / Compliance

Primary business assets:

- customer information
- employee PII
- source code
- intellectual property
- customer SaaS application
- identity/authentication systems
- financial records
- HR records
- backups
- administrative credentials
- security telemetry

Data classifications:

1. Public
2. Internal
3. Confidential
4. Restricted

The fictional organization intentionally begins with incomplete controls and measurable security gaps. The project documents its improvement over time.

---

## 6. Primary User Roles

### Administrator

Manages platform configuration, users, roles, integrations, and system settings.

### CISO

Views executive security posture, enterprise risks, control maturity, remediation performance, major incidents, and key metrics.

### GRC Analyst

Manages risks, controls, framework mappings, policies, evidence, assessments, exceptions, and audit readiness.

### SOC Analyst

Reviews alerts, detections, ATT&CK mappings, investigations, incidents, and security telemetry summaries.

### Security Engineer

Manages detections, integrations, endpoint/network control configuration, vulnerability remediation, and technical evidence.

### Auditor

Reads control implementations, evidence, policies, test results, and audit history without unrestricted administrative access.

### Read Only

Views approved non-sensitive dashboards and records.

---

## 7. Portfolio Roles Supported

The completed project should provide interview material for:

- Cybersecurity Analyst
- Security Analyst
- SOC Analyst
- GRC Analyst
- Cyber Risk Analyst
- Security Compliance Analyst
- Vulnerability Management Analyst
- IAM Analyst
- Security Engineer
- Junior Detection Engineer
- Security Operations Engineer
- DevSecOps / Product Security entry roles

---

# Part II — Governance, Standards, and Framework Strategy

## 8. Primary Cybersecurity Framework

Use **NIST Cybersecurity Framework 2.0** as the top-level organizational framework.

Functions:

- Govern
- Identify
- Protect
- Detect
- Respond
- Recover

Maintain:

- Current Profile
- Target Profile
- gap analysis
- prioritized improvement plan

Use NIST machine-readable material whenever practical rather than manually retyping the complete framework.

---

## 9. Implementation Framework

Use **CIS Controls v8.1** to guide concrete security practices.

Initial implementation target:

- Implementation Group 1 (IG1)

Selected IG2 safeguards may be introduced later.

Do not claim full CIS compliance merely because safeguards are mapped. Public GitHub content should store identifiers, implementation status, evidence, internal notes, and mappings rather than republishing licensed material inappropriately.

---

## 10. Detailed Control Catalog

Use selected controls from **NIST SP 800-53 Rev. 5** and current official OSCAL content.

Priority families:

- AC — Access Control
- AT — Awareness and Training
- AU — Audit and Accountability
- CA — Assessment, Authorization, and Monitoring
- CM — Configuration Management
- CP — Contingency Planning
- IA — Identification and Authentication
- IR — Incident Response
- RA — Risk Assessment
- SA — System and Services Acquisition
- SC — System and Communications Protection
- SI — System and Information Integrity
- SR — Supply Chain Risk Management

Do not attempt to implement every control.

---

## 11. Incident Response Standard

Use **NIST SP 800-61 Revision 3** as the incident-response baseline. Incident response must connect back to organization risk, governance, control failures, and continuous improvement.

---

## 12. Threat and Detection Framework

Use **MITRE ATT&CK Enterprise v20.0**, released October 13, 2026, as the pinned threat-framework baseline.

Use official STIX 2.1 data and record the ATT&CK version used for every imported dataset or detection mapping. Do not silently switch to `latest`.

---

## 13. Application Security Standard

Use **OWASP ASVS 5.0.0** as the application-security verification baseline.

Target a meaningful subset of **ASVS Level 2** requirements covering:

- authentication
- session management
- authorization
- input validation
- API security
- file handling
- cryptography
- data protection
- logging
- configuration

Also review AegisBridge against **OWASP Top 10:2025**.

---

## 14. Secure Development Framework

Use **NIST SP 800-218 Secure Software Development Framework (SSDF) v1.1** as the stable baseline.

Core themes:

- prepare the organization
- protect software
- produce well-secured software
- respond to vulnerabilities

---

## 15. Vulnerability Prioritization Framework

Do not create a single fake universal score by simply adding CVSS, EPSS, and business points.

Preserve distinct dimensions:

- CVSS — technical severity
- EPSS — probability of exploitation
- CISA KEV — evidence of exploitation in the wild
- asset criticality — business importance
- external exposure — attackability
- mitigating controls — defensive context
- SSVC — action-oriented prioritization

Use **CISA SSVC** as the primary remediation decision framework, with an AegisBridge-specific internal SLA policy layered on top.

---

# Part III — Product Architecture

## 16. Architectural Style

AegisBridge will be a modular full-stack web application with a REST API and background processing.

Primary architecture:

```text
Browser
   |
   | HTTPS
   v
React / TypeScript Web UI
   |
   | REST/JSON
   v
FastAPI Application API
   |
   +-----------------------------+
   |              |              |
PostgreSQL    Job Queue      Object Storage
               / Redis          / R2
   |
Background Workers / Scheduled Jobs
   |
External Intelligence + Lab Connector
```

---

## 17. Architecture Planes

Treat the system as seven planes.

### Plane 1 — Presentation

React/TypeScript user interface.

### Plane 2 — Application / Control

FastAPI business logic and REST API.

### Plane 3 — Security Program Data

PostgreSQL structured application data.

### Plane 4 — Asynchronous Processing

Celery + Redis-compatible queue and scheduled ingestion jobs.

### Plane 5 — Integration and Intelligence

NVD, EPSS, KEV, ATT&CK, OSV, Wazuh, and optional threat feeds.

### Plane 6 — Telemetry and Security Operations

Wazuh and Suricata retain raw security telemetry.

### Plane 7 — Cyber Range

Isolated Windows, Linux, gateway, and Kali systems that generate authentic security events.

---

## 18. Critical Separation of Responsibilities

AegisBridge PostgreSQL stores:

- assets
- risks
- controls
- mappings
- evidence metadata
- vulnerabilities and enrichment
- detections
- incidents
- audit history
- normalized integration snapshots

Wazuh stores/query raw security events.

Cloudflare R2 stores unstructured objects such as:

- uploaded evidence
- generated reports
- sanitized exports
- screenshots
- selected research artifacts

Raw datasets and large PCAPs remain local by default.

---

## 19. Core Technology Stack

### Frontend

- React 19.3
- TypeScript
- Vite 8
- React Router
- TanStack Query
- TanStack Table
- Tailwind CSS
- shadcn/ui
- Recharts
- Zod for selected frontend validation

### Backend

- Python 3.14.x as initial compatibility baseline
- FastAPI
- Pydantic 2
- SQLAlchemy 2
- Alembic
- HTTPX
- Celery
- PostgreSQL driver (`psycopg`)

Python 3.15.0 is stable as of October 9, 2026, but because it is very new, AegisBridge should begin on Python 3.14.x and move to 3.15 only after the dependency/test matrix passes.

### Runtime / Tooling

- Node.js 24 LTS
- npm or pnpm (choose one in ADR; recommended: pnpm)
- Docker
- Docker Compose
- Git
- GitHub

### Database

- PostgreSQL 18

Do not begin production on PostgreSQL 19 release candidates.

### Queue / Cache

- Redis-compatible client
- Render Key Value in hosted environment (currently Valkey-backed for new instances)

### Object Storage

- Cloudflare R2 (S3-compatible API)
- MinIO locally for S3-compatible development/testing

---

## 20. Why Web App Instead of Native Desktop

A browser-based product is the primary implementation because it:

- works on Mac, Windows, and Linux;
- centralizes data and authorization;
- avoids separate installer/update systems;
- better reflects enterprise security software;
- supports cloud deployment;
- supports local deployment through Docker;
- allows future desktop wrapping if desired.

A desktop shell using Tauri may be explored later, but it must wrap the web application rather than fork the platform architecture.

---

# Part IV — Development, Hardware, and Environment Strategy

## 21. Development Workstation — Mac

The Mac is the **primary development machine**.

Use it for:

- Cursor IDE
- Git/GitHub
- frontend development
- FastAPI development
- local PostgreSQL/Redis via Docker
- local MinIO
- API tests
- unit/integration tests
- UI design
- documentation
- small research notebooks

The Mac does not need to run the entire cyber range.

---

## 22. Cyber-Range Host — Lenovo

The Lenovo is the **heavy lab machine**.

The user reports approximately 27 logical CPU cores and either 16 GB or 32 GB RAM. Exact specifications must be verified before final VM allocations.

Use it for:

- Wazuh VM/server
- Windows VM
- Ubuntu/Linux VM
- Kali VM
- gateway/Suricata VM
- lab datasets
- PCAPs
- snapshots

No Cursor license is required on the Lenovo for the normal workflow.

---

## 23. Mac-to-Lenovo Development Workflow

```text
Mac + Cursor
    |
    | git push
    v
GitHub
    |
    | git pull / clone
    v
Lenovo Lab Host
```

The Mac builds the platform. The Lenovo runs the heavy security environment.

---

## 24. Source Portability

The application must remain portable across:

- macOS development
- Linux development
- Kali Linux
- Ubuntu
- hosted Render services

Use Docker Compose and architecture-neutral source code. Where container images are published, support `linux/amd64` and `linux/arm64` when practical.

---

## 25. Hardware Resource Profiles

### If Lenovo has 16 GB RAM

Use staged VM operation. Example:

- Wazuh: 5–6 GB
- Windows: 4–5 GB
- Gateway/Suricata: 1–2 GB
- host reserve: 3–4 GB
- start Kali or Linux server only when another VM is stopped if necessary

### If Lenovo has 32 GB RAM

Recommended baseline:

- Wazuh: 8 GB
- Windows: 6 GB
- Linux App Server: 3–4 GB
- Gateway/Suricata: 2–3 GB
- Kali: 4 GB
- host reserve: 6+ GB

### Storage

Recommended free lab storage:

- minimum practical: 250 GB
- recommended: 500 GB
- ideal: 1 TB+

A fast external SSD (1–2 TB) is highly useful for:

- VM disks
- snapshots
- PCAP files
- research datasets
- forensic exports
- lab backups

---

## 26. Software Environments

Maintain four application environments plus one lab environment.

### Local Development

Mac + Docker Compose.

### Automated Test

Ephemeral services used by CI and local test suites.

### Staging

Separate Render services/database/object bucket used to test deployments when the project reaches hosting phase.

### Production / Portfolio Demo

Public Render deployment with sanitized/synthetic demo data.

### Cyber Range

Private Lenovo-hosted VMs. Never considered public production infrastructure.

---

# Part V — Hosting and Public Deployment

## 27. Hosting Decision

Use **Render** as the primary public application hosting platform.

Render is selected because the AegisBridge architecture maps naturally to its service types:

- static site for React
- web service for FastAPI
- background worker for Celery
- cron jobs for periodic ingestion
- managed PostgreSQL
- Redis-compatible Key Value
- Blueprint infrastructure-as-code through `render.yaml`

The goal is one coherent hosting model rather than splitting every service across unrelated vendors.

---

## 28. Public Hosting Topology

```text
Internet
   |
   v
Render Static Site — React
   |
   | HTTPS
   v
Render Web Service — FastAPI
   |
   +----------------------+----------------------+
   |                      |                      |
Render Postgres     Render Key Value      Cloudflare R2
   |                      |                      |
   +--------------- Render Worker ---------------+
                          |
                          +--> NVD
                          +--> EPSS
                          +--> CISA KEV
                          +--> ATT&CK
                          +--> OSV
                          +--> Lab Sync Ingestion
```

---

## 29. Render Service Layout

Initial hosted resources:

1. `aegis-web` — Render Static Site
2. `aegis-api` — Render Web Service
3. `aegis-worker` — Render Background Worker
4. `aegis-postgres` — Render Postgres 18
5. `aegis-kv` — Render Key Value
6. `aegis-sync-kev` — Render Cron Job
7. `aegis-sync-epss` — Render Cron Job
8. `aegis-sync-nvd` — Render Cron Job or queued incremental worker

ATT&CK updates should be version-aware/manual rather than silently scheduled to newest.

Use one `render.yaml` Blueprint to describe deployable resources.

---

## 30. Object Storage Decision

Use **Cloudflare R2** for hosted evidence and report objects.

Reasons:

- S3-compatible API
- easy Python SDK compatibility
- avoids tying file objects to container disks
- appropriate for unstructured evidence artifacts
- independent from web-service lifecycle

Use separate buckets:

```text
aegis-prod-evidence
aegis-stage-evidence
```

Optional later:

```text
aegis-public-reports
```

---

## 31. Local Object Storage

Use **MinIO** in local Docker Compose to emulate the S3-compatible object-storage interface.

This allows the same backend storage abstraction to target:

- MinIO locally
- Cloudflare R2 in staging/production

Do not hardcode Cloudflare-specific calls throughout the application.

---

## 32. Custom Domain and TLS

Future domain pattern:

```text
app.<domain>
api.<domain>
```

or a single-origin deployment where `/api` is proxied to the backend.

Preferred production behavior:

- HTTPS only
- HSTS after stable HTTPS configuration
- secure cookies
- no mixed content
- restrictive CORS

A custom domain is optional until the portfolio demo is mature.

---

## 33. Public Demo Mode

The public hosted application must have a **Demo Mode**.

Demo Mode rules:

- seeded fictional AegisBridge data only;
- no personal information;
- no live credentials;
- no raw private lab logs;
- no destructive actions for anonymous/read-only visitors;
- obvious label that the organization is synthetic;
- last-lab-sync and data-source labels shown clearly.

The private administrator interface remains authenticated.

---

## 34. Local Lab to Cloud Connectivity

Do **not** expose Wazuh port 55000, the Wazuh dashboard, RDP, SSH, or lab subnets directly to the public internet.

Instead build an `aegis-lab-bridge` service on the Lenovo.

Workflow:

```text
Local Wazuh API
      |
      v
Aegis Lab Bridge
      |
      | outbound HTTPS only
      v
Hosted Aegis API /api/v1/lab-sync
```

The bridge should:

- query approved local Wazuh endpoints;
- normalize only required data;
- remove secrets/sensitive raw fields;
- push summaries outbound;
- sign/authenticate sync requests;
- retry safely;
- record last successful sync;
- queue when the internet is unavailable if practical.

The hosted application must continue working when the lab is powered off.

---

## 35. Lab Bridge Authentication

Initial design:

- dedicated integration credential
- rotated API token stored in secrets
- HTTPS/TLS required
- request timestamp
- replay resistance
- source integration ID

Advanced option:

- mutual TLS (mTLS)

Do not reuse a human administrator password for machine-to-machine synchronization.

---

# Part VI — API and Integration Strategy

## 36. AegisBridge Internal API

FastAPI will expose versioned routes:

```text
/api/v1/auth
/api/v1/users
/api/v1/organizations
/api/v1/assets
/api/v1/software
/api/v1/data-assets
/api/v1/risks
/api/v1/frameworks
/api/v1/controls
/api/v1/evidence
/api/v1/iam
/api/v1/policies
/api/v1/vendors
/api/v1/vulnerabilities
/api/v1/intelligence
/api/v1/detections
/api/v1/attack
/api/v1/alerts
/api/v1/investigations
/api/v1/incidents
/api/v1/datasets
/api/v1/reports
/api/v1/integrations
/api/v1/metrics
/api/v1/lab-sync
/api/v1/audit
/api/v1/health
```

FastAPI's OpenAPI schema will document the internal API.

---

## 37. Required External API — NVD CVE API 2.0

Use NVD vulnerability APIs for:

- CVE records
- CVSS vectors/scores
- CWE references
- affected product/configuration data
- reference URLs

Requirements:

- optional NVD API key
- caching
- pagination
- incremental synchronization
- rate-limit awareness
- retries/backoff
- source timestamps

Do not mirror the entire NVD into the repository.

---

## 38. Required External API — FIRST EPSS

Use FIRST EPSS for:

- exploitation probability
- percentile
- historical date when required

For bulk daily ingestion, prefer the daily EPSS data file instead of thousands of one-by-one requests.

---

## 39. Required External Source — CISA KEV

Use the CISA Known Exploited Vulnerabilities Catalog in JSON/CSV form.

Store:

- CVE
- vendor/project
- product
- vulnerability name
- date added
- due date
- required action
- known ransomware campaign use when provided

KEV status is a separate fact, not an additive risk score.

---

## 40. Required External Source — MITRE ATT&CK

Use official ATT&CK STIX 2.1 content as the reproducible primary source.

Optional live access:

- MITRE TAXII 2.1

Store imported version metadata and do not automatically overwrite mappings when a new ATT&CK release appears.

---

## 41. Required External API — Wazuh Server API

Use Wazuh Server API for selected defensive integration such as:

- agent status
- agent inventory
- Syscollector information
- FIM metadata
- SCA results
- rules
- manager overview
- selected MITRE metadata
- rule test/logtest where appropriate

Default manager API is accessed over HTTPS on TCP 55000.

Do not use the cloud app to directly administer a home-lab Wazuh instance over the public internet.

---

## 42. Required DevSecOps API — OSV

Use **OSV.dev API** for open-source package vulnerability intelligence when building the DevSecOps module.

Use cases:

- query package + version
- batch package queries
- retrieve OSV vulnerability records

OSV complements NVD for package-centric dependency analysis.

---

## 43. Required Hosted Storage API — R2 S3 Compatibility

Use the Cloudflare R2 S3-compatible API for:

- evidence upload
- report upload
- object retrieval
- presigned URLs
- metadata

The application should communicate through an internal storage abstraction so local MinIO and hosted R2 use the same interface pattern.

---

## 44. Optional API — GitHub REST API

Add later to enrich the DevSecOps module with repository security information where plan permissions allow:

- code-scanning alerts
- dependency alerts
- secret-scanning alerts
- workflow status

The project must still work without GitHub security APIs.

---

## 45. Optional Threat Intelligence APIs

Later integrations may include:

### URLhaus

Purpose: malicious URL metadata.

### ThreatFox

Purpose: IOC metadata.

Rules:

- store indicators and metadata;
- do not automatically retrieve malware binaries;
- record source and retrieval timestamps;
- respect source terms/licensing.

---

## 46. Integration Reliability Standard

Every external client must implement:

- explicit timeout
- retries
- exponential backoff with jitter
- rate-limit handling
- pagination
- schema validation
- structured error handling
- source timestamp
- last-success timestamp
- last-failure status
- cache
- idempotent upserts
- health status

An external API outage must not make the whole AegisBridge application unavailable.

---

## 47. Synchronization Schedule

Suggested lab schedule:

| Source | Frequency | Method |
|---|---:|---|
| EPSS | Daily | bulk file/API |
| CISA KEV | Every 6 hours or daily | JSON |
| NVD | Incremental several times/day | API 2.0 |
| ATT&CK | Manual/version-aware | STIX/TAXII |
| OSV | On dependency scan / scheduled | API |
| Wazuh agent state | Every 5 min while lab is online | local bridge |
| Wazuh selected findings | Every 5–15 min | local bridge |

These are AegisBridge operational choices, not mandates from the source organizations.

---

# Part VII — Data Architecture

## 48. Database Decision

Use **PostgreSQL 18** as the authoritative relational database.

CSV/JSON remain useful for:

- import/export
- framework source files
- research datasets
- sample fixtures

They are not the main application datastore.

---

## 49. Core Relational Domains

### Organization

```text
organizations
departments
business_processes
```

### Identity and Authorization

```text
users
roles
permissions
user_roles
sessions
api_credentials
access_entitlements
access_reviews
access_review_findings
```

### Assets

```text
assets
asset_types
asset_owners
software_products
asset_software
data_assets
asset_data_relationships
```

### Risks

```text
risks
risk_assessments
risk_treatments
risk_reviews
```

### Frameworks and Controls

```text
frameworks
framework_versions
controls
control_mappings
control_implementations
control_tests
control_findings
```

### Evidence

```text
evidence
evidence_objects
evidence_control_links
evidence_risk_links
evidence_incident_links
```

### Vulnerabilities

```text
vulnerabilities
cve_records
asset_vulnerabilities
epss_snapshots
kev_records
ssvc_assessments
remediation_tasks
vulnerability_exceptions
```

### Detection and ATT&CK

```text
detections
detection_versions
attack_techniques
detection_attack_mappings
validation_runs
```

### SOC

```text
alert_references
investigations
investigation_notes
```

### Incident Response

```text
incidents
incident_events
incident_tasks
incident_indicators
incident_evidence
```

### Policy

```text
policies
policy_versions
policy_approvals
policy_acknowledgements
```

### Vendors

```text
vendors
vendor_services
vendor_assessments
vendor_findings
```

### Research

```text
datasets
dataset_versions
dataset_files
dataset_experiments
```

### Integrations

```text
integrations
sync_jobs
sync_states
integration_health
```

### Audit

```text
audit_events
```

---

## 50. Human-Readable IDs

Use UUID primary keys internally and display IDs such as:

```text
AST-0001
RISK-0001
CTRL-0001
EVID-0001
VULN-0001
DET-0001
INC-0001
POL-0001
VEN-0001
DS-0001
```

Never use sequential display IDs as authentication or access-control boundaries.

---

## 51. Asset Inventory Fields

Minimum asset fields:

```text
asset_id
hostname
asset_name
asset_type
environment
department
business_owner
technical_owner
operating_system
os_version
ip_address
criticality
data_classification
internet_exposed
security_zone
wazuh_agent_status
edr_status
backup_status
encryption_status
last_seen
lifecycle_state
```

Criticality:

- Low
- Medium
- High
- Critical

Lifecycle:

- Planned
- Active
- Maintenance
- Retiring
- Retired

---

## 52. Enterprise Risk Model

Likelihood:

1. Rare
2. Unlikely
3. Possible
4. Likely
5. Almost Certain

Impact:

1. Insignificant
2. Minor
3. Moderate
4. Major
5. Severe

Internal inherent-risk matrix:

```text
Likelihood × Impact
```

This is explicitly an **AegisBridge internal methodology**, not a formula mandated by NIST.

Required risk fields:

```text
risk_id
title
asset_or_process
threat
vulnerability
scenario
likelihood
impact
inherent_score
existing_controls
control_effectiveness
treatment
owner
target_date
residual_likelihood
residual_impact
residual_score
status
```

Treatments:

- Accept
- Avoid
- Mitigate
- Transfer

---

## 53. Initial Seed Risk Register

Seed approximately 20 clearly labeled synthetic risks, such as:

- privileged accounts without MFA
- incomplete asset inventory
- insufficient centralized logging
- unpatched critical vulnerabilities
- excessive administrator permissions
- terminated identity still enabled
- untested backup recovery
- incomplete incident-response process
- PowerShell activity not monitored
- sensitive endpoint data not encrypted
- unsupported software
- inadequate network monitoring
- third-party access risk
- weak security-awareness process
- broad sensitive-file permissions
- exposed administrative service
- missing software inventory
- incomplete vulnerability SLA ownership
- insufficient change control
- secrets stored in source code

---

## 54. Evidence as a First-Class Object

Each evidence record contains:

```text
evidence_id
title
evidence_type
source
collector
collected_at
classification
object_storage_key
sha256
content_type
size_bytes
description
```

Evidence can link to:

- controls
- risks
- incidents
- vulnerabilities
- access reviews

Original evidence objects must not be silently overwritten.

---

## 55. Evidence Integrity

For each uploaded artifact:

- calculate SHA-256;
- preserve collection timestamp;
- preserve collector/source;
- record MIME type and object size;
- create a new version rather than overwriting an existing evidentiary item;
- use authorization before generating download URLs.

This teaches basic integrity and chain-of-custody concepts without pretending the system is a full forensic evidence-management product.

---

## 56. Data Retention Strategy

Initial lab policy:

| Data | Default Retention |
|---|---:|
| Wazuh raw lab telemetry | 30–90 days depending storage |
| Suricata raw EVE | 30 days or summarized |
| Aegis audit log | long-lived |
| Incidents | long-lived |
| Risk/control history | long-lived |
| Evidence metadata | long-lived |
| Evidence objects | retained unless explicitly removed by policy |
| API cache | source-specific TTL |
| raw research datasets | local, project-dependent |

Do not claim these are regulatory retention requirements; they are project defaults.

---

# Part VIII — Application Modules

## 57. Executive Dashboard

Show:

- critical/high risks
- residual-risk trend
- control implementation rate
- overdue control tests
- critical asset exposure
- open vulnerabilities
- KEV exposure
- SSVC Act/Attend queue
- open incidents
- MTTD/MTTR
- IAM review findings
- security maturity trend
- last lab sync

No dashboard number may be hardcoded.

---

## 58. Asset Management

Capabilities:

- create/edit assets
- assign owners
- classify criticality
- link software
- link data assets
- mark internet exposure
- link Wazuh agent identity
- search/filter
- bulk import/export
- asset history

---

## 59. Risk Management

Capabilities:

- create risk
- score inherent risk
- link assets/processes
- link controls
- assign owner
- select treatment
- record acceptance rationale
- set target dates
- calculate residual risk
- review history
- overdue reminders

---

## 60. GRC / Framework Module

Capabilities:

- framework list/version
- NIST CSF current profile
- NIST CSF target profile
- selected NIST 800-53 controls
- CIS identifiers/mappings
- implementation status
- control owner
- control test frequency
- evidence links
- findings
- remediation status

Statuses:

- Implemented
- Partially Implemented
- Planned
- Not Implemented
- Not Applicable

---

## 61. Policy Management

Policies:

1. Information Security
2. Access Control
3. Acceptable Use
4. Logging and Monitoring
5. Vulnerability Management
6. Incident Response
7. Data Classification
8. Backup and Recovery
9. Change Management
10. Third-Party Risk
11. Secure Development

Each policy includes:

- purpose
- scope
- definitions
- roles
- requirements
- exceptions
- enforcement
- review cycle
- related controls
- version history
- approval state

---

## 62. IAM and Access Review

Create approximately 40 fictional identities.

Fields:

```text
employee_id
name
department
manager
employment_status
role
account_status
mfa_status
privileged
last_login
```

Seed issues such as:

- terminated user still active
- dormant account
- excessive admin rights
- missing MFA
- shared account
- conflicting finance permissions
- inappropriate HR access
- unused privileged account

Generate formal access-review findings and remediation tasks.

---

## 63. Segregation of Duties

Example conflict:

```text
Create Vendor
+ Approve Vendor Payment
```

Track:

- conflict
- affected user
- business justification
- risk
- compensating control
- owner
- remediation
- exception expiry

---

## 64. Vulnerability Management

Lifecycle:

```text
Discover
  -> Validate
  -> Enrich
  -> Prioritize
  -> Assign
  -> Remediate
  -> Verify
  -> Close
```

Each finding links to:

- asset
- CVE
- technical evidence
- CVSS
- EPSS
- KEV
- SSVC assessment
- owner
- SLA
- exception if any
- remediation verification

---

## 65. Vulnerability SLA Policy

Example **internal lab policy**:

| SSVC outcome | Target |
|---|---:|
| Act | 72 hours |
| Attend | 7 days |
| Track* | 30 days |
| Track | monitor/review |

This is an AegisBridge policy, not a CISA mandate.

---

## 66. Threat Intelligence

Required intelligence domains:

- CVE intelligence
- exploitation probability
- known exploitation
- ATT&CK adversary behavior

Optional:

- malicious URLs
- domains
- hashes
- IOC metadata

No default malware binary retrieval.

---

## 67. Detection Engineering

Each detection record includes:

```text
detection_id
name
description
status
log_source
data_requirement
severity
attack_tactic
attack_technique
sigma_path
wazuh_rule_path
false_positive_notes
test_procedure
last_validated
owner
```

Lifecycle:

- Draft
- Testing
- Production
- Tuning
- Deprecated

---

## 68. Initial Detection Set

At minimum:

1. repeated authentication failures
2. new privileged account
3. administrator-group membership change
4. suspicious PowerShell
5. suspicious scheduled task
6. service installation
7. logging/security-tool tampering
8. executable from suspicious user directory
9. unusual outbound connection
10. sensitive file modification
11. Linux privilege-escalation indicator
12. suspicious SSH activity

Each must be validated before being marked Production.

---

## 69. Sigma and Wazuh Rule Strategy

Use two layers:

### Sigma

Vendor-neutral detection description stored in:

```text
detections/sigma/
```

### Wazuh

Operational implementation stored in:

```text
detections/wazuh/
```

Conversion does not equal validation. A converted rule must be tested against expected telemetry.

---

## 70. Detection Validation

Use controlled Atomic Red Team tests only after reviewing each exact test.

Validation workflow:

```text
Choose technique
 -> review behavior
 -> review prerequisites
 -> review cleanup
 -> document expected telemetry
 -> execute in isolated lab
 -> observe source logs
 -> verify Wazuh alert/detection
 -> investigate
 -> tune
 -> retest
 -> save evidence
```

---

## 71. ATT&CK Coverage

Maintain:

```text
technique_id
technique_name
tactic
telemetry_available
detection_available
validation_status
detection_id
last_validated
```

Later generate an ATT&CK Navigator-compatible layer.

---

## 72. SOC Alert and Investigation Module

AegisBridge stores **alert references and investigation state**, not a duplicate SIEM index.

Capabilities:

- selected Wazuh alert metadata
- assignment
- triage notes
- related assets/users
- related detection
- related ATT&CK technique
- promote alert to investigation
- promote investigation to incident
- disposition

---

## 73. Incident Management

Statuses:

- New
- Triaged
- Investigating
- Contained
- Eradicated
- Recovering
- Closed

Severity:

- Low
- Medium
- High
- Critical

Every incident contains:

- executive summary
- source alert
- affected assets
- affected identities
- timeline
- indicators
- ATT&CK mapping
- evidence
- analysis
- business impact
- containment
- eradication
- recovery
- root cause
- failed controls
- corrective actions
- lessons learned

---

## 74. Initial Incident Scenarios

Create at least:

- INC-001 authentication attack followed by suspicious success
- INC-002 unauthorized privileged-group change
- INC-003 suspicious PowerShell
- INC-004 safe malware-test detection
- INC-005 exploitable vulnerability on a critical system
- INC-006 phishing tabletop exercise

At least three should become complete portfolio investigations.

---

## 75. Vendor Risk

Capabilities:

- vendor inventory
- business owner
- service criticality
- data-access classification
- assessment status
- findings
- remediation/acceptance
- renewal/review date

Use only fictional vendors unless public vendor information is specifically being researched.

---

## 76. Reporting

Reports:

- executive security posture
- risk report
- control-assessment report
- evidence/audit package
- access-review report
- vulnerability remediation report
- incident report
- detection coverage report
- dataset experiment report

Reports should be generated from stored records, not manually typed metrics.

---

# Part IX — Cyber Range Architecture

## 77. Network Zones

Create five logical lab zones:

```text
MGMT       10.10.10.0/24
CORP       10.10.20.0/24
SERVER     10.10.30.0/24
DMZ        10.10.40.0/24
ATTACK     10.10.50.0/24
```

Gateway in each network:

```text
10.10.X.1
```

---

## 78. LAB-GW-01

Ubuntu Linux security gateway.

Functions:

- routing
- nftables firewall
- NAT when internet access is enabled
- Suricata
- Wazuh agent

Interfaces:

- MGMT
- CORP
- SERVER
- DMZ
- ATTACK
- upstream/NAT

---

## 79. SEC-WAZUH-01

Zone: MGMT  
IP: `10.10.10.10`

Run:

- Wazuh Server
- Wazuh Indexer
- Wazuh Dashboard

Pin deployment to the chosen 4.14.x patch release; current planning baseline is **Wazuh 4.14.9** (October 14, 2026).

---

## 80. Wazuh Connectivity

Relevant default ports:

```text
1514/TCP agent communication
1515/TCP agent enrollment
55000/TCP server REST API
443/TCP dashboard
9200/TCP indexer API (do not expose unnecessarily)
```

Rules:

- CORP/SERVER agents may reach 1514/1515 on Wazuh;
- management clients may reach 443 as required;
- local Aegis lab bridge may reach 55000;
- ATTACK zone may not reach MGMT by default;
- no Wazuh management ports exposed publicly.

---

## 81. WIN-USER-01

Zone: CORP  
IP: `10.10.20.11`

Windows 11 endpoint.

Install/configure:

- Wazuh agent
- Sysmon
- PowerShell logging
- Windows Security auditing
- Defender telemetry where available

Collect security-relevant events only when there is a use case.

---

## 82. Windows Telemetry Use Cases

Focus on:

- process creation
- parent/child relationships
- command line
- network connections
- login/logout
- failed login
- account creation
- group membership changes
- service creation
- scheduled tasks
- PowerShell
- selected registry modifications
- selected file creation
- log/security-tool tampering

---

## 83. LINUX-APP-01

Zone: SERVER  
IP: `10.10.30.11`

Ubuntu Server.

Install:

- Wazuh agent
- auditd
- SSH
- nginx
- small internal application

Collect:

- authentication
- sudo
- SSH
- process events
- package changes
- FIM
- service state
- nginx/application logs

---

## 84. KALI-RED-01

Zone: ATTACK  
IP: `10.10.50.10`

Purpose:

- authorized testing
- controlled validation
- purple-team exercises

May target only:

- AegisBridge-owned lab VMs
- intentionally vulnerable applications in the lab
- other systems explicitly owned/authorized for the project

---

## 85. Suricata

Use **Suricata 8.0.7** as the current planning baseline.

Primary output:

```text
eve.json
```

Collect useful:

- alerts
- flow metadata
- DNS metadata
- HTTP metadata
- TLS metadata

Forward relevant events to Wazuh.

Place Suricata on the routed gateway so traffic inspection does not depend on difficult virtual-switch mirroring.

---

## 86. Network Policy

Use default-deny inter-zone policy.

Examples:

- CORP -> SERVER: allow only business-required services
- CORP -> MGMT: deny except required Wazuh agent flows
- SERVER -> MGMT: allow required Wazuh agent flows
- ATTACK -> MGMT: deny
- ATTACK -> CORP/SERVER: deny normally; temporarily enable documented lab test flows
- MGMT -> zones: allow only administrative requirements
- Internet: NAT through gateway when enabled

Every temporary test rule must be documented and reverted.

---

## 87. Optional Directory Services

Do not make Active Directory a Phase 1 dependency.

Later options:

- Windows Server domain controller on compatible x86 virtualization
- Samba AD-compatible environment
- remote/cloud lab if local architecture creates Windows Server limitations

Directory services will be added when IAM/detection work needs domain-level telemetry.

---

## 88. Optional DFIR

Add **Velociraptor** in an advanced phase for:

- endpoint artifact collection
- hunting
- triage
- forensic workflows

It is not needed to begin the project.

---

# Part X — Dataset and Research Strategy

## 89. Dataset Philosophy

Datasets are not the platform's main database.

There are four data categories:

### A. Operational Application Data

Assets, risks, controls, incidents, users, etc.

### B. Live Intelligence

NVD, KEV, EPSS, ATT&CK, OSV.

### C. Real Cyber-Range Telemetry

Sysmon, Windows Security, Linux logs, Suricata, Wazuh.

### D. Research Datasets

Curated datasets for analytics/detection/phishing/malware research.

Research data remains separated from production-like application records.

---

## 90. Dataset Registry Requirements

Every dataset gets a manifest:

```yaml
dataset_id: DS-0001
name:
publisher:
release_year:
collection_period:
source:
license:
size:
formats:
sample_count:
security_domain:
malicious_content:
pii_risk:
redistribution_allowed:
default_download:
sha256:
citation:
purpose:
```

Raw datasets are ignored by Git.

---

## 91. DS-0001 — Smishing Dataset IMC25

Year: 2025  
License: CC BY 4.0  
Status: **Core / default lightweight dataset**

Use for:

- smishing classification
- lure categories
- social-engineering analysis
- message analytics
- explainable security reporting

The released artifact includes a labeled CSV and analysis code.

---

## 92. DS-0002 — CICAPT-IIoT2024 / APT IIoT

Year: 2024  
Status: **Core detection-research subset**

Contains:

- provenance data
- network logs/PCAP-related data
- multi-stage APT behavior
- ATT&CK-relevant techniques

Use selected subsets rather than forcing the full dataset into the repository.

---

## 93. DS-0003 — CICIoT2023

Year: 2023  
Status: Optional network-research dataset

Includes a large IoT testbed with multiple attack categories such as:

- DDoS
- DoS
- Recon
- Web
- brute force
- spoofing
- Mirai

Use for IDS/network analytics experiments, not as a mandatory application dependency.

---

## 94. DS-0004 — DataSense CIC IIoT 2025

Year: 2025  
Status: Optional advanced research

Provides synchronized sensor and network information and records 50 attack types across seven categories.

Use for:

- anomaly analysis
- multi-modal IIoT research
- advanced feature selection

Do not download the full dataset during initial development.

---

## 95. DS-0005 — CIC-Trap4Phish 2025

Year: 2025/associated publication 2026  
Status: Optional advanced phishing research

Covers:

- Word
- Excel
- PDF
- HTML
- QR codes
- URL strings

Use static/feature subsets first. Avoid executing malicious attachments.

---

## 96. DS-0006 — PhreshPhish

Initial release: 2025  
Current referenced revision: v1.0.1, February 7, 2026  
License: CC BY 4.0 / anti-phishing research use  
Size: approximately 666,315 rows and 36.6 GB

Status: Optional large-scale phishing research.

Use deterministic sampled subsets unless an experiment truly needs the complete dataset.

---

## 97. DS-0007 — CIC-PQC_OAV v1 2025

Year: 2025  
Status: Optional future-facing research

Contains approximately 40,010 TLS 1.3 sessions focused on classical/post-quantum transition scenarios, protocol violations, network conditions, adversarial scenarios, and data-integrity fuzzing.

Use for a late-stage post-quantum operational-security experiment.

---

## 98. DS-0008 — CIC-YNU-IoTMal 2026

Year: 2026  
Status: Optional advanced malware-behavior research

Dataset provides processed multi-architecture IoT malware behavioral data including:

- network traffic features
- system activity data
- system-call traces

Use derived/processed data. Do not make raw malware binaries a default project dependency.

---

## 99. Dataset Selection Priority

### Initial

- Smishing IMC25
- selected CICAPT-IIoT2024 subset
- own cyber-range telemetry

### Intermediate

- CIC-Trap4Phish selected safe subset
- CICIoT2023 subset

### Advanced

- PhreshPhish sampled/full as justified
- DataSense 2025
- CIC-PQC_OAV
- CIC-YNU-IoTMal 2026 processed data

---

## 100. Dataset Safety and Licensing Rules

For every dataset:

- record publisher/source;
- record license/terms;
- record collection period if available;
- record checksum;
- record size;
- record whether content can be redistributed;
- record whether malicious content exists;
- do not execute dataset artifacts by default;
- do not commit large raw files to Git;
- use safe static feature files when possible;
- cite the associated research paper.

---

## 101. Research Environment

Create:

```text
research/
  notebooks/
  experiments/
  preprocessing/
  reports/
```

Libraries when justified:

- pandas
- polars
- numpy
- pyarrow
- scikit-learn
- matplotlib

Do not add TensorFlow/PyTorch until an experiment actually needs them.

Production business logic must not live in notebooks.

---

# Part XI — Security Architecture of AegisBridge Itself

## 102. Authentication

Initial authentication:

- local accounts
- Argon2id password hashing
- server-side session handling or carefully designed secure cookie token model
- HTTP-only cookies
- Secure flag in hosted environment
- SameSite policy
- CSRF defense
- session expiration
- rate limiting
- login audit events

Later:

- TOTP MFA
- optional OIDC/OAuth

No public self-registration in the primary portfolio deployment.

---

## 103. Authorization

Backend-enforced RBAC.

Permissions are evaluated on the server.

Frontend route hiding is convenience only and never treated as security authorization.

Sensitive actions require dedicated permissions, for example:

- `risk.accept`
- `control.update`
- `evidence.download`
- `incident.close`
- `integration.manage`
- `user.role.manage`

---

## 104. File Upload Security

Evidence upload pipeline:

```text
Request
 -> authz check
 -> filename normalization
 -> size check
 -> MIME/extension validation
 -> optional malware/static scan later
 -> SHA-256
 -> object-store upload
 -> metadata transaction
 -> audit event
```

Do not serve uploaded files directly from arbitrary local web paths.

---

## 105. Encryption

### In Transit

HTTPS/TLS for hosted app and APIs.

### At Rest

Use managed platform encryption where provided for:

- PostgreSQL storage
- object storage

Application-level encryption may be added for highly sensitive individual fields if a real requirement appears.

Never invent custom cryptography.

---

## 106. Secrets Management

Local development:

```text
.env
```

with committed:

```text
.env.example
```

Hosted:

- Render environment variables/environment groups
- R2 access keys in hosted secrets
- separate secrets per environment

Never commit:

- database password
- NVD API key
- Wazuh credentials
- session secret
- R2 keys
- GitHub tokens
- lab bridge credential
- SSH private keys

---

## 107. Audit Logging

Security-sensitive actions generate audit events such as:

```text
LOGIN_SUCCESS
LOGIN_FAILURE
ROLE_CHANGED
RISK_ACCEPTED
CONTROL_STATUS_CHANGED
EVIDENCE_UPLOADED
EVIDENCE_DOWNLOADED
VULNERABILITY_EXCEPTION_CREATED
INCIDENT_CLOSED
POLICY_UPDATED
INTEGRATION_CREDENTIAL_ROTATED
```

Fields:

```text
timestamp
actor
source_ip
action
object_type
object_id
result
metadata
correlation_id
```

Audit events should be append-oriented.

---

## 108. Threat Model

Create a formal threat model for the application.

Trust boundaries:

- public browser ↔ frontend
- frontend ↔ API
- API ↔ PostgreSQL
- API/worker ↔ R2
- worker ↔ external intelligence
- lab bridge ↔ hosted API
- lab bridge ↔ Wazuh

Threat areas to assess:

- credential theft
- broken access control
- injection
- malicious uploads
- SSRF through integrations
- secret leakage
- IDOR/BOLA
- CSRF
- XSS
- dependency compromise
- poisoned intelligence data
- replayed lab-sync requests
- audit tampering
- object-storage access mistakes
- excessive API permissions

Use STRIDE as a practical modeling aid where helpful.

---

## 109. Privacy and Sanitization

The portfolio deployment must use:

- fictional names or clearly synthetic identities;
- sanitized hostnames/IPs where needed;
- no personal medical/financial/student records;
- no real company confidential information;
- no raw credentials;
- no private email exports;
- no personally identifying security logs in the public demo.

---

# Part XII — DevSecOps and Quality Engineering

## 110. Code Quality Toolchain

Backend:

- pytest
- Ruff
- Pyright or mypy

Frontend:

- TypeScript strict mode
- ESLint
- Vitest
- Testing Library
- Playwright

---

## 111. Security Toolchain

Use:

- Gitleaks — secret scanning
- Semgrep — SAST
- Trivy — dependencies, containers, and configuration scanning
- OSV data/API — package vulnerability intelligence
- CycloneDX — SBOM

Optional later:

- OWASP ZAP for controlled DAST of the Aegis web app

---

## 112. CI/CD Pipeline

GitHub Actions pipeline:

```text
Pull Request
   -> lint/format
   -> backend unit tests
   -> frontend unit tests
   -> type checks
   -> secret scan
   -> SAST
   -> dependency scan
   -> container/config scan
   -> build
   -> SBOM generation
   -> optional E2E
```

Production deployment occurs only after required checks pass.

---

## 113. SBOM

Generate CycloneDX SBOMs for:

- backend dependencies
- frontend dependencies
- container image composition where practical

Store as CI artifacts and optionally ingest metadata into AegisBridge's DevSecOps module.

---

## 114. Testing Strategy

### Unit Tests

Business logic, risk calculations, parsers, API clients, authorization helpers.

### Integration Tests

API + PostgreSQL + object-storage interfaces.

### Contract Tests

External API response schemas using fixtures/mocks.

### Authorization Tests

Verify role/permission boundaries.

### E2E Tests

Critical browser flows.

### Security Tests

- upload validation
- access-control regression
- rate limiting
- common injection paths
- session behavior

External APIs must be mocked for normal CI tests.

---

## 115. Dependency Strategy

Use lockfiles.

Do not install broad packages “just in case.”

Frontend:

- package manager lockfile

Backend:

- locked dependency file using chosen Python environment manager

Major-version upgrades require:

- tests
- ADR when architectural behavior changes
- security review for breaking changes

---

# Part XIII — Repository and Engineering Workflow

## 116. Repository Architecture

```text
aegis-security-platform/
|
|-- README.md
|-- MASTER_REQUIREMENTS.md
|-- ARCHITECTURE.md
|-- DATA_ARCHITECTURE.md
|-- DATASET_CATALOG.md
|-- SECURITY_REQUIREMENTS.md
|-- THREAT_MODEL.md
|-- LAB_ARCHITECTURE.md
|-- FRAMEWORK_STRATEGY.md
|-- HOSTING_AND_DEPLOYMENT.md
|-- ROADMAP.md
|-- PROJECT_STATUS.md
|-- SECURITY.md
|-- CONTRIBUTING.md
|-- CHANGELOG.md
|-- LICENSE
|-- .gitignore
|-- .env.example
|-- compose.yaml
|-- render.yaml
|
|-- .cursor/
|   `-- rules/
|
|-- apps/
|   |-- web/
|   |   |-- src/
|   |   |-- tests/
|   |   `-- package.json
|   |
|   |-- api/
|   |   |-- app/
|   |   |   |-- api/
|   |   |   |-- auth/
|   |   |   |-- models/
|   |   |   |-- schemas/
|   |   |   |-- services/
|   |   |   |-- integrations/
|   |   |   `-- security/
|   |   `-- tests/
|   |
|   `-- worker/
|
|-- migrations/
|-- integrations/
|   |-- nvd/
|   |-- epss/
|   |-- cisa_kev/
|   |-- mitre_attack/
|   |-- osv/
|   |-- wazuh/
|   `-- lab_bridge/
|
|-- frameworks/
|   |-- nist_csf/
|   |-- nist_800_53/
|   |-- cis/
|   |-- owasp_asvs/
|   `-- mappings/
|
|-- grc/
|   |-- policies/
|   |-- templates/
|   `-- seed/
|
|-- detections/
|   |-- sigma/
|   |-- wazuh/
|   |-- tests/
|   `-- attack-mappings/
|
|-- incident-response/
|   |-- playbooks/
|   `-- templates/
|
|-- datasets/
|   |-- registry/
|   |-- downloaders/
|   `-- samples/
|
|-- data/
|   |-- raw/
|   |-- cache/
|   `-- evidence/
|
|-- research/
|   |-- notebooks/
|   |-- experiments/
|   |-- preprocessing/
|   `-- reports/
|
|-- lab/
|   |-- network/
|   |-- gateway/
|   |-- wazuh/
|   |-- windows/
|   |-- linux/
|   |-- kali/
|   |-- bridge/
|   `-- diagrams/
|
|-- infra/
|   |-- docker/
|   |-- minio/
|   |-- render/
|   `-- scripts/
|
|-- docs/
|   |-- architecture/
|   |-- diagrams/
|   |-- runbooks/
|   |-- decisions/
|   `-- portfolio/
|
`-- .github/
    `-- workflows/
```

---

## 117. Git Ignore Requirements

Ignore at minimum:

```text
.env
.venv/
node_modules/
data/raw/
data/cache/
data/evidence/private/
*.pcap
*.pcapng
*.evtx
*.memory
*.dmp
VM images
database volumes
MinIO local objects
IDE caches
```

Large datasets and forensic artifacts do not belong in normal Git history.

---

## 118. Git Workflow

Primary branch:

```text
main
```

Feature examples:

```text
feature/asset-inventory
feature/grc-risk-engine
feature/nvd-integration
feature/wazuh-connector
feature/detection-management
feature/incident-response
```

Commit conventions:

```text
feat:
fix:
docs:
test:
security:
refactor:
chore:
```

---

## 119. Architecture Decision Records

Initial ADRs:

```text
ADR-001-web-app-not-native-desktop.md
ADR-002-use-react-fastapi.md
ADR-003-use-postgresql.md
ADR-004-use-wazuh-as-siem.md
ADR-005-separate-siem-from-platform.md
ADR-006-use-nist-csf.md
ADR-007-vulnerability-prioritization.md
ADR-008-dataset-storage-policy.md
ADR-009-use-render-for-hosting.md
ADR-010-use-cloudflare-r2.md
ADR-011-mac-dev-lenovo-lab.md
ADR-012-outbound-lab-bridge.md
ADR-013-python-314-baseline.md
```

Each ADR includes:

- Context
- Decision
- Alternatives
- Consequences
- Status
- Date

---

## 120. Cursor Rules

Cursor must:

1. read `MASTER_REQUIREMENTS.md` before architectural changes;
2. work one approved phase at a time;
3. never fabricate evidence;
4. never fabricate SIEM alerts;
5. never fabricate vulnerability scan results;
6. label synthetic seed data;
7. never commit secrets;
8. never download malware automatically;
9. never run offensive commands outside the authorized lab;
10. create an ADR before changing major architecture;
11. never silently change framework versions;
12. check redistribution rights before copying framework/dataset content;
13. create a manifest for every external dataset;
14. add timeout/retry/error handling to external clients;
15. use Alembic for schema changes;
16. add backend tests for backend features;
17. enforce authorization server-side;
18. derive metrics from stored data;
19. never hardcode dashboard metrics;
20. preserve evidence hashes;
21. keep Mac/Linux portability;
22. document deployment changes;
23. avoid unnecessary dependencies;
24. stop at the requested phase;
25. explain any contradiction discovered in this specification.

---

# Part XIV — Backup, Recovery, Observability, and Operations

## 121. Backup Strategy

Back up:

- PostgreSQL
- R2 evidence inventory/critical objects as required
- configuration manifests
- framework mapping exports

Do not treat containers as backups.

Perform an actual restore test and document evidence.

---

## 122. Recovery Exercise

Minimum recovery exercise:

1. create database backup;
2. create a known test record/evidence item;
3. simulate loss in a disposable environment;
4. restore database;
5. verify object references;
6. verify application health;
7. record recovery time;
8. create recovery evidence;
9. record lessons learned.

This supports the NIST CSF Recover function.

---

## 123. Application Observability

Initial:

- structured JSON application logs
- request correlation IDs
- worker job logs
- health endpoints
- integration-health table
- Render logs

Advanced later:

- OpenTelemetry
- Prometheus
- Grafana

Do not add the advanced stack before there is a real operational need.

---

## 124. Health Endpoints

Provide:

```text
/api/v1/health/live
/api/v1/health/ready
```

Readiness checks may include:

- database connectivity
- queue connectivity

Do not make readiness dependent on optional external intelligence feeds.

---

# Part XV — Project Phases and Acceptance Gates

## 125. Phase 0 — Requirements Freeze

Create/refine:

- master requirements
- architecture
- data architecture
- hosting architecture
- ADR system
- threat model
- data classification
- security requirements
- dataset catalog
- roadmap

No feature development.

**Exit gate:** contradictions are documented and architectural decisions are approved.

---

## 126. Phase 1 — Repository Bootstrap

Create:

- monorepo
- React frontend skeleton
- FastAPI skeleton
- PostgreSQL
- Key Value/Redis local service
- MinIO local object storage
- Docker Compose
- Alembic
- tests
- CI skeleton
- health checks

**Exit gate:** all local services start cleanly on the Mac.

---

## 127. Phase 2 — Authentication and RBAC

Implement:

- login/logout
- sessions
- users
- roles
- permissions
- basic audit log

**Exit gate:** authorization tests prove role separation.

---

## 128. Phase 3 — Organization and Assets

Implement:

- organization
- departments
- business processes
- assets
- software
- owners
- data classification

**Exit gate:** synthetic inventory works end-to-end.

---

## 129. Phase 4 — Risk Management

Implement:

- risk register
- inherent/residual scoring
- treatment
- ownership
- reviews
- dashboard widgets

**Exit gate:** at least 20 synthetic risks are tracked.

---

## 130. Phase 5 — Framework and Control Engine

Implement:

- NIST CSF profile
- selected NIST 800-53 imports
- control mappings
- control implementation status
- control tests
- evidence linkage

**Exit gate:** risk -> control -> test -> evidence traceability works.

---

## 131. Phase 6 — Policy and IAM

Implement:

- policy library/versioning
- fictional identities
- access-review workflow
- segregation-of-duties findings

**Exit gate:** a formal access-review report can be generated.

---

## 132. Phase 7 — Vulnerability Intelligence

Implement:

- NVD
- EPSS
- CISA KEV
- OSV
- SSVC
- integration-health monitoring

**Exit gate:** one CVE can be enriched end-to-end with source provenance.

---

## 133. Phase 8 — Dataset Registry

Implement:

- manifests
- license/provenance UI
- downloader architecture
- safe sample handling

Download only Smishing IMC25 initially.

**Exit gate:** provenance and licensing are visible and reproducible.

---

## 134. Phase 9 — Local Hosting Parity

Implement:

- production-like Docker Compose
- local MinIO
- reverse proxy as needed
- environment separation

**Exit gate:** local environment matches hosted service boundaries closely enough to debug deployment issues.

---

## 135. Phase 10 — Public Hosting Foundation

Create Render staging deployment:

- frontend
- API
- worker
- PostgreSQL
- Key Value
- R2 staging bucket

**Exit gate:** staging deployment passes health checks, migrations, and basic auth tests.

---

## 136. Phase 11 — Cyber Range Foundation

On Lenovo, deploy:

- gateway
- Wazuh
- Windows
- Linux server

**Exit gate:** segmentation works and agents can reach Wazuh appropriately.

---

## 137. Phase 12 — Endpoint Telemetry

Configure:

- Wazuh agents
- Sysmon
- Windows auditing
- Linux audit/FIM

**Exit gate:** real endpoint telemetry is visible in Wazuh.

---

## 138. Phase 13 — Network Detection

Deploy:

- Suricata
- EVE JSON
- forwarding/integration

**Exit gate:** controlled network events are observable in Wazuh.

---

## 139. Phase 14 — Detection Engineering

Implement 12 detections.

**Exit gate:** at least 8 are validated successfully in the lab.

---

## 140. Phase 15 — Lab Bridge

Implement outbound connector:

- Wazuh local queries
- normalized snapshot schema
- secure outbound sync
- retry/offline behavior

**Exit gate:** hosted staging app displays real lab state without public inbound access to the lab.

---

## 141. Phase 16 — Vulnerability Management

Map real lab assets to findings.

Process at least five findings through:

```text
discover -> enrich -> prioritize -> remediate -> verify -> close
```

---

## 142. Phase 17 — Incident Response

Conduct at least three complete investigations.

Each must include:

- timeline
- evidence
- ATT&CK mapping
- business impact
- containment
- remediation
- lessons learned
- related control improvement

---

## 143. Phase 18 — Research Analytics

Use:

- Smishing IMC25
- selected CICAPT-IIoT2024 subset

Optional:

- Trap4Phish subset

**Exit gate:** at least two reproducible research/analytics reports.

---

## 144. Phase 19 — DevSecOps

Add:

- Gitleaks
- Semgrep
- Trivy
- OSV-based package checks
- CycloneDX SBOM
- E2E tests

**Exit gate:** CI catches intentionally seeded safe test failures/insecure fixtures.

---

## 145. Phase 20 — Application Security Assessment

Assess AegisBridge itself using:

- OWASP ASVS 5.0.0
- OWASP Top 10:2025

Document:

- finding
- severity
- evidence
- remediation
- retest

---

## 146. Phase 21 — Recovery and Resilience

Perform:

- database backup
- object/evidence recovery check
- restore test

**Exit gate:** successful documented recovery.

---

## 147. Phase 22 — Production Portfolio Deployment

Deploy sanitized public demo.

Requirements:

- Demo Mode
- production secrets
- HTTPS
- no raw private lab data
- database backups
- error/health monitoring
- documented architecture

---

## 148. Phase 23 — Advanced DFIR

Optional Velociraptor deployment and endpoint investigation.

---

## 149. Phase 24 — Advanced Identity / Directory Services

Optional domain environment and domain-focused IAM/detections.

---

# Part XVI — Project Metrics and Definition of Done

## 150. Security Metrics

### Executive

- critical/high risks
- residual-risk trend
- control maturity
- critical asset exposure

### GRC

- implemented/partial controls
- overdue control tests
- evidence coverage
- open findings

### Vulnerability

- open findings
- KEV exposure
- SSVC action distribution
- overdue remediation
- mean vulnerability age

### SOC

- detections
- validated detections
- ATT&CK coverage
- alert dispositions

### Incident

- open incidents
- severity
- MTTD
- MTTR
- recurring root causes

### IAM

- privileged accounts
- stale accounts
- MFA coverage
- access-review findings

---

## 151. Definition of Done

The finished project should contain at minimum:

- 1 functioning full-stack web platform
- 1 hosted portfolio/demo deployment
- 1 segmented cyber range
- 1 Wazuh environment
- 1 Suricata NIDS
- 1 Windows monitored endpoint
- 1 Linux monitored server
- 1 Kali authorized validation endpoint
- 1 secure outbound lab bridge
- 20+ enterprise risks
- 20+ mapped controls
- 10+ pieces of real control evidence
- 12 detection rules
- 8+ validated detections
- 5+ completed vulnerability-remediation cases
- 3 complete incident investigations
- 1 formal IAM access review
- 10+ policies
- 1 NIST CSF Current Profile
- 1 NIST CSF Target Profile
- 1 ATT&CK coverage matrix
- 1 SSVC-based vulnerability decision workflow
- 1 threat-intelligence pipeline
- 1 dataset registry
- 2 research experiments
- 1 CI/CD security pipeline
- 1 SBOM pipeline
- 1 ASVS application-security assessment
- 1 tested recovery procedure
- 1 executive dashboard

---

## 152. Project Risks to Track

Maintain a project risk register including:

- scope creep
- insufficient Lenovo RAM
- disk exhaustion from Wazuh/PCAPs
- Apple Silicon/x86 compatibility issues
- dataset download size
- licensing mistakes
- leaking credentials to Git
- exposing the home lab publicly
- over-collecting logs
- noisy detections
- framework version drift
- API schema/rate-limit changes
- hosted free-tier limitations
- evidence containing sensitive data
- dependency vulnerabilities
- AI-generated code not understood by the maintainer

Each risk gets owner, likelihood, impact, mitigation, and status.

---

## 153. Cost Control

Keep the project inexpensive by default.

Use:

- open-source security tooling
- local Lenovo compute for the cyber range
- local Docker during development
- free/public intelligence APIs where permitted
- small/sampled research datasets

For public hosting, begin with the smallest practical Render/R2 configuration. Do not depend on ephemeral/free database behavior for the long-term production demo. Exact vendor pricing must be checked at deployment time because plans change.

---

## 154. Version Pinning and Maintenance

Record major baseline versions in `VERSIONS.md` or equivalent.

Initial planning baseline:

| Component | Baseline |
|---|---|
| NIST CSF | 2.0 |
| CIS Controls | 8.1 |
| NIST SP 800-53 | Rev. 5 current OSCAL content |
| NIST Incident Response | SP 800-61 Rev. 3 |
| NIST SSDF | SP 800-218 v1.1 |
| MITRE ATT&CK | 20.0 |
| OWASP ASVS | 5.0.0 |
| OWASP Top 10 | 2025 |
| React | 19.3 |
| Vite | 8 |
| Node | 24 LTS |
| Python app baseline | 3.14.x |
| PostgreSQL | 18 |
| Wazuh | 4.14.9 planning baseline |
| Suricata | 8.0.7 |

Patch versions may move after testing; major architectural changes require documentation.

---

# Part XVII — First Cursor Handoff

## 155. Documents Cursor Must Create Before Feature Coding

Cursor should create/refine:

```text
MASTER_REQUIREMENTS.md
ARCHITECTURE.md
DATA_ARCHITECTURE.md
DATASET_CATALOG.md
SECURITY_REQUIREMENTS.md
THREAT_MODEL.md
LAB_ARCHITECTURE.md
HOSTING_AND_DEPLOYMENT.md
FRAMEWORK_STRATEGY.md
API_INTEGRATION_MATRIX.md
ROADMAP.md
PROJECT_STATUS.md
VERSIONS.md
```

Also:

```text
docs/decisions/
```

with the initial ADR set.

---

## 156. First Cursor Instruction

Paste this into Cursor only after the repository contains this master specification:

> Read `MASTER_REQUIREMENTS.md` completely before doing anything. Treat it as the authoritative product and security architecture specification. We are beginning **Phase 0 only**. Review the specification for contradictions; derive functional, non-functional, security, data, hosting, integration, and lab requirements; create the architecture documents listed in the master plan; create the initial ADRs; create the proposed repository tree; create a dependency manifest without installing unnecessary packages; create a project risk/issues register; and create `PROJECT_STATUS.md`. Do not build application features, install Wazuh, configure Kali, download datasets, or fabricate security evidence. Stop after Phase 0 and report files created, decisions recorded, unresolved risks, prerequisites, and the proposed Phase 1 implementation sequence.

---

# Part XVIII — Final Architectural Principle

## 157. Closed-Loop Security Model

AegisBridge is not merely a cybersecurity website, a pentesting lab, or a dataset collection.

It is a miniature enterprise security program where:

```text
Business Context
      |
      v
Assets + Data + Identities
      |
      v
Threats + Risks
      |
      v
Controls + Policies
      |
      v
Implementation + Telemetry
      |
      v
Vulnerabilities + Detections
      |
      v
Investigations + Incidents
      |
      v
Evidence + Metrics + Lessons Learned
      |
      +------------------------------+
                                     |
                                     v
                              Improved Controls
```

Every technical control should connect to a risk.  
Every important risk should connect to controls.  
Every implemented control should have evidence.  
Every detection must be validated.  
Every vulnerability decision must include context.  
Every incident should produce lessons that improve the organization.  
Every public claim in the portfolio should be supported by actual project evidence.

---

# Appendix A — Required API Matrix

| Integration | Required? | Auth | Stored Data | Notes |
|---|---|---|---|---|
| NVD CVE API 2.0 | Yes | optional API key | CVE/CVSS/CWE/config refs | cache + incremental sync |
| FIRST EPSS | Yes | public | score/percentile/date | use daily bulk data for batch |
| CISA KEV | Yes | public | exploited CVE facts | JSON/CSV |
| MITRE ATT&CK STIX 2.1 | Yes | public | tactics/techniques/etc. | pin version 20.0 |
| MITRE TAXII | Optional | public | live ATT&CK query | do not replace pinned baseline silently |
| Wazuh Server API | Yes for lab | local credential/JWT | selected agent/security state | access through local bridge |
| OSV API | Yes for DevSecOps | public | package vulnerabilities | complement NVD |
| Cloudflare R2 S3 API | Yes for hosted files | access key | evidence/report objects | presigned access |
| GitHub REST security APIs | Optional | token | repo security findings | depends on plan/permissions |
| URLhaus | Optional | source-specific | IOC/URL metadata | no malware download |
| ThreatFox | Optional | source-specific | IOC metadata | no malware download |

---

# Appendix B — Dataset Matrix (2023–2026)

| ID | Dataset | Year | Default? | Main Use |
|---|---|---:|---|---|
| DS-0001 | Smishing IMC25 | 2025 | Yes | phishing/social engineering analytics |
| DS-0002 | CICAPT-IIoT2024 | 2024 | Selected subset | ATT&CK/detection/provenance |
| DS-0003 | CICIoT2023 | 2023 | No | IDS/network analytics |
| DS-0004 | DataSense CIC IIoT | 2025 | No | advanced IIoT anomaly research |
| DS-0005 | CIC-Trap4Phish | 2025 | No | phishing/quishing/static features |
| DS-0006 | PhreshPhish v1.0.1 | 2025–2026 | No | large-scale phishing research |
| DS-0007 | CIC-PQC_OAV v1 | 2025 | No | post-quantum TLS anomaly research |
| DS-0008 | CIC-YNU-IoTMal | 2026 | No | processed IoT malware behavior research |

---

# Appendix C — Hosting Component Matrix

| Need | Technology | Location |
|---|---|---|
| Frontend | React static build | Render Static Site |
| Backend API | FastAPI | Render Web Service |
| Async jobs | Celery | Render Background Worker |
| Schedules | Render Cron + worker tasks | Render |
| Relational data | PostgreSQL 18 | Render Postgres |
| Queue/cache | Render Key Value | Render |
| Evidence/report objects | S3-compatible storage | Cloudflare R2 |
| Local S3 emulation | MinIO | Mac Docker |
| CI/CD | GitHub Actions | GitHub |
| Raw telemetry | Wazuh | Lenovo lab |
| Network telemetry | Suricata | Lenovo lab |
| Lab sync | Aegis Lab Bridge | Lenovo -> Render outbound HTTPS |

---

# Appendix D — Source and Research Baseline

The plan should be periodically revalidated against primary sources. Important official sources used for the October 19, 2026 baseline include:

1. NIST Cybersecurity Framework 2.0 — https://www.nist.gov/cyberframework
2. NIST OSCAL — https://pages.nist.gov/OSCAL/
3. NIST SP 800-218 SSDF — https://csrc.nist.gov/pubs/sp/800/218/final
4. CISA KEV — https://www.cisa.gov/known-exploited-vulnerabilities-catalog
5. CISA SSVC — https://www.cisa.gov/resources-tools/resources/stakeholder-specific-vulnerability-categorization-ssvc
6. FIRST EPSS — https://www.first.org/epss/
7. MITRE ATT&CK — https://attack.mitre.org/
8. MITRE ATT&CK STIX — https://github.com/mitre-attack/attack-stix-data
9. Wazuh documentation — https://documentation.wazuh.com/current/
10. Suricata — https://suricata.io/
11. OWASP ASVS — https://owasp.org/www-project-application-security-verification-standard/
12. OWASP Top 10 — https://owasp.org/www-project-top-ten/
13. Render documentation — https://render.com/docs
14. Cloudflare R2 — https://developers.cloudflare.com/r2/
15. OSV API — https://google.github.io/osv.dev/api/
16. UNB Canadian Institute for Cybersecurity datasets — https://www.unb.ca/cic/datasets/
17. Smishing IMC25 repository — https://github.com/reportsmishing/Smishing-Dataset-IMC25
18. PhreshPhish dataset — https://huggingface.co/datasets/phreshphish/phreshphish
19. React — https://react.dev/
20. Node.js — https://nodejs.org/
21. PostgreSQL — https://www.postgresql.org/
22. Python — https://www.python.org/

---

# Appendix E — Final Portfolio Story

> AegisBridge Technologies began with an immature cybersecurity program. I designed a full-stack security operations and GRC platform, modeled the enterprise architecture, inventoried assets and data, assessed risks, established a NIST CSF 2.0 program, mapped controls, created policies and access reviews, integrated vulnerability intelligence, built a segmented cyber range, centralized endpoint and network telemetry with Wazuh and Suricata, engineered and validated ATT&CK-mapped detections, managed vulnerabilities using exploitation and business context, investigated incidents, preserved control evidence, implemented DevSecOps security controls, deployed the platform as a secure web application, and measured the organization's evolving security posture through real and synthetic data.

This is the story the implementation must make true.

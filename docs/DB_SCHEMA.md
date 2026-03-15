# FTC HUB – System Architecture

## Overview

FTC HUB è una piattaforma backend per la gestione operativa dei negozi Flying Tiger Copenhagen.

Supporta:

- Head Office
- District Manager
- Store users
- servizi di integrazione

Stack principale:

- FastAPI
- Python 3.12
- SQLAlchemy async
- PostgreSQL
- Alembic migrations
- JWT authentication
- Docker

---

## High Level Architecture

Client Apps
│
│ HTTP / REST
▼
FastAPI Backend
│
│ SQLAlchemy
▼
PostgreSQL Database

Client possibili:

- app desktop
- app mobile
- strumenti HO
- integrazioni NAV

---

## Backend Structure

backend/app

core/
config.py
security.py
dependencies.py

models/
auth.py
ho.py

schemas/
auth.py
ho.py

routers/
auth.py
test_rbac.py

routers/ho/
sales.py

services/
ho/
sales.py

File principali
database.py
main.py

---

## Docker Architecture

Servizi:

backend  
postgres

Comandi principali:

Avvio:
docker compose up -d

Rebuild backend:
docker compose up -d --build backend

Logs:
docker compose logs backend

---

## Request Flow

Client
│
▼
FastAPI Router
│
▼
Dependency Injection
│
▼
RBAC check
│
▼
Service layer
│
▼
Database

---

## Security Layers

1. JWT Authentication
2. RBAC Authorization
3. Permission based access
4. Admin bypass (system.admin)

---

## Modules

Attualmente presenti:

- Auth
- HO Sales
- NAV Credentials
- Excluded Stores

Moduli futuri:

- Inventory
- CheckMerce
- WriteDown
- Sales Data
- Device Management

---

## Scalability

Architettura progettata per:

- 150+ store
- multi entity
- multi ruolo
- multi modulo

Entity attuali:
IT01  
IT02  
IT03

# FTC HUB – Project Context

## Overview

FTC HUB è una piattaforma interna per la gestione operativa dei negozi Flying Tiger Copenhagen.

Obiettivo: centralizzare strumenti operativi per HO, District Manager e Store tramite API backend + app desktop/mobile.

---

# Stack Tecnologico

Backend

- FastAPI
- Python 3.12
- SQLAlchemy async
- PostgreSQL
- Alembic migrations
- JWT authentication

Infrastructure

- Docker
- docker compose
- container backend
- container postgres

Frontend (in sviluppo)

- app desktop / mobile
- Swagger usato per test API

---

# Architettura Backend

backend/app

core

- config.py
- security.py
- dependencies.py

models

- auth.py
- ho.py

schemas

- auth.py
- ho.py

routers

- auth.py
- test_rbac.py

routers/ho

- sales.py

services
services/ho

- sales.py

file principali

- database.py
- main.py

---

# Moduli Attivi

## Auth

Gestione autenticazione utenti

Funzioni

- login JWT
- refresh token
- password hashing
- gestione utenti

Tabelle

auth.users  
auth.refresh_tokens

---

## RBAC (Role Based Access Control)

Sistema ruoli e permessi.

Tabelle

auth.roles  
auth.permissions  
auth.user_roles  
auth.role_permissions

Ruoli principali

ADMIN  
HO  
DM  
STORE  
SERVICE

Permessi esempio

sales.view  
sales.import  
sales.export

inventory.view  
inventory.edit

stores.view  
stores.exclude_manage

nav.credentials.view  
nav.credentials.manage

users.view  
users.manage

system.admin

Admin bypass

system.admin

se presente → bypass di tutti i controlli.

---

# Modulo HO – Sales

Router

/api/ho/sales

Funzioni principali

### Excluded Stores

GET /excluded-stores  
POST /excluded-stores  
DELETE /excluded-stores/{id}

Gestisce negozi esclusi dai calcoli vendite.

Tabella

ho.excluded_stores

---

### Sales Parsing

POST /parse

Parsing dati TSV provenienti da NAV.

Input

raw_tsv_it01  
raw_tsv_it02  
raw_tsv_it03

Output

vendite aggregate per entity.

---

### NAV Credentials

Gestione credenziali NAV per utente.

GET /nav-credentials  
POST /nav-credentials  
PUT /nav-credentials/{env}  
POST /nav-open

Tabella

ho.nav_credentials

---

# Database

Schema principali

auth  
ho

---

## Tabelle principali

### auth.users

id  
username  
email  
hashed_password  
role  
is_active  
created_at  
updated_at  
last_login

---

### auth.roles

id  
code  
name  
is_active

---

### auth.permissions

id  
code  
description  
is_active

---

### auth.user_roles

user_id  
role_id

---

### auth.role_permissions

role_id  
permission_id

---

### ho.sales_sessions

Salvataggio sessioni di import vendite.

---

### ho.excluded_stores

Lista negozi esclusi dai calcoli.

---

### ho.nav_credentials

Credenziali NAV per utente.

---

# Docker

Servizi principali

backend  
postgres

Comandi principali

Avvio

docker compose up -d

Rebuild backend

docker compose up -d --build backend

Logs

docker compose logs backend

---

# Health Check

Endpoint

GET /api/health

Risposta

{
"status": "ok",
"service": "FTC HUB"
}

---

# Test RBAC

Router di test

/api/test-rbac/admin-only

Permesso richiesto

system.admin

Serve per verificare funzionamento RBAC.

---

# Convenzioni API

Formato permessi

module.action

Esempi

sales.view  
sales.import  
inventory.scan  
users.manage

---

# Roadmap Tecnica

## Fase 1

Auth + RBAC base ✔

## Fase 2

Modulo HO Sales ✔

## Fase 3

RBAC enterprise con scope

scope previsti

GLOBAL  
ENTITY  
STORE  
MODULE

esempi

ENTITY:IT01  
ENTITY:IT02  
STORE:IT207  
STORE:IT315

---

## Fase 4

Nuovi moduli

Inventory  
CheckMerce  
WriteDown  
Sales Data  
Device Management

---

# Obiettivo finale

FTC HUB come piattaforma operativa unica per

Head Office  
District Manager  
Store

con gestione multi-entity e multi-store

IT01  
IT02  
IT03

150+ store

---

# Come riprendere il contesto in una nuova chat

Incollare all'inizio

"Questo è il contesto del progetto FTC HUB"

e poi incollare questo file.

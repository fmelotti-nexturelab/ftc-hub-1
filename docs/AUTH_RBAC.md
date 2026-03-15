# FTC HUB – Database Schema

Database: PostgreSQL

Schemi utilizzati:
auth
ho

---

# AUTH SCHEMA

## auth.users

Utenti del sistema.

Campi:
id (uuid)  
username  
email  
hashed_password  
role  
is_active  
created_at  
updated_at  
last_login

---

## auth.refresh_tokens

Token di refresh per JWT.

Campi:
id  
user_id  
token  
expires_at  
revoked

---

## auth.roles

Ruoli logici del sistema.

Campi:
id  
code  
name  
is_active

Esempi ruoli:
ADMIN  
HO  
DM  
STORE  
SERVICE

---

## auth.permissions

Permessi tecnici.

Campi:
id  
code  
description  
is_active

Esempi:
sales.view  
sales.import  
inventory.view  
inventory.edit  
users.manage  
system.admin

---

## auth.user_roles

Associazione utenti → ruoli.

Campi:
user_id  
role_id

---

## auth.role_permissions

Associazione ruoli → permessi.

Campi:
role_id  
permission_id

---

# HO SCHEMA

## ho.excluded_stores

Lista negozi esclusi dal calcolo vendite.

Campi:
id  
store_code  
store_name  
reason  
notes  
is_active  
created_at  
created_by

---

## ho.sales_sessions

Sessioni di parsing vendite.

Campi:
id  
created_by  
created_at  
raw_data_it01  
raw_data_it02  
raw_data_it03  
notes

---

## ho.nav_credentials

Credenziali NAV salvate per utente.

Campi:
id  
user_id  
nav_env  
nav_username  
nav_password_enc  
created_at

---

# Relationships

users
└─ user_roles
└─ roles
└─ role_permissions
└─ permissions

---

# Future DB Extensions

Per RBAC enterprise verranno aggiunte:

permission_scopes  
role_permission_scopes  
user_permission_scopes

Per supportare:

- multi entity
- multi store
- multi modulo

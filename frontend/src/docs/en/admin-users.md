# [FTC HUB] — USER MANUAL

## User Management, Roles & Permissions

**Flying Tiger Copenhagen Italia**

|                    |                       |
| ------------------ | --------------------- |
| **Version**        | 1.0                   |
| **Date**           | March 2026            |
| **Classification** | Internal use only     |
| **Audience**       | System administrators |

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Purpose of this document](#11-purpose-of-this-document)
   - 1.2 [System overview](#12-system-overview)
   - 1.3 [Two-level access control system](#13-two-level-access-control-system)
2. [Access System Architecture](#2-access-system-architecture)
   - 2.1 [Base roles](#21-base-roles)
   - 2.2 [Granular RBAC system](#22-granular-rbac-system)
   - 2.3 [Full practical example](#23-full-practical-example)
3. [User Management](#3-user-management)
   - 3.1 [User list](#31-user-list)
   - 3.2 [Creating a new user](#32-creating-a-new-user)
   - 3.3 [Editing an existing user](#33-editing-an-existing-user)
   - 3.4 [Password reset](#34-password-reset)
   - 3.5 [Deactivating and reactivating a user](#35-deactivating-and-reactivating-a-user)
4. [Roles and Permissions Management](#4-roles-and-permissions-management)
   - 4.1 [Tab "Roles"](#41-tab-roles)
5. [Per-User Permission Configuration](#5-per-user-permission-configuration)
   - 5.1 [User selection](#51-user-selection)
   - 5.2 [RBAC Roles panel](#52-rbac-roles-panel)
   - 5.3 [Permission Overrides panel](#53-permission-overrides-panel)
   - 5.4 [Entity/Store Assignments panel](#54-entitystore-assignments-panel)
6. [System Permissions Catalog](#6-system-permissions-catalog)
7. [Practical Scenarios](#7-practical-scenarios)
   - 7.1 [New Store Manager](#71-scenario-new-store-manager)
   - 7.2 [New District Manager](#72-scenario-new-district-manager)
   - 7.3 [Temporary substitution](#73-scenario-temporary-substitution)
   - 7.4 [Revoking access to a specific module](#74-scenario-revoking-access-to-a-specific-module)
8. [Glossary](#8-glossary)
9. [Appendix: New User Configuration Checklist](#9-appendix-new-user-configuration-checklist)

---

## 1. Introduction

### 1.1 Purpose of this document

This manual provides a comprehensive guide to the user management, roles, and permissions features of the FTC HUB platform. It is intended for system administrators responsible for creating, configuring, and managing user accounts and the related access control system.

After reading this manual, an administrator will be able to:

- Create and manage system user accounts
- Assign base roles and RBAC roles
- Configure granular permissions and individual overrides
- Assign entities and stores to users
- Understand the full hierarchy of the access control system

### 1.2 System overview

FTC HUB is an internal web platform developed for the operational management of Flying Tiger Copenhagen Italia. The system serves over 150 stores organized into three entities:

- **IT01** — First entity (group of stores)
- **IT02** — Second entity
- **IT03** — Third entity

System users fall into four main profiles:

| Profile   | Description                | Typical access                         |
| --------- | -------------------------- | -------------------------------------- |
| **ADMIN** | System administrators      | Full access to all sections            |
| **HO**    | Head Office (headquarters) | Sales, Navision, reports               |
| **DM**    | District Manager           | Tickets and assigned entity/store data |
| **STORE** | Store Manager              | Tickets and own store data only        |

### 1.3 Two-level access control system

FTC HUB uses an access control system structured on two complementary levels:

**Level 1 — Base role:** Determines general access to the application's main sections. Each user has exactly one base role (ADMIN, HO, DM, or STORE).

**Level 2 — Granular RBAC:** Applied on top of the base role to define in detail what each user can do. It includes RBAC roles, specific permissions, scopes, and individual overrides.

> ℹ️ **NOTE:** The two levels work together: the base role opens the "doors" to sections, and the RBAC system defines what can be done once inside.

---

## 2. Access System Architecture

### 2.1 Base roles

The base role is the first level of control. It defines which application areas the user can access:

| Role      | Accessible areas | Detail                                                              |
| --------- | ---------------- | ------------------------------------------------------------------- |
| **ADMIN** | All              | Full access including `/admin` section for user and RBAC management |
| **HO**    | Head Office      | Sales, Navision integration, reporting                              |
| **DM**    | Operational area | Tickets + data limited to assigned entities/stores                  |
| **STORE** | Store area       | Tickets + data exclusively from own store                           |

### 2.2 Granular RBAC system

The RBAC (Role-Based Access Control) system adds a finer level of control on top of the base role. It consists of four elements:

#### 2.2.1 RBAC Roles

These are groupings of permissions with a descriptive name (e.g. "Sales Manager IT01", "District Manager"). A user can have multiple RBAC roles simultaneously.

#### 2.2.2 Permissions

These are individual actions a user can perform in the system, identified by a unique code (e.g. `sales.view`, `tickets.create`). Each permission belongs to a module.

#### 2.2.3 Scope

The scope defines the context in which a permission applies:

| Scope      | Meaning                               | Example                                     |
| ---------- | ------------------------------------- | ------------------------------------------- |
| **GLOBAL** | Entire system, no restrictions        | User can see sales data for all stores      |
| **ENTITY** | Only one entity (IT01, IT02, or IT03) | User can see sales only for IT02 stores     |
| **STORE**  | Only a specific store                 | User can see sales only for store IT207     |
| **MODULE** | A module without geographic context   | Access to a module's configuration settings |

#### 2.2.4 Overrides

Overrides are per-user exceptions that override permissions inherited from RBAC roles. They can be of two types:

- **Allow:** Grants an additional permission not included in the assigned roles
- **Deny:** Denies a specific permission, even if present in the assigned roles

> ⚠️ **WARNING:** A Deny override always takes priority over any Allow inherited from RBAC roles. Use overrides with caution: a Deny can prevent operations essential to the user's work.

### 2.3 Full practical example

**Scenario:** Mario Rossi is a District Manager responsible for entity IT02.

His system configuration will be:

- Base role: **DM** (access to ticket area and assigned entity/store data)
- RBAC role: **"District Manager"** with permission `sales.view` at scope GLOBAL
- Entity assignment: **IT02** with type **PRIMARY**

**Result:** Mario can access the ticket area and view sales data, but only for stores belonging to entity IT02. He cannot see data from IT01 or IT03.

> ℹ️ **NOTE:** The GLOBAL scope on the `sales.view` permission means the permission itself is unrestricted, but the PRIMARY entity assignment on IT02 filters the visible data to that entity only.

---

## 3. User Management

The User Management section is accessible from the sidebar menu under "Admin" → URL: `/admin`. From here, the administrator can view, create, edit, and manage all system user accounts.

### 3.1 User list

The main page displays a table of all registered users. The following columns are shown:

| Column         | Description                                            |
| -------------- | ------------------------------------------------------ |
| **Name**       | Full name of the user                                  |
| **Username**   | Unique identifier used for login                       |
| **Role**       | Assigned base role (ADMIN, HO, DM, STORE)              |
| **Status**     | Indicates whether the account is active or deactivated |
| **Last login** | Date and time of the user's last login                 |

### 3.2 Creating a new user

To create a new user account, follow this procedure:

1. Navigate to the **Admin** section from the sidebar menu (`/admin`).
2. Click the **"Create new user"** button.
3. Fill in the form with the following fields:
   - **Full name:** the user's first and last name (e.g. Mario Rossi)
   - **Username:** unique login identifier (e.g. m.rossi)
   - **Email:** the user's corporate email address
   - **Temporary password:** an initial password that the user must change at first login
   - **Role:** select one of the available base roles (ADMIN, HO, DM, STORE)
4. Review the entered data.
5. Click **"Save"** to confirm the creation.

> ⚠️ **WARNING:** Communicate the temporary password to the user exclusively through a secure channel. Do not send passwords via unencrypted email or unprotected chat messages.

> ℹ️ **NOTE:** After creation, the user will only have the assigned base role. To configure granular permissions (RBAC roles, overrides, entity/store assignments), proceed as described in Section 5.

### 3.3 Editing an existing user

User data can be modified directly in the table row (inline editing):

1. Locate the user in the list.
2. Click on the row or the edit icon.
3. Modify the desired fields:
   - Full name
   - Email address
   - Base role
4. Confirm the changes by clicking **"Save"**.

> ⚠️ **WARNING:** Changing the base role can immediately alter the sections accessible to the user. Make sure the user is informed of the permission change.

### 3.4 Password reset

If a user forgets their password or a reset is required for security reasons:

1. Locate the user in the list.
2. Click the **"Reset password"** button.
3. Enter or generate a new temporary password.
4. Communicate the new password to the user through a secure channel.

### 3.5 Deactivating and reactivating a user

When a user should no longer access the system (e.g. end of employment or transfer), the account can be deactivated without permanent deletion.

**To deactivate a user:**

1. Locate the user in the list.
2. Click the status toggle (active/inactive).
3. Confirm the operation in the dialog that appears.

**To reactivate a deactivated user:**

1. Locate the user in the list (deactivated users remain visible).
2. Click the status toggle to set it back to "Active".
3. Confirm the operation.

> ℹ️ **NOTE:** Deactivation is a reversible operation (soft delete): the account and all its data are preserved, but the user will not be able to log in. This is the recommended approach over permanent deletion.

---

## 4. Roles and Permissions Management

The Roles & Permissions section is accessible from the sidebar menu under "Admin" → "RBAC" → URL: `/admin/rbac`. The page is organized into two tabs:

- **Tab "Roles"** — Management of RBAC roles and their associated permissions
- **Tab "User permissions"** — User-specific permission configuration

### 4.1 Tab "Roles"

#### 4.1.1 Viewing roles

The "Roles" tab displays all RBAC roles defined in the system. For each role, the number of currently assigned permissions is shown.

To view role details:

1. Click on the role name in the list.
2. The detail panel shows all permissions assigned to the role, grouped by module (e.g. Sales, Stores, Tickets, etc.).

#### 4.1.2 Adding permissions to a role

To add one or more permissions to an RBAC role:

1. Select the role from the list.
2. Click **"Add permissions"**.
3. In the modal window that appears, select the desired permissions:
   - Use **checkboxes** to select individual permissions
   - Use the **text search bar** to filter permissions by name or code
   - Use the **module selection** to select all permissions from an entire area (e.g. all "Sales" module permissions)
4. Confirm by clicking **"Save"**.

#### 4.1.3 Removing a permission from a role

To remove a permission already assigned to a role:

1. Select the role from the list.
2. Locate the permission to remove in the assigned permissions list.
3. Click the **trash icon** next to the permission.
4. Confirm the removal in the inline confirmation message that appears.

> ⚠️ **WARNING:** Removing a permission from a role takes immediate effect on all users who have that role assigned. Before removing a permission, check how many users are impacted.

---

## 5. Per-User Permission Configuration

The "User permissions" tab (`/admin/rbac` → User permissions tab) allows detailed permission configuration for an individual user. This section is divided into three panels.

### 5.1 User selection

1. Open the dropdown menu at the top of the page.
2. Select the user to configure.

Once selected, the three panels below will display the user's current configuration.

### 5.2 RBAC Roles panel

This panel shows the RBAC roles currently assigned to the selected user and allows adding new ones or removing existing ones.

**To add an RBAC role:**

1. Click **"Add role"** in the panel.
2. Select the desired role from the list.
3. Confirm the assignment.

**To remove an RBAC role:**

1. Locate the role to remove in the list.
2. Click the remove icon.
3. Confirm the removal.

> ℹ️ **NOTE:** A user can have multiple RBAC roles simultaneously. Permissions are additive: the user receives the union of all permissions from all assigned roles.

### 5.3 Permission Overrides panel

This panel allows defining exceptions to permissions for the individual user, overriding what is inherited from RBAC roles.

**To add an override:**

1. Click **"Add override"**.
2. Select the permission to override.
3. Choose the override type:
   - **Allow:** grants the permission (even if not present in the roles)
   - **Deny:** denies the permission (even if present in the roles)
4. Define the override scope (GLOBAL, ENTITY, STORE, or MODULE).
5. Save the override.

> ⚠️ **WARNING:** Use overrides with extreme caution. A Deny override always takes the highest priority and cannot be overridden by an Allow from any RBAC role.

### 5.4 Entity/Store Assignments panel

This panel defines which data the user can operate on. Assignments determine the user's geographic/organizational scope.

**To add an assignment:**

1. Click **"Add assignment"**.
2. Select the assignment type:
   - **Entity:** select IT01, IT02, or IT03 from the dropdown
   - **Store:** manually enter the store code (e.g. IT207)
3. Select the assignment category:
   - **PRIMARY:** main assignment (the user is directly responsible)
   - **SECONDARY:** secondary assignment (supplementary access)
   - **TEMP:** temporary assignment (e.g. for substitutions or limited periods)
4. Enter optional notes (useful for indicating the reason for the assignment or expected expiry date for TEMP assignments).
5. Save the assignment.

> ℹ️ **NOTE:** TEMP assignments do not expire automatically. The administrator must remember to remove them manually at the end of the planned period. It is recommended to use the "Notes" field to record the expiry date.

---

## 6. System Permissions Catalog

The following table lists all permissions currently configured in the system, grouped by module.

| Permission code          | Module  | Description                                                        |
| ------------------------ | ------- | ------------------------------------------------------------------ |
| `system.admin`           | system  | Full bypass of all access controls. Assign only to administrators. |
| `sales.view`             | sales   | View sales data (filtered based on entity/store assignments).      |
| `sales.import`           | sales   | Import data from Navision into the sales module.                   |
| `sales.export`           | sales   | Export sales reports in downloadable format.                       |
| `stores.view`            | stores  | View the store list and related information.                       |
| `stores.exclude_manage`  | stores  | Manage the list of stores excluded from aggregate calculations.    |
| `nav.credentials.view`   | nav     | View Navision access credentials (read-only).                      |
| `nav.credentials.manage` | nav     | Edit Navision access credentials.                                  |
| `users.view`             | users   | View the list of registered users.                                 |
| `users.manage`           | users   | Create, edit, and manage user accounts.                            |
| `tickets.view`           | tickets | View existing tickets.                                             |
| `tickets.create`         | tickets | Create new support or issue tickets.                               |
| `tickets.manage`         | tickets | Manage all tickets (change status, assign, close).                 |

> ⚠️ **WARNING:** The `system.admin` permission grants unlimited access to the entire system, bypassing all other controls. Assign it exclusively to system administrators and keep the number of holders to an absolute minimum.

---

## 7. Practical Scenarios

This section presents concrete scenarios to guide the administrator through the most common user configurations.

### 7.1 Scenario: New Store Manager

**Context:** Laura Bianchi has been hired as Store Manager for store IT207 (entity IT02).

**Procedure:**

1. **Create the user** (Section 3.2):
   - Full name: Laura Bianchi
   - Username: l.bianchi
   - Email: l.bianchi@flyingtiger.it
   - Temporary password: (generate a secure password)
   - Role: STORE
2. **Configure user permissions** (Section 5):
   - Select user "Laura Bianchi" from the dropdown
   - Assign the "Store Manager" RBAC role from the Roles panel
   - Add a Store assignment: code IT207, type PRIMARY
3. **Communicate the credentials** to Laura through a secure channel.

**Result:** Laura can access the ticket area and view data related only to store IT207.

### 7.2 Scenario: New District Manager

**Context:** Marco Verdi is the new District Manager for entity IT01.

**Procedure:**

1. **Create the user:**
   - Name: Marco Verdi, Username: m.verdi, Role: DM
2. **Configure permissions:**
   - Assign the "District Manager" RBAC role
   - Add Entity assignment: IT01, type PRIMARY
3. If Marco also needs to export sales reports, **add an override:**
   - Permission: `sales.export`, Type: Allow, Scope: ENTITY

### 7.3 Scenario: Temporary substitution

**Context:** Anna Neri, DM for IT03, must temporarily cover IT02 as well for one month.

**Procedure:**

1. Access Anna Neri's user permissions (Section 5).
2. Add an Entity assignment: **IT02**, type **TEMP**.
3. Enter in Notes: "Substitution until 30/04/2026 due to absence of Mario Rossi".

> ⚠️ **WARNING:** Remember to remove the TEMP assignment at the indicated expiry date. The system does not provide automatic removal.

### 7.4 Scenario: Revoking access to a specific module

**Context:** Paolo Gialli, an HO user, should no longer be able to import data from Navision.

**Procedure:**

1. Access Paolo Gialli's user permissions (Section 5).
2. In the Overrides panel, add:
   - Permission: `sales.import`, Type: **Deny**, Scope: **GLOBAL**

**Result:** Even though Paolo's RBAC role includes `sales.import`, the Deny override blocks this specific action.

---

## 8. Glossary

| Term            | Definition                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **Allow**       | Type of override that explicitly grants a permission to a user, adding to what RBAC roles provide. |
| **Assignment**  | Association between a user and an entity or store, defining the perimeter of accessible data.      |
| **Base role**   | First level of access control. Defines accessible macro-areas (ADMIN, HO, DM, STORE).              |
| **Deny**        | Type of override that explicitly denies a permission to a user, with the highest priority.         |
| **Entity**      | Organizational grouping of stores. FTC HUB manages three entities: IT01, IT02, IT03.               |
| **Override**    | Exception configured for an individual user that overrides permissions inherited from RBAC roles.  |
| **Permission**  | Specific action a user can perform in the system (e.g. `sales.view`, `tickets.create`).            |
| **PRIMARY**     | Assignment type indicating the user's main responsibility for an entity or store.                  |
| **RBAC**        | Role-Based Access Control. Access control system based on roles with associated permissions.       |
| **RBAC role**   | Grouping of permissions with a descriptive name, assignable to one or more users.                  |
| **Scope**       | Context in which a permission applies: GLOBAL, ENTITY, STORE, or MODULE.                           |
| **SECONDARY**   | Assignment type for supplementary access to an entity or store.                                    |
| **Soft delete** | Reversible deactivation: the account is disabled but not permanently deleted.                      |
| **Store**       | Individual point of sale identified by a unique code (e.g. IT207).                                 |
| **TEMP**        | Temporary assignment type, to be removed manually upon expiry.                                     |

---

## 9. Appendix: New User Configuration Checklist

Use the following checklist to ensure all necessary steps are completed when configuring a new user:

| ☐   | Step              | Detail                                                                                     |
| --- | ----------------- | ------------------------------------------------------------------------------------------ |
| ☐   | 1. Create account | Create the user with name, username, email, temporary password, and base role              |
| ☐   | 2. RBAC roles     | Assign one or more RBAC roles appropriate to the user's profile                            |
| ☐   | 3. Assignments    | Configure entity and/or store assignments with the correct type (PRIMARY, SECONDARY, TEMP) |
| ☐   | 4. Overrides      | If needed, add specific overrides (Allow or Deny)                                          |
| ☐   | 5. Verification   | Review the overall configuration from the User permissions tab                             |
| ☐   | 6. Communication  | Communicate credentials to the user through a secure channel                               |
| ☐   | 7. Testing        | Ask the user to log in for the first time and verify that permissions are correct          |

---

_FTC HUB — User Manual v1.0 — March 2026_

_Flying Tiger Copenhagen Italia — Internal use only_

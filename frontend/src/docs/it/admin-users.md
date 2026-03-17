# [FTC HUB] — MANUALE UTENTE

## Gestione Utenti, Ruoli e Permessi

**Flying Tiger Copenhagen Italia**

|                     |                           |
| ------------------- | ------------------------- |
| **Versione**        | 1.0                       |
| **Data**            | Marzo 2026                |
| **Classificazione** | Uso interno               |
| **Destinatari**     | Amministratori di sistema |

---

## Indice

1. [Introduzione](#1-introduzione)
   - 1.1 [Scopo del documento](#11-scopo-del-documento)
   - 1.2 [Panoramica del sistema](#12-panoramica-del-sistema)
   - 1.3 [Sistema di controllo accessi a due livelli](#13-sistema-di-controllo-accessi-a-due-livelli)
2. [Architettura del sistema di accesso](#2-architettura-del-sistema-di-accesso)
   - 2.1 [Ruoli base](#21-ruoli-base)
   - 2.2 [Sistema RBAC granulare](#22-sistema-rbac-granulare)
   - 2.3 [Esempio pratico completo](#23-esempio-pratico-completo)
3. [Gestione Utenti](#3-gestione-utenti)
   - 3.1 [Lista utenti](#31-lista-utenti)
   - 3.2 [Creazione di un nuovo utente](#32-creazione-di-un-nuovo-utente)
   - 3.3 [Modifica di un utente esistente](#33-modifica-di-un-utente-esistente)
   - 3.4 [Reset della password](#34-reset-della-password)
   - 3.5 [Disattivazione e riattivazione utente](#35-disattivazione-e-riattivazione-utente)
4. [Gestione Ruoli e Permessi](#4-gestione-ruoli-e-permessi)
   - 4.1 [Tab "Ruoli"](#41-tab-ruoli)
5. [Configurazione Permessi per Singolo Utente](#5-configurazione-permessi-per-singolo-utente)
   - 5.1 [Selezione utente](#51-selezione-utente)
   - 5.2 [Pannello Ruoli RBAC](#52-pannello-ruoli-rbac)
   - 5.3 [Pannello Override Permessi](#53-pannello-override-permessi)
   - 5.4 [Pannello Assegnazioni Entity/Store](#54-pannello-assegnazioni-entitystore)
6. [Catalogo Permessi del Sistema](#6-catalogo-permessi-del-sistema)
7. [Scenari Operativi di Esempio](#7-scenari-operativi-di-esempio)
   - 7.1 [Nuovo Store Manager](#71-scenario-nuovo-store-manager)
   - 7.2 [Nuovo District Manager](#72-scenario-nuovo-district-manager)
   - 7.3 [Sostituzione temporanea](#73-scenario-sostituzione-temporanea)
   - 7.4 [Revocare l'accesso a un modulo](#74-scenario-revocare-laccesso-a-un-modulo-specifico)
8. [Glossario](#8-glossario)
9. [Appendice: Checklist configurazione nuovo utente](#9-appendice-checklist-di-configurazione-nuovo-utente)

---

## 1. Introduzione

### 1.1 Scopo del documento

Questo manuale descrive in dettaglio le funzionalità di gestione utenti, ruoli e permessi della piattaforma FTC HUB. È destinato agli amministratori di sistema che devono creare, configurare e gestire gli account utente e il relativo sistema di controllo accessi.

Al termine della lettura, l'amministratore sarà in grado di:

- Creare e gestire gli account utente del sistema
- Assegnare ruoli base e ruoli RBAC
- Configurare permessi granulari e override personalizzati
- Assegnare entity e store agli utenti
- Comprendere la gerarchia completa del sistema di controllo accessi

### 1.2 Panoramica del sistema

FTC HUB è una piattaforma interna web sviluppata per la gestione operativa di Flying Tiger Copenhagen Italia. Il sistema serve oltre 150 negozi organizzati in tre entity:

- **IT01** — Prima entity (gruppo di negozi)
- **IT02** — Seconda entity
- **IT03** — Terza entity

Gli utenti del sistema appartengono a quattro profili principali:

| Profilo   | Descrizione                          | Accesso tipico                       |
| --------- | ------------------------------------ | ------------------------------------ |
| **ADMIN** | Amministratori di sistema            | Accesso completo a tutte le sezioni  |
| **HO**    | Head Office (sede centrale)          | Vendite, Navision, report            |
| **DM**    | District Manager                     | Ticket e dati entity/store assegnati |
| **STORE** | Store Manager (responsabile negozio) | Ticket e dati del proprio negozio    |

### 1.3 Sistema di controllo accessi a due livelli

FTC HUB utilizza un sistema di controllo accessi strutturato su due livelli complementari:

**Livello 1 — Ruolo base:** Determina l'accesso generale alle macro-sezioni dell'applicazione. Ogni utente ha esattamente un ruolo base (ADMIN, HO, DM o STORE).

**Livello 2 — RBAC granulare:** Si applica sopra al ruolo base per definire nel dettaglio cosa può fare ciascun utente. Include ruoli RBAC, permessi specifici, scope e override individuali.

> ℹ️ **NOTA:** I due livelli lavorano insieme: il ruolo base apre le "porte" delle sezioni, il sistema RBAC definisce cosa si può fare una volta entrati.

---

## 2. Architettura del sistema di accesso

### 2.1 Ruoli base

Il ruolo base è il primo livello di controllo. Definisce a quali aree dell'applicazione l'utente può accedere:

| Ruolo     | Aree accessibili | Dettaglio                                                                |
| --------- | ---------------- | ------------------------------------------------------------------------ |
| **ADMIN** | Tutte            | Accesso completo, inclusa la sezione `/admin` per gestione utenti e RBAC |
| **HO**    | Head Office      | Vendite, integrazione Navision, reportistica                             |
| **DM**    | Area operativa   | Ticket + dati limitati alle entity/store assegnati                       |
| **STORE** | Area negozio     | Ticket + dati esclusivamente del proprio store                           |

### 2.2 Sistema RBAC granulare

Il sistema RBAC (Role-Based Access Control) aggiunge un livello di controllo più fine sopra al ruolo base. È composto da quattro elementi:

#### 2.2.1 Ruoli RBAC

Sono raggruppamenti di permessi con un nome descrittivo (es. "Responsabile Vendite IT01", "District Manager"). Un utente può avere più ruoli RBAC contemporaneamente.

#### 2.2.2 Permessi

Sono le singole azioni che un utente può compiere nel sistema, identificate da un codice univoco (es. `sales.view`, `tickets.create`). Ogni permesso appartiene a un modulo.

#### 2.2.3 Scope

Lo scope definisce il contesto in cui si applica un permesso:

| Scope      | Significato                         | Esempio                                           |
| ---------- | ----------------------------------- | ------------------------------------------------- |
| **GLOBAL** | Tutto il sistema, senza restrizioni | L'utente vede le vendite di tutti gli store       |
| **ENTITY** | Solo una entity (IT01, IT02 o IT03) | L'utente vede le vendite solo degli store di IT02 |
| **STORE**  | Solo uno store specifico            | L'utente vede le vendite solo del negozio IT207   |
| **MODULE** | Un modulo senza contesto geografico | Accesso alla configurazione di un modulo          |

#### 2.2.4 Override

Sono eccezioni per singolo utente che sovrascrivono i permessi ereditati dai ruoli RBAC. Possono essere di due tipi:

- **Allow:** Concede un permesso aggiuntivo non incluso nei ruoli assegnati
- **Deny:** Nega un permesso specifico, anche se presente nei ruoli assegnati

> ⚠️ **ATTENZIONE:** Un override Deny ha sempre priorità su qualsiasi Allow proveniente dai ruoli RBAC. Usare gli override con cautela: un deny può impedire operazioni essenziali per il lavoro dell'utente.

### 2.3 Esempio pratico completo

**Scenario:** Mario Rossi è un District Manager responsabile dell'entity IT02.

La sua configurazione nel sistema sarà:

- Ruolo base: **DM** (accesso all'area ticket e ai dati delle entity/store assegnati)
- Ruolo RBAC: **"District Manager"** con permesso `sales.view` a scope GLOBAL
- Assegnazione entity: **IT02** con tipo **PRIMARY**

**Risultato:** Mario può accedere all'area ticket e visualizzare i dati di vendita, ma solo per i negozi appartenenti all'entity IT02. Non può vedere i dati di IT01 o IT03.

> ℹ️ **NOTA:** Lo scope GLOBAL del permesso `sales.view` indica che il permesso non è limitato a priori, ma l'assegnazione entity PRIMARY su IT02 filtra i dati visibili limitandoli a quell'entity.

---

## 3. Gestione Utenti

La sezione Gestione Utenti è accessibile dal menu laterale alla voce "Admin" → URL: `/admin`. Da qui l'amministratore può visualizzare, creare, modificare e gestire tutti gli account utente del sistema.

### 3.1 Lista utenti

La pagina principale mostra una tabella con tutti gli utenti registrati nel sistema. Le colonne visualizzate sono:

| Colonna            | Descrizione                                         |
| ------------------ | --------------------------------------------------- |
| **Nome**           | Nome completo dell'utente                           |
| **Username**       | Identificativo univoco per il login                 |
| **Ruolo**          | Ruolo base assegnato (ADMIN, HO, DM, STORE)         |
| **Stato**          | Indica se l'account è attivo o disattivato          |
| **Ultimo accesso** | Data e ora dell'ultimo login effettuato dall'utente |

### 3.2 Creazione di un nuovo utente

Per creare un nuovo account utente, seguire la procedura seguente:

1. Accedere alla sezione **Admin** dal menu laterale (`/admin`).
2. Fare clic sul pulsante **"Crea nuovo utente"**.
3. Compilare il modulo con i seguenti campi:
   - **Nome completo:** nome e cognome dell'utente (es. Mario Rossi)
   - **Username:** identificativo univoco per il login (es. m.rossi)
   - **Email:** indirizzo email aziendale dell'utente
   - **Password temporanea:** una password iniziale che l'utente dovrà modificare al primo accesso
   - **Ruolo:** selezionare uno dei ruoli base disponibili (ADMIN, HO, DM, STORE)
4. Verificare i dati inseriti.
5. Fare clic su **"Salva"** per confermare la creazione.

> ⚠️ **ATTENZIONE:** Comunicare la password temporanea all'utente esclusivamente attraverso un canale sicuro. Non inviare password via email non cifrata o messaggi di chat non protetti.

> ℹ️ **NOTA:** Dopo la creazione, l'utente avrà solo il ruolo base assegnato. Per configurare i permessi granulari (ruoli RBAC, override, assegnazioni entity/store), procedere come descritto nella Sezione 5.

### 3.3 Modifica di un utente esistente

La modifica dei dati di un utente avviene direttamente nella riga della tabella utenti (editing inline):

1. Individuare l'utente nella lista.
2. Fare clic sulla riga o sull'icona di modifica.
3. Modificare i campi desiderati:
   - Nome completo
   - Indirizzo email
   - Ruolo base
4. Confermare le modifiche facendo clic su **"Salva"**.

> ⚠️ **ATTENZIONE:** La modifica del ruolo base può cambiare immediatamente le sezioni accessibili all'utente. Assicurarsi che l'utente sia informato del cambio di permessi.

### 3.4 Reset della password

Se un utente dimentica la propria password o è necessario reimpostarla per motivi di sicurezza:

1. Individuare l'utente nella lista.
2. Fare clic sul pulsante **"Reset password"**.
3. Inserire o generare una nuova password temporanea.
4. Comunicare la nuova password all'utente tramite canale sicuro.

### 3.5 Disattivazione e riattivazione utente

Quando un utente non deve più accedere al sistema (ad esempio, in caso di cessazione del rapporto di lavoro o trasferimento), è possibile disattivarlo senza cancellare definitivamente l'account.

**Per disattivare un utente:**

1. Individuare l'utente nella lista.
2. Fare clic sul toggle di stato (attivo/inattivo).
3. Confermare l'operazione nella finestra di dialogo che appare.

**Per riattivare un utente disattivato:**

1. Individuare l'utente nella lista (gli utenti disattivati rimangono visibili).
2. Fare clic sul toggle di stato per riportarlo su "Attivo".
3. Confermare l'operazione.

> ℹ️ **NOTA:** La disattivazione è un'operazione reversibile (soft delete): l'account e tutti i suoi dati vengono conservati, ma l'utente non potrà effettuare il login. Questa è la procedura consigliata rispetto alla cancellazione definitiva.

---

## 4. Gestione Ruoli e Permessi

La sezione Ruoli & Permessi è accessibile dal menu laterale alla voce "Admin" → "RBAC" → URL: `/admin/rbac`. La pagina è organizzata in due tab:

- **Tab "Ruoli"** — Gestione dei ruoli RBAC e dei permessi associati
- **Tab "Permessi utente"** — Configurazione dei permessi specifici per singolo utente

### 4.1 Tab "Ruoli"

#### 4.1.1 Visualizzazione dei ruoli

La tab "Ruoli" mostra l'elenco di tutti i ruoli RBAC definiti nel sistema. Per ciascun ruolo è indicato il numero di permessi attualmente assegnati.

Per visualizzare i dettagli di un ruolo:

1. Fare clic sul nome del ruolo nella lista.
2. Il pannello dei dettagli mostra tutti i permessi assegnati al ruolo, raggruppati per modulo (es. Sales, Stores, Tickets, ecc.).

#### 4.1.2 Aggiungere permessi a un ruolo

Per aggiungere uno o più permessi a un ruolo RBAC:

1. Selezionare il ruolo dalla lista.
2. Fare clic su **"Aggiungi permessi"**.
3. Nella finestra modale che appare, selezionare i permessi desiderati:
   - Utilizzare le **checkbox** per selezionare singoli permessi
   - Utilizzare la **barra di ricerca testuale** per filtrare i permessi per nome o codice
   - Utilizzare la **selezione per modulo** per selezionare tutti i permessi di un'intera area (es. tutti i permessi del modulo "Sales")
4. Confermare facendo clic su **"Salva"**.

#### 4.1.3 Rimuovere un permesso da un ruolo

Per rimuovere un permesso già assegnato a un ruolo:

1. Selezionare il ruolo dalla lista.
2. Individuare il permesso da rimuovere nell'elenco dei permessi assegnati.
3. Fare clic sull'**icona cestino** accanto al permesso.
4. Confermare la rimozione nel messaggio di conferma inline che appare.

> ⚠️ **ATTENZIONE:** La rimozione di un permesso da un ruolo ha effetto immediato su tutti gli utenti che hanno quel ruolo assegnato. Prima di rimuovere un permesso, verificare quanti utenti ne sono impattati.

---

## 5. Configurazione Permessi per Singolo Utente

La tab "Permessi utente" (`/admin/rbac` → tab Permessi utente) permette di configurare nel dettaglio i permessi di un singolo utente. Questa sezione è suddivisa in tre pannelli.

### 5.1 Selezione utente

1. Aprire il menu a tendina (dropdown) nella parte superiore della pagina.
2. Selezionare l'utente da configurare.

Una volta selezionato, i tre pannelli sottostanti mostreranno la configurazione corrente dell'utente.

### 5.2 Pannello Ruoli RBAC

Questo pannello mostra i ruoli RBAC attualmente assegnati all'utente selezionato e permette di aggiungerne di nuovi o rimuovere quelli esistenti.

**Per aggiungere un ruolo RBAC:**

1. Fare clic su **"Aggiungi ruolo"** nel pannello.
2. Selezionare il ruolo desiderato dall'elenco.
3. Confermare l'assegnazione.

**Per rimuovere un ruolo RBAC:**

1. Individuare il ruolo da rimuovere nella lista.
2. Fare clic sull'icona di rimozione.
3. Confermare la rimozione.

> ℹ️ **NOTA:** Un utente può avere più ruoli RBAC contemporaneamente. I permessi si sommano: l'utente ottiene l'unione di tutti i permessi di tutti i ruoli assegnati.

### 5.3 Pannello Override Permessi

Questo pannello permette di definire eccezioni ai permessi per il singolo utente, sovrascrivendo quanto ereditato dai ruoli RBAC.

**Per aggiungere un override:**

1. Fare clic su **"Aggiungi override"**.
2. Selezionare il permesso da sovrascrivere.
3. Scegliere il tipo di override:
   - **Allow:** concede il permesso (anche se non presente nei ruoli)
   - **Deny:** nega il permesso (anche se presente nei ruoli)
4. Definire lo scope dell'override (GLOBAL, ENTITY, STORE o MODULE).
5. Salvare l'override.

> ⚠️ **ATTENZIONE:** Utilizzare gli override con estrema cautela. Un override Deny ha sempre la priorità massima e non può essere superato da un Allow proveniente da un ruolo RBAC.

### 5.4 Pannello Assegnazioni Entity/Store

Questo pannello definisce su quali dati l'utente può operare. Le assegnazioni determinano il perimetro geografico/organizzativo dell'utente.

**Per aggiungere un'assegnazione:**

1. Fare clic su **"Aggiungi assegnazione"**.
2. Selezionare il tipo di assegnazione:
   - **Entity:** selezionare IT01, IT02 o IT03 dal menu a tendina
   - **Store:** inserire manualmente il codice store (es. IT207)
3. Selezionare il tipo di assegnazione:
   - **PRIMARY:** assegnazione principale (l'utente è responsabile diretto)
   - **SECONDARY:** assegnazione secondaria (accesso supplementare)
   - **TEMP:** assegnazione temporanea (ad esempio, per sostituzioni o periodi limitati)
4. Inserire eventuali note (campo opzionale, utile per indicare il motivo dell'assegnazione o la data di scadenza prevista per le assegnazioni TEMP).
5. Salvare l'assegnazione.

> ℹ️ **NOTA:** Le assegnazioni TEMP non hanno una scadenza automatica. L'amministratore deve ricordarsi di rimuoverle manualmente al termine del periodo previsto. Si consiglia di utilizzare il campo "Note" per annotare la data di scadenza.

---

## 6. Catalogo Permessi del Sistema

La tabella seguente elenca tutti i permessi attualmente configurati nel sistema, raggruppati per modulo di appartenenza.

| Codice permesso          | Modulo  | Descrizione                                                                           |
| ------------------------ | ------- | ------------------------------------------------------------------------------------- |
| `system.admin`           | system  | Bypass completo di tutti i controlli di accesso. Da assegnare solo ad amministratori. |
| `sales.view`             | sales   | Visualizza i dati di vendita (filtrati in base alle assegnazioni entity/store).       |
| `sales.import`           | sales   | Permette l'importazione dei dati da Navision nel modulo vendite.                      |
| `sales.export`           | sales   | Permette l'esportazione dei report vendite in formato scaricabile.                    |
| `stores.view`            | stores  | Visualizza l'elenco dei negozi e le relative informazioni.                            |
| `stores.exclude_manage`  | stores  | Gestisce la lista degli store esclusi dai calcoli aggregati.                          |
| `nav.credentials.view`   | nav     | Visualizza le credenziali di accesso a Navision (in sola lettura).                    |
| `nav.credentials.manage` | nav     | Modifica le credenziali di accesso a Navision.                                        |
| `users.view`             | users   | Visualizza la lista degli utenti registrati nel sistema.                              |
| `users.manage`           | users   | Crea, modifica e gestisce gli account utente.                                         |
| `tickets.view`           | tickets | Visualizza i ticket esistenti.                                                        |
| `tickets.create`         | tickets | Crea nuovi ticket di assistenza o segnalazione.                                       |
| `tickets.manage`         | tickets | Gestisce tutti i ticket (modifica stato, assegnazione, chiusura).                     |

> ⚠️ **ATTENZIONE:** Il permesso `system.admin` garantisce accesso illimitato a tutto il sistema, bypassando ogni altro controllo. Assegnarlo esclusivamente agli amministratori di sistema e limitarne il numero al minimo indispensabile.

---

## 7. Scenari Operativi di Esempio

Questa sezione presenta scenari concreti per guidare l'amministratore nella configurazione più comune degli utenti.

### 7.1 Scenario: Nuovo Store Manager

**Contesto:** Laura Bianchi è stata assunta come Store Manager del negozio IT207 (entity IT02).

**Procedura:**

1. **Creare l'utente** (Sezione 3.2):
   - Nome completo: Laura Bianchi
   - Username: l.bianchi
   - Email: l.bianchi@flyingtiger.it
   - Password temporanea: (generare una password sicura)
   - Ruolo: STORE
2. **Configurare i permessi utente** (Sezione 5):
   - Selezionare l'utente "Laura Bianchi" dal dropdown
   - Assegnare il ruolo RBAC "Store Manager" dal pannello Ruoli
   - Aggiungere un'assegnazione Store: codice IT207, tipo PRIMARY
3. **Comunicare le credenziali** a Laura tramite canale sicuro.

**Risultato:** Laura può accedere all'area ticket e visualizzare i dati relativi al solo negozio IT207.

### 7.2 Scenario: Nuovo District Manager

**Contesto:** Marco Verdi è il nuovo District Manager per l'entity IT01.

**Procedura:**

1. **Creare l'utente:**
   - Nome: Marco Verdi, Username: m.verdi, Ruolo: DM
2. **Configurare i permessi:**
   - Assegnare il ruolo RBAC "District Manager"
   - Aggiungere assegnazione Entity: IT01, tipo PRIMARY
3. Se Marco deve anche poter esportare i report vendite, **aggiungere un override:**
   - Permesso: `sales.export`, Tipo: Allow, Scope: ENTITY

### 7.3 Scenario: Sostituzione temporanea

**Contesto:** Anna Neri, DM di IT03, deve temporaneamente coprire anche IT02 per un mese.

**Procedura:**

1. Accedere ai permessi utente di Anna Neri (Sezione 5).
2. Aggiungere un'assegnazione Entity: **IT02**, tipo **TEMP**.
3. Inserire nelle Note: "Sostituzione fino al 30/04/2026 per assenza di Mario Rossi".

> ⚠️ **ATTENZIONE:** Ricordarsi di rimuovere l'assegnazione TEMP alla scadenza indicata. Il sistema non prevede la rimozione automatica.

### 7.4 Scenario: Revocare l'accesso a un modulo specifico

**Contesto:** Paolo Gialli, utente HO, non deve più poter importare dati da Navision.

**Procedura:**

1. Accedere ai permessi utente di Paolo Gialli (Sezione 5).
2. Nel pannello Override, aggiungere:
   - Permesso: `sales.import`, Tipo: **Deny**, Scope: **GLOBAL**

**Risultato:** Anche se il ruolo RBAC di Paolo include `sales.import`, l'override Deny blocca questa specifica azione.

---

## 8. Glossario

| Termine          | Definizione                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| **Assegnazione** | Associazione tra un utente e un'entity o uno store, che definisce il perimetro di dati accessibili. |
| **Deny**         | Tipo di override che nega esplicitamente un permesso a un utente, con priorità massima.             |
| **Entity**       | Raggruppamento organizzativo di negozi. FTC HUB gestisce tre entity: IT01, IT02, IT03.              |
| **Override**     | Eccezione configurata per un singolo utente che sovrascrive i permessi ereditati dai ruoli RBAC.    |
| **Permesso**     | Azione specifica che un utente può compiere nel sistema (es. `sales.view`, `tickets.create`).       |
| **PRIMARY**      | Tipo di assegnazione che indica la responsabilità principale di un utente su un'entity o store.     |
| **RBAC**         | Role-Based Access Control. Sistema di controllo accessi basato su ruoli, con permessi associati.    |
| **Ruolo base**   | Primo livello di controllo accessi. Definisce le macro-aree accessibili (ADMIN, HO, DM, STORE).     |
| **Ruolo RBAC**   | Raggruppamento di permessi con un nome descrittivo, assegnabile a uno o più utenti.                 |
| **Scope**        | Contesto in cui si applica un permesso: GLOBAL, ENTITY, STORE o MODULE.                             |
| **SECONDARY**    | Tipo di assegnazione per un accesso supplementare a un'entity o store.                              |
| **Soft delete**  | Disattivazione reversibile: l'account viene disabilitato ma non cancellato definitivamente.         |
| **Store**        | Singolo punto vendita identificato da un codice univoco (es. IT207).                                |
| **TEMP**         | Tipo di assegnazione temporanea, da rimuovere manualmente alla scadenza.                            |

---

## 9. Appendice: Checklist di configurazione nuovo utente

Utilizzare la seguente checklist per assicurarsi di completare tutti i passaggi necessari alla configurazione di un nuovo utente:

| ☐   | Passaggio            | Dettaglio                                                                                     |
| --- | -------------------- | --------------------------------------------------------------------------------------------- |
| ☐   | 1. Creazione account | Creare l'utente con nome, username, email, password temporanea e ruolo base                   |
| ☐   | 2. Ruoli RBAC        | Assegnare uno o più ruoli RBAC appropriati al profilo dell'utente                             |
| ☐   | 3. Assegnazioni      | Configurare le assegnazioni entity e/o store con il tipo corretto (PRIMARY, SECONDARY, TEMP)  |
| ☐   | 4. Override          | Se necessario, aggiungere override specifici (Allow o Deny)                                   |
| ☐   | 5. Verifica          | Verificare la configurazione complessiva dalla tab Permessi utente                            |
| ☐   | 6. Comunicazione     | Comunicare le credenziali all'utente tramite canale sicuro                                    |
| ☐   | 7. Test              | Chiedere all'utente di effettuare il primo accesso e verificare che i permessi siano corretti |

---

_FTC HUB — Manuale Utente v1.0 — Marzo 2026_

_Flying Tiger Copenhagen Italia — Uso interno_

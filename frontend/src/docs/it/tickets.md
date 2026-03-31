# [FTC HUB] — MANUALE UTENTE

## Sistema di Ticketing

| Campo | Valore |
|-------|--------|
| **Versione** | 1.0 |
| **Data** | Aprile 2026 |
| **Classificazione** | Uso interno |
| **Destinatari** | Tutti gli utenti FTC HUB |

---

## Indice

1. [Panoramica del Sistema Ticket](#1-panoramica-del-sistema-ticket)
   - 1.1 [Cos'è il sistema ticket](#11-cosè-il-sistema-ticket)
   - 1.2 [Chi può usarlo e cosa può fare](#12-chi-può-usarlo-e-cosa-può-fare)
   - 1.3 [Il ciclo di vita di un ticket](#13-il-ciclo-di-vita-di-un-ticket)
   - 1.4 [Priorità e SLA](#14-priorità-e-sla)
   - 1.5 [Categorie e sottocategorie](#15-categorie-e-sottocategorie)
   - 1.6 [Team di supporto e routing automatico](#16-team-di-supporto-e-routing-automatico)
2. [Manuale d'Uso](#2-manuale-duso)
   - 2.1 [Aprire un nuovo ticket](#21-aprire-un-nuovo-ticket)
   - 2.2 [L'assistente AI](#22-lassistente-ai)
   - 2.3 [Visualizzare i propri ticket](#23-visualizzare-i-propri-ticket)
   - 2.4 [Vedere i dettagli di un ticket](#24-vedere-i-dettagli-di-un-ticket)
   - 2.5 [Aggiungere commenti e note interne](#25-aggiungere-commenti-e-note-interne)
   - 2.6 [Allegare file](#26-allegare-file)
   - 2.7 [Prendere in carico un ticket](#27-prendere-in-carico-un-ticket)
   - 2.8 [Assegnare un ticket a un collega](#28-assegnare-un-ticket-a-un-collega)
   - 2.9 [Inoltrare un ticket a un altro team](#29-inoltrare-un-ticket-a-un-altro-team)
   - 2.10 [Chiudere un ticket](#210-chiudere-un-ticket)
   - 2.11 [Storico ticket](#211-storico-ticket)
   - 2.12 [Dashboard (solo ADMIN)](#212-dashboard-solo-admin)
   - 2.13 [Performance (solo ADMIN)](#213-performance-solo-admin)
   - 2.14 [Archivio e History](#214-archivio-e-history)
   - 2.15 [Notifiche](#215-notifiche)

---

## 1. Panoramica del Sistema Ticket

### 1.1 Cos'è il sistema ticket

Il sistema ticket di FTC HUB è lo strumento ufficiale per richiedere assistenza, segnalare problemi e tracciare le attività di supporto all'interno di Flying Tiger Copenhagen Italia.

Ogni richiesta viene registrata come un **ticket**: un documento digitale che contiene tutte le informazioni sul problema, chi lo ha aperto, chi lo sta gestendo e come è stato risolto. In questo modo nessuna richiesta va persa e tutte le parti coinvolte possono seguire l'avanzamento in tempo reale.

Il sistema è accessibile dalla sezione **Ticket** nel menu principale di FTC HUB.

---

### 1.2 Chi può usarlo e cosa può fare

Tutti gli utenti FTC HUB hanno accesso al sistema ticket, ma con permessi differenti in base al proprio ruolo.

| Ruolo | Può creare ticket | Vede i ticket | Può gestire (assegnare, chiudere) | Dashboard | Performance |
|-------|:-----------------:|:-------------:|:---------------------------------:|:---------:|:-----------:|
| STORE / STOREMANAGER | Sì | Solo i propri | No | No | No |
| DM | Sì | I propri | No | No | No |
| HO (generico) | Sì | Del proprio team | Sì (se manager) | No | No |
| IT | Sì | Tutti | Sì | Sì | Sì |
| ADMIN / SUPERUSER | Sì | Tutti | Sì | Sì | Sì |

**Descrizione dei ruoli:**

- **STORE / STOREMANAGER** — Il personale e i responsabili dei punti vendita. Possono aprire ticket per segnalare problemi (es. stampante guasta, accesso bloccato) e seguire lo stato delle proprie richieste.
- **DM (District Manager)** — Possono aprire ticket e visualizzare le proprie richieste.
- **HO (Head Office)** — Il personale degli uffici centrali. I manager HO possono anche gestire i ticket del proprio team.
- **IT** — Il team tecnico. Gestisce tutti i ticket, può assegnare, chiudere e accedere alle statistiche.
- **ADMIN / SUPERUSER** — Hanno accesso completo a tutte le funzionalità del sistema, incluse Dashboard e Performance.

> ℹ️ **NOTA:** Il codice negozio viene associato automaticamente al ticket per gli utenti con ruolo STORE e STOREMANAGER. Non è necessario inserirlo manualmente.

---

### 1.3 Il ciclo di vita di un ticket

Dal momento in cui viene creato a quando viene chiuso, un ticket attraversa diversi stati. Conoscerli aiuta a capire in che fase si trova la propria richiesta.

| Stato | Etichetta visualizzata | Significato |
|-------|------------------------|-------------|
| `open` | Aperto | Il ticket è stato creato ma non ancora preso in carico da nessuno |
| `in_progress` | In lavorazione | Un operatore ha preso in carico il ticket e sta lavorando alla soluzione |
| `waiting` | In attesa | L'operatore è in attesa di una risposta o di ulteriori informazioni dal richiedente |
| `closed` | Chiuso | Il problema è stato risolto e il ticket è stato chiuso |

**Flusso tipico:**

```
Aperto → In lavorazione → Chiuso
           ↕
        In attesa
```

> ℹ️ **NOTA:** Un ticket in stato "In attesa" torna automaticamente a "In lavorazione" non appena il richiedente aggiunge un nuovo commento.

---

### 1.4 Priorità e SLA

Ogni ticket ha una priorità che determina il tempo massimo entro cui deve essere risolto (SLA — Service Level Agreement).

| Priorità | Descrizione | Tempo massimo di risoluzione |
|----------|-------------|:----------------------------:|
| Bassa (low) | Problemi non urgenti, possono attendere | 7 giorni |
| Media (medium) | Problemi che rallentano il lavoro ma non lo bloccano | 3 giorni |
| Alta (high) | Problemi che bloccano attività importanti | 24 ore |
| Critica (critical) | Blocco totale delle operazioni, emergenza | 4 ore |

La priorità viene suggerita automaticamente dall'assistente AI al momento della creazione del ticket, ma può essere modificata da un operatore o manager.

> ⚠️ **ATTENZIONE:** I ticket con priorità **Critica** richiedono una risposta immediata. Utilizzare questa priorità solo per vere emergenze operative (es. cassa completamente bloccata, impossibilità totale di accedere ai sistemi).

---

### 1.5 Categorie e sottocategorie

Le categorie servono a classificare il tipo di problema e a instradarlo automaticamente al team di supporto corretto.

Ogni ticket deve avere:
- una **categoria** (es. Hardware, Software, Accessi, Logistica)
- una **sottocategoria** che specifica ulteriormente il problema (es. Hardware → Stampante)

L'assistente AI suggerisce categoria e sottocategoria in automatico analizzando il testo del ticket. L'operatore può comunque modificarle se necessario.

> ℹ️ **NOTA:** Scegliere la categoria corretta è importante perché il sistema la usa per assegnare automaticamente il ticket al team giusto. Se la categoria non è corretta, il ticket potrebbe arrivare al team sbagliato.

---

### 1.6 Team di supporto e routing automatico

I **team di supporto** sono gruppi di operatori specializzati per area (es. Team IT, Team HR, Team Logistica). Ogni team gestisce una o più categorie di ticket.

**Come funziona il routing automatico:**

1. L'utente crea un ticket e l'AI suggerisce categoria e sottocategoria.
2. Il sistema consulta le **regole di routing**: tabelle che associano categoria + sottocategoria a un team specifico e, in alcuni casi, a un operatore predefinito.
3. Il ticket viene assegnato automaticamente al team corretto.
4. Se l'operatore principale non è disponibile, il sistema utilizza gli **operatori di backup** definiti nelle regole.

> ℹ️ **NOTA:** Il routing automatico non richiede alcuna azione da parte del richiedente. Basta descrivere bene il problema e il sistema si occupa del resto.

---

## 2. Manuale d'Uso

### 2.1 Aprire un nuovo ticket

Per richiedere assistenza è necessario aprire un nuovo ticket. Ecco come procedere passo per passo.

**Procedura:**

1. Dal menu principale di FTC HUB, selezionare la sezione **Ticket**.
2. Fare clic sul pulsante **Nuovo ticket** (in alto a destra).
3. Compilare il modulo con le informazioni richieste (vedi tabella sotto).
4. Fare clic su **Invia** per creare il ticket.

**Campi del modulo:**

| Campo | Obbligatorio | Descrizione |
|-------|:------------:|-------------|
| Titolo | Sì | Breve descrizione del problema (es. "Stampante cassa non funziona") |
| Descrizione | Sì | Spiegazione dettagliata del problema: cosa succede, quando è iniziato, cosa si è già provato |
| Nome richiedente | Sì | Il proprio nome e cognome |
| Email | Sì | Indirizzo email per ricevere aggiornamenti |
| Telefono | No | Numero di telefono per eventuali contatti rapidi |
| Codice TeamViewer | No | Codice per il controllo remoto del PC (richiesto dall'operatore se necessario) |

> ℹ️ **NOTA:** Per gli utenti STORE e STOREMANAGER, il codice negozio viene aggiunto automaticamente. Non è necessario inserirlo.

> ⚠️ **ATTENZIONE:** Descrivere il problema nel modo più dettagliato possibile. Una descrizione precisa permette all'AI di classificare correttamente il ticket e all'operatore di intervenire più rapidamente.

**Scenario pratico:** Il negozio IT207 ha un problema con la stampante degli scontrini. Lo store manager apre un nuovo ticket con titolo "Stampante scontrini non risponde" e descrive nella sezione descrizione: "La stampante della cassa 1 non stampa dall'apertura del negozio. Il display mostra 'Errore carta' ma la carta è presente e correttamente inserita. Riavviato il dispositivo senza risultati."

---

### 2.2 L'assistente AI

Al momento dell'invio del ticket, il sistema attiva automaticamente l'**assistente AI** che analizza il contenuto e svolge tre operazioni:

1. **Migliora la descrizione** — Riscrive il testo inserito dall'utente in modo più chiaro e strutturato, mantenendo tutte le informazioni originali.
2. **Suggerisce categoria e sottocategoria** — Classifica automaticamente il problema.
3. **Suggerisce la priorità** — Valuta l'urgenza del problema in base al contenuto.

Il ticket viene creato con la descrizione migliorata e i suggerimenti dell'AI, che possono essere modificati dagli operatori.

**Cosa succede se l'AI rifiuta la richiesta:**

In alcuni casi l'AI può determinare che la richiesta non è pertinente al sistema di ticketing (es. richiesta non inerente all'operatività aziendale). In questo caso:

- Il ticket **non viene creato**.
- L'utente visualizza un messaggio con la spiegazione del motivo del rifiuto.
- L'utente può modificare la richiesta e riprovare.

> ℹ️ **NOTA:** Il rifiuto da parte dell'AI è raro e si verifica solo quando la richiesta è chiaramente fuori ambito. In caso di dubbio, contattare direttamente il proprio responsabile o il team IT.

---

### 2.3 Visualizzare i propri ticket

**Vista STORE / STOREMANAGER / DM:**

1. Accedere alla sezione **Ticket** dal menu principale.
2. Vengono mostrati solo i ticket creati dal proprio account o dal proprio negozio.
3. È possibile filtrare per stato (Aperto, In lavorazione, In attesa, Chiuso) e per categoria.

**Vista HO / IT / ADMIN:**

1. Accedere alla sezione **Ticket**.
2. Vengono mostrati tutti i ticket di competenza (per HO: ticket del proprio team; per IT e ADMIN: tutti i ticket).
3. Sono disponibili filtri avanzati: per stato, priorità, categoria, team assegnato, operatore, data di creazione.

> ℹ️ **NOTA:** La lista ticket si aggiorna in tempo reale. Non è necessario ricaricare la pagina.

---

### 2.4 Vedere i dettagli di un ticket

Per aprire il dettaglio di un ticket:

1. Dalla lista ticket, fare clic sulla riga del ticket desiderato.
2. Si apre la scheda completa con tutte le informazioni:
   - Numero ticket, titolo, descrizione (originale e versione AI)
   - Stato, priorità, categoria, sottocategoria
   - Team e operatore assegnati
   - Dati del richiedente
   - Date di creazione, presa in carico e chiusura
   - Tempo di risoluzione (calcolato automaticamente alla chiusura)
   - Tutti i commenti e gli allegati

---

### 2.5 Aggiungere commenti e note interne

I commenti permettono di comunicare all'interno del ticket, tenendo traccia di tutte le interazioni.

**Commento normale:**

1. Aprire il dettaglio del ticket.
2. Nella sezione **Commenti**, digitare il messaggio nel campo di testo.
3. Fare clic su **Invia commento**.

Il commento è visibile a tutte le parti coinvolte: richiedente e operatori.

**Nota interna:**

1. Aprire il dettaglio del ticket.
2. Nella sezione **Commenti**, spuntare l'opzione **Nota interna**.
3. Digitare il messaggio e fare clic su **Invia**.

> ⚠️ **ATTENZIONE:** Le note interne sono visibili **solo agli operatori e ai manager**. Il richiedente non può vederle. Utilizzarle per comunicazioni tra il team di supporto (es. "Ho già sentito il negozio, confermano il problema").

---

### 2.6 Allegare file

È possibile allegare documenti o immagini a un ticket per fornire ulteriori dettagli (es. screenshot di un errore, foto di un'etichetta danneggiata).

**Formati supportati:** JPG, PNG, GIF, WebP, PDF

**Dimensione massima:** 5 MB per file

**Come allegare un file:**

1. Aprire il dettaglio del ticket.
2. Fare clic su **Allega file** (o sull'icona a forma di graffetta).
3. Selezionare il file dal proprio dispositivo.
4. Fare clic su **Carica**.

L'allegato apparirà nella sezione apposita della scheda ticket e sarà accessibile a tutti gli utenti autorizzati a vedere quel ticket.

> ⚠️ **ATTENZIONE:** Non allegare documenti contenenti dati personali sensibili se non strettamente necessario.

---

### 2.7 Prendere in carico un ticket

Questa funzione è disponibile per operatori IT, HO manager e ADMIN.

Prendere in carico un ticket significa dichiarare che si è la persona responsabile della risoluzione. Il ticket passa dallo stato **Aperto** a **In lavorazione**.

**Procedura:**

1. Aprire il dettaglio del ticket.
2. Fare clic sul pulsante **Prendi in carico**.
3. Il ticket viene assegnato al proprio account e lo stato cambia in **In lavorazione**.

> ℹ️ **NOTA:** Prendendo in carico un ticket, il richiedente riceve una notifica che la sua richiesta è stata raccolta e che qualcuno ci sta lavorando.

---

### 2.8 Assegnare un ticket a un collega

Se un ticket deve essere gestito da un altro operatore del proprio team, è possibile assegnarlo direttamente.

**Procedura:**

1. Aprire il dettaglio del ticket.
2. Fare clic su **Assegna a** (nella sezione Operatore assegnato).
3. Selezionare il collega dall'elenco degli operatori disponibili.
4. Confermare l'assegnazione.

Il collega riceverà una notifica in-app dell'assegnazione.

**Azioni massive:** Se si devono assegnare più ticket contemporaneamente, dalla lista ticket è possibile selezionare più righe e usare il pulsante **Assegna selezionati** per effettuare l'operazione in blocco.

---

### 2.9 Inoltrare un ticket a un altro team

Se un ticket è arrivato al team sbagliato o necessita dell'intervento di un altro reparto, è possibile reindirizzarlo.

**Procedura:**

1. Aprire il dettaglio del ticket.
2. Fare clic su **Inoltra a team**.
3. Selezionare il team di destinazione dall'elenco.
4. Aggiungere eventualmente un commento per spiegare il motivo dell'inoltro.
5. Confermare.

Il ticket viene rimosso dalla coda del team attuale e aggiunto a quella del team selezionato. Il richiedente viene informato tramite notifica.

---

### 2.10 Chiudere un ticket

Un ticket può essere chiuso una volta che il problema è stato risolto.

**Procedura:**

1. Aprire il dettaglio del ticket.
2. Fare clic su **Chiudi ticket**.
3. Inserire una nota di chiusura (facoltativa ma consigliata) che descriva come il problema è stato risolto.
4. Confermare.

Il ticket passa allo stato **Chiuso** e viene registrato il tempo di risoluzione. Il richiedente riceve una notifica.

**Azioni massive:** Dalla lista ticket è possibile selezionare più ticket e chiuderli tutti in una volta tramite il pulsante **Chiudi selezionati**.

> ⚠️ **ATTENZIONE:** Un ticket chiuso non può essere riaperto automaticamente. Se il problema si ripresenta, aprire un nuovo ticket e fare riferimento al numero del ticket precedente nella descrizione.

---

### 2.11 Storico ticket

La sezione **Storico** permette agli utenti STORE di consultare i ticket passati del proprio negozio.

**Come accedere:**

1. Dal menu **Ticket**, selezionare la scheda **Storico**.
2. Utilizzare i filtri disponibili:
   - **Categoria**: per filtrare per tipo di problema
   - **Anno**: per consultare i ticket di anni precedenti

Questa sezione è utile per verificare se un problema si è già verificato in passato e come è stato risolto.

---

### 2.12 Dashboard (solo ADMIN)

La **Dashboard** è disponibile esclusivamente per gli utenti con ruolo ADMIN e IT. Offre una visione d'insieme sullo stato attuale del sistema.

**Contenuti della Dashboard:**

| Sezione | Descrizione |
|---------|-------------|
| Riepilogo per team | Numero di ticket aperti, in lavorazione e in attesa per ogni team |
| Riepilogo per categoria | Distribuzione dei ticket per categoria |
| Riepilogo per sottocategoria | Dettaglio per sottocategoria |
| Riepilogo per operatore | Carico di lavoro di ogni singolo operatore |

> ℹ️ **NOTA:** La Dashboard si aggiorna automaticamente ogni **60 secondi**. Non è necessario ricaricare la pagina per avere i dati aggiornati.

---

### 2.13 Performance (solo ADMIN)

La sezione **Performance** è disponibile per ADMIN e IT. Contiene i KPI (indicatori di performance) del sistema di supporto.

**Informazioni disponibili:**

| Indicatore | Descrizione |
|------------|-------------|
| SLA compliance | Percentuale di ticket risolti entro i tempi SLA previsti |
| Tempo medio di risoluzione | Media dei tempi di chiusura per priorità e per team |
| Trend | Andamento del volume di ticket nel tempo (giornaliero, settimanale, mensile) |
| Ticket per operatore | Numero di ticket gestiti e tempi medi per ogni operatore |

Questi dati possono essere utilizzati per monitorare l'efficienza del supporto e identificare eventuali criticità ricorrenti.

---

### 2.14 Archivio e History

La sezione **Archivio** (o **History**) contiene tutti i ticket in stato **Chiuso**.

Per ogni ticket archiviato sono visibili:
- Tutti i dati del ticket (descrizione, commenti, allegati)
- Data di creazione e data di chiusura
- **Tempo di risoluzione** calcolato automaticamente

Questa sezione è utile sia per il team di supporto (analisi post-chiusura) sia per i richiedenti che vogliono consultare richieste passate.

> ℹ️ **NOTA:** I ticket archiviati non possono essere modificati. È possibile solo consultarli.

---

### 2.15 Notifiche

Il sistema invia notifiche in-app per tenere aggiornati tutti gli utenti coinvolti in un ticket.

**Quando arriva una notifica:**

| Evento | Chi riceve la notifica |
|--------|------------------------|
| Nuovo ticket creato | Gli operatori del team assegnato |
| Ticket preso in carico | Il richiedente |
| Ticket assegnato a un operatore | L'operatore assegnato |
| Nuovo commento aggiunto | Il richiedente e gli operatori coinvolti |
| Ticket inoltrato a un altro team | Gli operatori del nuovo team |
| Ticket chiuso | Il richiedente |

**Dove si vedono le notifiche:**

Le notifiche appaiono nell'icona a campana nella barra superiore di FTC HUB. Il numero in rosso indica le notifiche non lette. Facendo clic sull'icona si apre il pannello con l'elenco delle notifiche recenti; facendo clic su una notifica si viene reindirizzati direttamente al ticket corrispondente.

> ℹ️ **NOTA:** Le notifiche sono solo in-app. Non vengono inviate email automatiche, salvo diversa configurazione da parte dell'ADMIN.

---

*Documento generato per FTC HUB — Flying Tiger Copenhagen Italia — Uso interno*

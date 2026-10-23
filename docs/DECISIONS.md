# Decisioni di progetto

## Coda di autosave (sessione di logging)

### Deduplicazione e versione
- Ogni entry ha una chiave `(exerciseLogId, setNumber)` e una `version` incrementale.
- La Map ammette **una sola entry per chiave**: un nuovo valore sostituisce il precedente.
- Per ogni chiave, al massimo **una richiesta in volo**: se l'atleta modifica un set con una richiesta già in volo, la nuova entry aspetta e parte dopo che quella in volo è finita.
- Al successo, l'entry viene rimossa solo se la sua `version` è ancora quella inviata (evita di cancellare una modifica arrivata nel frattempo).

### PUT e DELETE nella stessa coda
- Ogni entry ha un `type: 'put' | 'delete'`.
- Una DELETE sostituisce un PUT in coda con la stessa chiave, e viceversa.

### Persistenza in localStorage
- Le chiavi localStorage della coda e della sessione attiva includono l'id utente: se cambia account, la coda di un altro non viene inviata.
- Al caricamento da localStorage, le entry "in volo" tornano "da inviare" (le chiamate sono idempotenti, il reinvio è sicuro).

### Gestione errori
- **401**: la coda si ferma, flag `needsReauth`. Il token scaduto non svuota la coda. Dopo il re-login, la coda riprende.
- **409** (sessione completata): l'entry resta visibile in errore con i suoi valori, mai rimossa in silenzio.
- **Errore di rete / 5xx**: retry con backoff esponenziale (1s → 2s → 4s → ... → 30s max).

---

## Creazione piano (trainer)

- L'API è multi-step: crea piano → aggiungi giorni → aggiungi esercizi.
- Ogni step chiama l'API immediatamente (niente "salva tutto alla fine").
- L'API non permette di modificare o cancellare giorni ed esercizi: la UI mostra un riepilogo prima di ogni aggiunta e spiega che per correggere si crea un nuovo piano (che disattiva il precedente).

---

## Routing

- Nessuna guardia di ruolo sulle rotte: la navbar mostra solo i link del ruolo corrente; l'API gestisce l'autorizzazione (403).
- `/train/:dayId` anziché `/sessions/new/:dayId` per evitare ambiguità con `/sessions/:id`.

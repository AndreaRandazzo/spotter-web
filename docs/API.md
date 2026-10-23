# API contract — per spotter.web

Un contratto per fetta, scritto quando una fetta è completa e coperta da test.
Formato libero finché rimane pensato per chi consuma l'API, non per chi la
scrive — per quello c'è il codice.

Tutte le richieste autenticate: header `Authorization: Bearer <token>`. Senza
token, o con token invalido/scaduto, ogni endpoint protetto risponde 401.

## Forma degli errori

Ogni errore (4xx, 5xx) torna lo stesso shape:

```json
{
  "timestamp": "2026-10-23T10:15:30Z",
  "status": 409,
  "error": "Conflict",
  "message": "A coaching relationship with this athlete is already open",
  "path": "/api/coaching",
  "fieldErrors": null
}
```

`fieldErrors` è un oggetto `{ "campo": "messaggio" }` solo sui 400 di validazione
Bean Validation (es. email malformata); altrimenti è `null` — su un 400 di
validazione il campo `message` resta generico ("Validation Failed"), i dettagli
sono in `fieldErrors`.

## Forma delle liste paginate

Ogni endpoint che elenca risorse accetta `page`, `size`, `sort` come query
param (default Spring Data: `page=0`, `size=20`). La risposta:

```json
{
  "content": [ /* array di oggetti della risorsa */ ],
  "totalElements": 2,
  "totalPages": 1,
  "size": 20,
  "number": 0,
  "numberOfElements": 2,
  "first": true,
  "last": true,
  "empty": false
}
```

---

## Auth

Gli unici endpoint pubblici (nessun token richiesto): `/api/auth/**` e
`GET /actuator/health`. Tutto il resto risponde 401 senza token.

### `POST /api/auth/register`

Crea un account. Ogni account nasce `ROLE_USER` — niente scelta del ruolo in
fase di registrazione (vedi GAP-06 in CODE_REVIEW.md). Risponde con lo stesso
`AuthResponse` di `/login`: non serve un login separato subito dopo.

Request:
```json
{ "email": "a@b.it", "password": "almeno-8-caratteri", "firstName": "Andrea", "lastName": "Randazzo" }
```
`password`: 8-72 caratteri (72 è il limite di BCrypt, non arbitrario).

Response (`AuthResponse`):
```json
{ "token": "eyJ...", "tokenType": "Bearer", "expiresIn": 86400 }
```
`expiresIn` in **secondi**. Il token va in `Authorization: Bearer <token>` su
ogni richiesta successiva.

| Caso | Status | Note |
|---|---|---|
| Creato | 201 | |
| Email già registrata | 409 | |
| Email malformata, password troppo corta/lunga, nome vuoto | 400 | `fieldErrors` |

### `POST /api/auth/login`

Request: `{ "email": "...", "password": "..." }`. Stessa risposta di
`register`.

| Caso | Status |
|---|---|
| Credenziali corrette | 200 |
| Email inesistente o password sbagliata | 401 — stesso messaggio generico per entrambi i casi, non si distingue se l'email esiste |

### `GET /api/users/me`

Il profilo di **chi ha fatto la richiesta** — mai di un altro utente, non
esiste un modo di risolvere l'id di un account qualsiasi (vedi la nota nella
sezione Coaching più sotto, dove serve il nome della controparte).

Response (`UserResponse`):
```json
{ "id": "uuid", "email": "a@b.it", "firstName": "Andrea", "lastName": "Randazzo",
  "roles": ["ROLE_USER"] }
```
`roles` riflette il DB in tempo reale: se sei stato promosso a `ROLE_TRAINER`
dopo aver fatto login, questa chiamata lo mostra già senza bisogno di un
nuovo login — il token non porta i ruoli, solo l'identità.

---

## Catalogo esercizi

Un catalogo globale (seminato via migration, stesso per tutti) più gli
esercizi privati che ogni trainer può aggiungere per sé.

### `GET /api/exercises`

Lista paginata: il catalogo globale **più** i tuoi esercizi privati — mai
quelli privati di un altro. `ExerciseResponse`:
```json
{ "id": "uuid", "name": "Panca piana con bilanciere", "primaryMuscle": "CHEST",
  "secondaryMuscles": ["TRICEPS", "SHOULDERS"], "ownerId": null,
  "equipment": "BILANCIERE", "techniqueNotes": null, "imageUrl": null,
  "videoUrl": null, "createdAt": "2026-10-23T10:15:30.123456Z" }
```
`ownerId: null` è il catalogo globale. `primaryMuscle` ∈ `CHEST, BACK,
SHOULDERS, BICEPS, TRICEPS, FOREARMS, QUADS, HAMSTRINGS, GLUTES, CALVES, ABS,
CARDIO`. `equipment` ∈ `BILANCIERE, BILANCIERE_EZ, CAVI, CORPO_LIBERO,
MACCHINARIO, MANUBRI, MULTIPOWER` (opzionale, può essere `null`).

### `POST /api/exercises`

Aggiunge un esercizio **tuo** (mai al catalogo globale: quello lo scrivono
solo le migration). Request (`CreateExerciseRequest`):
```json
{ "name": "Esercizio mio", "primaryMuscle": "BACK", "secondaryMuscles": ["BICEPS"],
  "equipment": "CAVI", "techniqueNotes": null, "imageUrl": null, "videoUrl": null }
```
Solo `name` e `primaryMuscle` sono obbligatori.

| Caso | Status | Note |
|---|---|---|
| Creato | 201 | |
| Hai già un esercizio tuo con lo stesso nome (case-insensitive) | 409 | |
| `name` vuoto, `primaryMuscle` assente o non valido | 400 | `fieldErrors` |

Niente modifica/cancellazione, niente endpoint di detail per un singolo id —
solo creazione e lista.

---

## Coaching

Un trainer invita un atleta via email. L'atleta accetta o declina. Una delle
due parti può chiudere la relazione in qualsiasi momento, anche dopo
l'accettazione. Una coppia trainer/atleta può riaprire una nuova relazione
dopo che la precedente si è chiusa — ogni "giro" è una riga a sé, con una
propria `startedAt`/`endedAt`.

### `CoachingRelationshipResponse`

```json
{
  "id": "uuid",
  "trainer": { "id": "uuid", "firstName": "Andrea", "lastName": "Randazzo", "email": "trainer@example.com" },
  "athlete": { "id": "uuid", "firstName": "...", "lastName": "...", "email": "athlete@example.com" },
  "status": "PENDING | ACTIVE | ENDED",
  "startedAt": "2026-10-23",
  "endedAt": null
}
```

`trainer`/`athlete` portano già nome ed email della controparte — niente
chiamata separata per mostrarli in una lista. **`GET /api/users/me` non è
quella chiamata**: restituisce sempre chi ha fatto la richiesta, non l'altra
parte della relazione; non esiste un endpoint per risolvere l'id di un utente
qualsiasi in un profilo, e non serve per questo caso.

### `POST /api/coaching`

Il trainer autenticato invita un atleta per email. Richiede `ROLE_TRAINER`.

Request:
```json
{ "athleteEmail": "athlete@example.com" }
```

| Caso | Status | Note |
|---|---|---|
| Invito creato | 201 | `CoachingRelationshipResponse`, `status: "PENDING"` |
| Chi chiama non ha `ROLE_TRAINER` | 403 | |
| Email non registrata | 404 | |
| Email malformata / vuota | 400 | `fieldErrors.athleteEmail` |
| Invitare se stessi | 400 | |
| Esiste già un invito/relazione non `ENDED` con quell'atleta | 409 | |

### `PATCH /api/coaching/{id}/accept`

Solo l'atleta invitato può accettare. `{id}` è l'id della relazione.

| Caso | Status | Note |
|---|---|---|
| Accettato | 200 | `status: "ACTIVE"` |
| Chi chiama non è l'atleta invitato, o `{id}` non esiste | 403 | Un id inesistente non distingue da "non sei tu": niente 404 |
| La relazione non è `PENDING` (già `ACTIVE` o `ENDED`) | 409 | |

### `PATCH /api/coaching/{id}/end`

Trainer o atleta della relazione possono chiuderla — anche una `PENDING`
(l'atleta la declina), anche una `ACTIVE`.

| Caso | Status | Note |
|---|---|---|
| Chiusa | 200 | `status: "ENDED"`, `endedAt` valorizzato |
| Chi chiama non è trainer né atleta di quella relazione, o `{id}` non esiste | 403 | Stesso motivo di `accept` |
| Già `ENDED` | 409 | |

### `GET /api/coaching`

Lista paginata delle relazioni dell'utente autenticato, come trainer o come
atleta — mai quelle di altri. Ordinamento default: `startedAt`, `createdAt`
decrescenti (le più recenti prima); altri `sort` via query param standard.
Filtro opzionale `status` (`PENDING`/`ACTIVE`/`ENDED`) — `?status=ACTIVE` è
"i miei atleti" dal lato trainer.

Risposta: pagina di `CoachingRelationshipResponse` (vedi sopra la forma delle
liste).

### Nota per il frontend

Non c'è ancora modo per un atleta di ottenere `ROLE_TRAINER` via API: per la
demo va promosso manualmente via SQL (vedi README del backend). Il frontend
non deve quindi offrire una UI "diventa trainer" — l'account trainer esiste
già promosso quando arriva alla UI.

---

## Piani

Un trainer costruisce un piano per un atleta con cui ha una relazione
`ACTIVE`: giorni, esercizi per giorno, target (serie, ripetizioni, RPE,
recupero). **Mai un carico target**: `targetWeight` non esiste nelle request —
il peso lo decide l'atleta in sessione, non è nel contratto del piano.

Un atleta ha **al massimo un piano attivo alla volta**. Crearne uno nuovo
disattiva automaticamente quello precedente (resta comunque leggibile per
id, solo non più quello corrente).

### Le risposte

```json
// WorkoutPlanResponse — GET /api/plans/{id}, GET /api/plans/me, risposta di POST /api/plans
{
  "id": "uuid",
  "athleteId": "uuid",
  "createdByTrainerId": "uuid",
  "name": "Upper/Lower",
  "description": null,
  "active": true,
  "validFrom": null,
  "validTo": null,
  "days": [
    {
      "id": "uuid",
      "name": "Push day",
      "dayOfWeek": null,
      "orderIndex": 0,
      "exercises": [
        {
          "id": "uuid",
          "exerciseId": "uuid",
          "exerciseName": "Panca piana con bilanciere",
          "orderIndex": 0,
          "targetSets": 4,
          "targetReps": "8-12",
          "targetRpe": 8,
          "restSeconds": 90,
          "notes": null
        }
      ]
    }
  ]
}
```

```json
// WorkoutPlanSummaryResponse — dentro la pagina di GET /api/plans?athleteId=
{ "id": "uuid", "athleteId": "uuid", "name": "Upper/Lower", "active": true,
  "validFrom": null, "validTo": null }
```

`POST /api/plans/{planId}/days` risponde con l'oggetto giorno da solo
(`exercises: []`), non il piano intero. Stesso per
`POST /.../days/{dayId}/exercises`: risponde con l'esercizio da solo.

### Endpoint

| Endpoint | Chi | Cosa | Errori |
|---|---|---|---|
| `POST /api/plans` | trainer attivo sull'atleta | crea un piano — body: `athleteId`, `name`, `description?`, `validFrom?`, `validTo?` | 403 trainer non attivo su quell'atleta; 400 `validFrom > validTo` o campi mancanti |
| `POST /api/plans/{planId}/days` | trainer attivo sull'atleta del piano | aggiunge un giorno — body: `name`, `dayOfWeek?` (1-7, opzionale: le schede possono essere a rotazione) | 403 trainer non più attivo o piano di un altro atleta |
| `POST /api/plans/{planId}/days/{dayId}/exercises` | idem | aggiunge un esercizio — body: `exerciseId`, `targetSets`, `targetReps` (stringa libera: "8-12", "AMRAP"...), `targetRpe?` (1-10), `restSeconds?`, `notes?` | 403 come sopra; 404 `exerciseId` inesistente o non visibile (catalogo globale o di un altro atleta/trainer); 404 se `{dayId}` non appartiene a `{planId}` |
| `GET /api/plans/{id}` | l'atleta del piano, o un suo trainer attivo | piano completo, annidato | 403 su id inesistente o non tuo (stesso trattamento di `coaching`: non distingue "non esiste" da "non è tuo") |
| `GET /api/plans/me` | atleta | il proprio piano attivo | 404 se non ne ha uno |
| `GET /api/plans?athleteId=X` | trainer attivo su X | lista paginata di tutti i piani (anche quelli disattivati) di quell'atleta, più recente prima | 403 se non sei un trainer attivo di X |

Niente ancora per modificare o cancellare giorni/esercizi, né per
riordinarli — fuori scope per questa fetta.

---

## Logging (sessioni)

L'atleta avvia una sessione per un giorno del proprio piano, logga le serie
una alla volta, poi chiude la sessione. **Tutto il contratto è pensato per
l'autosave**: ogni chiamata di scrittura (avvio sessione, scrittura di una
serie, cancellazione di una serie) è sicura da ripetere — un retry dopo un
timeout di rete non crea mai un duplicato.

### L'id della sessione lo scegli tu, prima di chiamare l'API

`{id}` in tutte le URL sotto `/api/sessions/{id}/...` è un UUID che **generi
tu lato client**, prima della prima richiesta — non un id che il server ti
assegna. Questo significa che conosci già tutte le URL di cui avrai bisogno
(avvio, ogni set, completamento) nel momento in cui l'atleta preme "inizia
allenamento", senza aspettare nessuna risposta dal server per costruire la
richiesta successiva.

**Avviare una sessione offline non è supportato**: la prima `PUT
/api/sessions/{id}` deve arrivare al server prima che qualunque set possa
essere loggato (il server deve creare gli `ExerciseLog` dal piano). L'id
generato dal client serve a rendere *quella* chiamata sicura da ripetere se
la rete salta subito dopo averla inviata — non a metterla in coda se la rete
è già giù prima di inviarla.

### `PUT /api/sessions/{id}`

Avvia una sessione, o — se `{id}` esiste già ed è tua — ritorna quella
esistente senza ricrearla (stesso `ExerciseLog`, stesso stato). Body:
`{"planDayId": "uuid"}`.

Il server pre-crea un `ExerciseLog` per ogni esercizio del giorno scelto, già
nell'ordine del piano — non devi aggiungerli uno a uno prima di poter loggare
il primo set.

| Caso | Status | Note |
|---|---|---|
| Nuova sessione creata | 200 | `WorkoutSessionResponse` con `exerciseLogs` già popolati, nessun set |
| Stesso `{id}` richiamato di nuovo (stesso atleta) | 200 | Lo stesso oggetto di prima, body ignorato |
| `{id}` esiste già ma appartiene a un altro atleta | 403 | Collisione sull'UUID: non capita per caso, ma se capita non va a buon fine silenziosamente |
| `planDayId` non è un giorno di un **tuo** piano | 403 | |
| `planDayId` inesistente | 404 | |
| `planDayId` appartiene a un piano che hai disattivato dopo | 200 | Permesso di proposito: una sessione avviata prima che il piano cambiasse deve restare chiudibile — l'avvio non controlla `active` sul piano, solo che il giorno sia tuo |

### `PUT /api/sessions/{id}/exercise-logs/{exerciseLogId}/sets/{setNumber}`

Scrive una serie. `{setNumber}` lo numeri tu (1, 2, 3...). **Stesso
`{exerciseLogId}` + `{setNumber}` due volte = la seconda sovrascrive la
prima**, non la duplica — è il meccanismo che rende sicuro un retry.

Body:
```json
{ "reps": 10, "weight": 42.5, "rpe": 8, "isWarmup": false }
```
`reps` obbligatorio, il resto opzionale (`isWarmup` default `false` se omesso).

**Importante per chi implementa l'autosave lato client**: questo `PUT` è
idempotente rispetto al *risultato* (l'ultima scrittura per quella chiave
vince), ma **non** rispetto all'ordine di arrivo — due modifiche allo stesso
set, spedite una dopo l'altra su una rete instabile, possono arrivare al
server in ordine invertito. Il client deve tenere **una sola richiesta in
sospeso per `(exerciseLogId, setNumber)`**: se l'atleta modifica di nuovo un
set che ha ancora una richiesta in volo, quella nuova richiesta **sostituisce**
la precedente in coda, non si accoda dietro. Una coda FIFO semplice non basta.

| Caso | Status | Note |
|---|---|---|
| Scritto (nuovo o sovrascritto) | 200 | `SetLogResponse` |
| `{exerciseLogId}` non esiste in questa sessione | 404 | |
| La sessione è già `COMPLETED` | 409 | |
| Chi chiama non è l'atleta della sessione | 403 | |

### `DELETE /api/sessions/{id}/exercise-logs/{exerciseLogId}/sets/{setNumber}`

Cancella una serie. **Idempotente**: se il set non c'è (già cancellato da una
chiamata precedente, o mai esistito) risponde comunque 204, non 404 — un
retry di una cancellazione non deve mai fallire.

| Caso | Status |
|---|---|
| Cancellato, o già assente | 204 |
| La sessione è già `COMPLETED` | 409 |

### `PATCH /api/sessions/{id}/complete`

Chiude la sessione. **Idempotente anche questo**: chiamarlo due volte non è
un errore, la seconda volta ritorna lo stato attuale senza toccare
`completedAt`.

### `GET /api/sessions/{id}`

Dettaglio completo: sessione, `exerciseLogs`, e per ciascuno i `sets`
loggati finora. Visibile all'atleta o a un suo trainer attivo.

```json
{
  "id": "uuid",
  "athleteId": "uuid",
  "planDayId": "uuid",
  "planDayName": "Push day",
  "status": "IN_PROGRESS",
  "startedAt": "2026-10-23T18:00:00Z",
  "completedAt": null,
  "notes": null,
  "exerciseLogs": [
    {
      "id": "uuid",
      "exerciseId": "uuid",
      "exerciseName": "Panca piana con bilanciere",
      "orderIndex": 0,
      "notes": null,
      "sets": [
        { "setNumber": 1, "reps": 10, "weight": 42.5, "rpe": 8, "isWarmup": false,
          "completedAt": "2026-10-23T18:05:00Z" }
      ]
    }
  ]
}
```

`planDayName` ed `exerciseName` sono istantanee prese all'avvio della
sessione, non una lettura live del piano: rinominare il giorno o l'esercizio
dopo non cambia il nome registrato su una sessione già avviata.

### `GET /api/sessions`

Lista paginata. Senza `athleteId`, le tue sessioni. Con `athleteId` (solo per
un trainer attivo su quell'atleta), le sue. Filtro opzionale `status`
(`IN_PROGRESS` o `COMPLETED`). `WorkoutSessionSummaryResponse`: come sopra ma
senza `exerciseLogs`.

| Caso | Status |
|---|---|
| Ok | 200, pagina di sessioni |
| `athleteId` di un atleta che non stai allenando attivamente | 403 |

---

## Vista trainer

Nessun endpoint nuovo: è una composizione di tre chiamate già descritte sopra.

1. **"I miei atleti"** → `GET /api/coaching?status=ACTIVE`, autenticato come
   trainer. Ogni riga ha già `athlete.firstName`/`athlete.lastName`/`athlete.email`
   — nessuna chiamata in più per mostrare un nome in lista.
2. **Le sue sessioni completate** → `GET /api/sessions?athleteId={athlete.id}&status=COMPLETED`.
   403 se nel frattempo la relazione non è più `ACTIVE` — ricontrollata ad
   ogni chiamata, non solo quando la lista trainer è stata caricata.
3. **Il detail di una sessione** → `GET /api/sessions/{id}`, stesso endpoint
   usato dall'atleta.

Non c'è un endpoint "tutte le sessioni di tutti i miei atleti insieme": va
fatta una chiamata per atleta.

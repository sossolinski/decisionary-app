# Analiza kodu SaaS – Decisionary

## 1) Szybkie podsumowanie

Aplikacja to **frontend-first SaaS** oparty o Next.js (App Router) i Supabase, z logiką biznesową wykonywaną głównie po stronie klienta (wywołania Supabase z przeglądarki). Model produktu: platforma do prowadzenia symulacji tabletop (scenariusze, sesje, uczestnicy, injecty, akcje).

Największe atuty:
- Spójny podział na moduły domenowe (`sessions`, `sessionsRuntime`, `facilitator`, `users`).
- Sensowna obsługa realtime + debouncing subskrypcji.
- Rozsądne fallbacki RPC -> bezpośrednie zapytania.

Największe ryzyka:
- Duża część autoryzacji jest oparta o klienta (wymaga bardzo dobrych polityk RLS i RPC security definer).
- Duplikacja logiki między `lib/sessions.ts` i `lib/sessionsRuntime.ts` zwiększa koszt utrzymania.
- Brak testów i uboga dokumentacja architektury/operacji.

## 2) Architektura i warstwy

### Stos
- Next.js 16 + React 19 + TypeScript.
- Supabase JS (auth, query, realtime).
- UI: komponenty własne + Radix.

### Warstwa aplikacyjna
- Logika domenowa głównie w `lib/*`.
- Widoki w `app/*`.
- Middleware tylko przekierowuje `/` -> `/login` (bez auth gate na serwerze).

Ocena: **dobra baza MVP**, ale przy skalowaniu warto przesuwać krytyczne operacje na serwerowe route handlers / server actions.

## 3) Model auth i bezpieczeństwo

### Co działa dobrze
- Wymuszanie sesji użytkownika przez `requireUserId()` przed operacjami mutującymi.
- Preferencja dla RPC (np. `grant_session_role`, `start_session`, `join_session`) może dobrze centralizować reguły dostępu.

### Ryzyka
1. **Client-side gating** w UI:
   - routing i role gate są wykonywane po stronie klienta.
   - Bez mocnego RLS daje to ryzyko obejścia zasad.

2. **Fallbacki do direct insert/update/delete**:
   - gdy RPC nie istnieje, kod próbuje bezpośrednich operacji.
   - To jest OK dla kompatybilności, ale bezpieczeństwo musi być absolutnie zamknięte w RLS.

3. **Brak walidacji wejść na granicy serwera**:
   - np. teksty injectów, nazwy scenariuszy/sesji są walidowane minimalnie.

Rekomendacja krytyczna:
- Traktować klienta jako niezaufany; wszystkie uprawnienia egzekwować w RLS + RPC.
- Dodać checklistę bezpieczeństwa Supabase (RLS, funkcje SECURITY DEFINER, audyt grants).

## 4) Jakość kodu i utrzymanie

### Plusy
- Czytelne sekcje i nazewnictwo funkcji.
- Jawne typy TS dla większości encji.
- Dobra praktyka debounce przy subskrypcjach realtime.

### Obszary do poprawy
1. **Duplikacja modułów sesji**:
   - `lib/sessions.ts` i `lib/sessionsRuntime.ts` pokrywają podobny zakres.
   - Ryzyko rozjechania zachowań i bugów regresyjnych.

2. **Szerokie użycie `any`**:
   - W kilku miejscach osłabia bezpieczeństwo typów.

3. **Brak centralnej walidacji danych wejściowych**:
   - Warto dodać schematy (np. Zod) dla payloadów formularzy.

4. **Brak testów automatycznych**:
   - Na tym etapie utrudnia bezpieczne refaktoryzacje.

## 5) Skalowalność produktu (SaaS readiness)

Aktualny kod jest odpowiedni dla MVP / early stage.
Do etapu produkcyjnego dla większej liczby klientów rekomendowane:

- **Observability**: błędy, metryki, telemetry, tracing.
- **Multi-tenant hardening**: jednoznaczna izolacja danych tenantów (jeśli planowana).
- **Background jobs**: harmonogram injectów i cięższe operacje poza request/response.
- **Audyt działań**: pełny dziennik istotnych zmian i akcji moderatorów.

## 6) Priorytety wdrożeniowe (30/60/90 dni)

### 0-30 dni (najwyższy priorytet)
- Przegląd i utwardzenie wszystkich RLS policy + RPC permissions.
- Ustalenie jednego modułu sesji (usunąć duplikację lub wydzielić common core).
- Dodanie minimalnego zestawu testów krytycznych flow (login, join, create/start/end session).

### 31-60 dni
- Walidacja wejść przez schematy.
- Standaryzacja błędów i komunikatów do UI.
- Dodanie monitoringu błędów i metryk.

### 61-90 dni
- Refaktoryzacja do wyraźnej granicy: client UI vs server-domain API.
- Rozbudowa audytu i raportowania po sesji.

## 7) Ocena końcowa

- **Mocne strony**: szybkie MVP, dobra ergonomia pracy z Supabase, czytelna organizacja.
- **Słabe strony**: bezpieczeństwo zależne od konfiguracji DB, duplikacja logiki, brak testów.
- **Gotowość SaaS (obecnie)**: **średnia** (dobry fundament, ale wymaga hardeningu przed większą skalą).

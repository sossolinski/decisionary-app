# Decisionary – nowa analiza całego kodu i kluczowe zmiany

## TL;DR
Kod ma dobry fundament MVP (czytelny podział `app/*` + `lib/*`, sensowne użycie Supabase realtime), ale nadal ma kilka ryzyk, które utrudniają bezpieczne skalowanie:

1. Duża część logiki autoryzacji i przepływów jest po stronie klienta.
2. Istnieje duplikacja logiki „session runtime” między modułami.
3. Dług techniczny linta (obecnie ostrzeżenia) ukrywa potencjalne bugi typów.
4. Brakuje testów automatycznych dla krytycznych flow.

## 1) Co jest mocne

- Spójna struktura aplikacji: warstwa UI (`app/`) i warstwa usług domenowych (`lib/`).
- Użycie RPC-first z fallbackami w krytycznych operacjach sesji.
- Realtime subscriptions są zaimplementowane z debounce/coalescing, co ogranicza „UI thrash”.
- Ostatnie poprawki zwiększyły bezpieczeństwo obsługi błędów (`unknown` + helper).

## 2) Najważniejsze ryzyka (priorytet P1)

### P1-A: Security boundary głównie po stronie klienta
**Objaw:** wiele operacji wykonuje klient bez pośredniej warstwy serwerowej.

**Ryzyko:** każde przeoczenie w RLS lub błędna polityka RPC może otworzyć dostęp do danych.

**Kluczowa zmiana:**
- Przenieść operacje modyfikujące do Next.js route handlers / server actions (minimum dla: create/start/end session, role assignment, share/revoke scenario).
- Klient ma wołać wyłącznie API aplikacji, a nie bezpośrednio mutować kluczowe tabele.

---

### P1-B: Duplikacja logiki sesji
**Objaw:** pokrywające się odpowiedzialności między `lib/sessions.ts` i `lib/sessionsRuntime.ts`.

**Ryzyko:** niespójne zachowanie, regresje, trudniejsze refaktoryzacje.

**Kluczowa zmiana:**
- Ustalić jeden moduł „source of truth” dla sesji (np. `sessionsRuntime.ts`) i migrować wywołania stopniowo.
- Wydzielić warstwę `sessions.shared.ts` na typy i helpery wspólne.

---

### P1-C: Lint jest „zielony”, ale dług techniczny nadal wysoki
**Objaw:** `npm run lint` przechodzi, ale z dużą liczbą warningów (`any`, hook deps, itp.).

**Ryzyko:** część problemów typów i efektów React pozostaje niewidoczna dla CI jako fail.

**Kluczowa zmiana:**
- Plan „warning burndown” per katalog (najpierw `lib/*`, potem `app/(app)/facilitator/*`, potem `components/*`).
- Dla każdego sprintu: redukcja warningów o stały procent (np. 20-30%).
- Docelowo przywracać reguły do `error` katalogami, nie globalnie.

## 3) Zmiany o najwyższym ROI (P2)

### P2-A: Standaryzacja walidacji wejścia
- Dodać centralne schematy (np. Zod) dla:
  - auth/join code,
  - tworzenia scenariuszy i sesji,
  - payloadów injectów i działań.
- Ujednolicić mapowanie błędów do UI (`toErrorMessage` + kody domenowe).

### P2-B: Uporządkowanie asynchroniczności i side-effects
- Ograniczyć `eslint-disable` dla hooków.
- Dla komponentów złożonych (Inbox/Pulse/FacilitatorToolsPanel) wydzielić custom hooki `useInbox`, `usePulse`, `useSessionControl`.
- Ułatwi to testy i usunie część niestabilnych zależności efektów.

### P2-C: Mierzalny audyt przepływów biznesowych
- Dodać telemetry events (minimum): login success/fail, join success/fail, start/end session, inject delivered.
- Dodać jednolity `request_id` do logów klient+serwer dla debugowania incydentów.

## 4) Zmiany architektoniczne (P3)

### P3-A: Warstwa API aplikacji
- Dodać endpointy w `app/api/*` dla operacji modyfikujących.
- W `lib/` rozdzielić moduły na:
  - `client-read` (read-only query helpers),
  - `server-command` (mutacje i walidacja).

### P3-B: Testy
- Minimalny pakiet testów E2E (Playwright):
  1. login facilitatora,
  2. create scenario,
  3. create session,
  4. join participant,
  5. start/end session.
- Unit testy helperów mapujących i walidatorów (join code, parsery row).

### P3-C: Kontrakty typów Supabase
- Rozważyć codegen typów DB i wyeliminować ręczne mapowania `Record<string, unknown>` tam, gdzie możliwe.

## 5) Plan wdrożenia (30/60/90)

## 0-30 dni
1. Inwentaryzacja mutacji DB i wyznaczenie „critical commands”.
2. Zrobienie warstwy server-side dla 3 najważniejszych komend (start/end session, assign role).
3. Redukcja warningów w `lib/*` o min. 30%.

## 31-60 dni
1. Migracja kolejnych mutacji do API route handlers.
2. Wydzielenie custom hooków dla najbardziej złożonych komponentów.
3. Dodanie podstawowego E2E smoke pack.

## 61-90 dni
1. Dokończenie konsolidacji `sessions.ts` vs `sessionsRuntime.ts`.
2. Przywracanie wybranych reguł ESLint do `error` na poziomie katalogów.
3. Rozszerzenie obserwowalności i dashboardów jakości (bug rate, failed joins, session failures).

## 6) Lista „first 10 tickets” (gotowa do backlogu)

1. [Security] Server action: `startSession`.
2. [Security] Server action: `endSession`.
3. [Security] Server action: `assignSessionRole`.
4. [Architecture] ADR: konsolidacja `sessions.ts` i `sessionsRuntime.ts`.
5. [Quality] Warning burndown – `lib/sessions.ts`.
6. [Quality] Warning burndown – `lib/scenarios.ts`.
7. [UI] Refactor `FacilitatorToolsPanel` do hooków.
8. [UI] Refactor `Inbox` i `PulseFeed` (effects + dependencies).
9. [Tests] Playwright smoke flow (facilitator + participant).
10. [Observability] event tracking dla critical actions.

---

### Wniosek końcowy
Najlepszy kolejny krok to **przesunięcie granicy bezpieczeństwa na serwer + stopniowe „wypalanie” warningów linta katalogami**. To da największy efekt biznesowy (mniejsze ryzyko incydentów) i inżynierski (szybsze, bezpieczniejsze zmiany).

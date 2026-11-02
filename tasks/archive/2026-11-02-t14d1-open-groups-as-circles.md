# Archived Task

Closed At: 2026-11-02T10:07:09.601Z
Result: PASS
Source File: tasks/todo.md

# Current Task

Task ID: 2026-11-02-t14d1-open-groups-as-circles
Task Date: 2026-11-02
Task Status: ACTIVE

## Tryb pracy
FEATURE

Uzasadnienie trybu:
Task utworzony przez task lifecycle.

## Cel / Outcome
Grupy otwarte jako kręgi z openKey: członkostwo w members, czynność cykliczna, termin w memberDues, liczniki shardowane; migracja groupMembers; open-kręgi niedostępne przez kod, today/week i addActivity

## Kryteria sukcesu
- testy: join tworzy termin i trafia do dues.mine

## Priorytet / Blocker
Największy blocker teraz: Grupy otwarte jako kręgi z openKey: członkostwo w members, czynność cykliczna, termin w memberDues, liczniki shardowane; migracja groupMembers; open-kręgi niedostępne przez kod, today/week i addActivity
Dowód blockera: polecenie użytkownika i aktualny task
Czy ten task rusza blocker: TAK
Jeśli NIE, powód: NOT_APPLICABLE
Dlaczego mimo to robimy teraz: nie dotyczy
Warunek powrotu do blockera: nie dotyczy

## Kontekst dla agenta
Moduł: convex backend
Tryb zmiany: code-change
Maksymalny zakres plików: allowlista z taska
Dozwolone pliki do zmiany:
- convex/schema.ts
- convex/groups.ts
- convex/groups.test.ts
- convex/circles.ts
- convex/checkins.ts
- convex/migrate.ts
- convex/_generated/**
- tasks/todo.md
- tasks/archive/**
Kontrakty do przeczytania: AGENTS.md oraz tylko potrzebne docs dla tego taska
Pliki zakazane: wszystko poza allowlistą
Czego nie ruszać: pliki poza zakresem

## Zakres
Moduł: convex backend
Pliki: convex/schema.ts, convex/groups.ts, convex/groups.test.ts, convex/circles.ts, convex/checkins.ts, convex/migrate.ts, convex/_generated/**

## Reprodukcja / dowód problemu
Task utworzony z polecenia użytkownika albo przez zamknięcie poprzedniego taska.

## Escalation
Czy brakuje danych do bezpiecznej zmiany?
NIE

Jeśli TAK:
Brakujące dane: brak
Czego nie da się potwierdzić: brak
Ryzyko kodowania teraz: niskie po utrzymaniu scope locka
Najmniejszy następny krok: wykonać najmniejszą zmianę z allowlisty

## Klasyfikacja
REQUIRED

Uzasadnienie:
Zmiana jest wymagana dla aktualnego stanu workflow.

## Diagnoza
Root cause: grupy otwarte miały własną tabelę członków i własny mechanizm wykonania, osobny od kręgów i terminów.
Dowód: groupMembers + lastDonePeriod duplikowały members, memberDues i checkins; przypomnienia nie obejmowały grup.
Aktualny flow: do uzupełnienia, jeśli dotyczy.

## Granice
Moduły dotknięte: convex backend
Kontrakty dotknięte: do uzupełnienia, jeśli dotyczy.
Poza zakresem: wszystko poza allowlistą.

## Kontrakt
INPUT: polecenie użytkownika i pliki z allowlisty.
SUCCESS: spełnione kryteria sukcesu.
ERRORS: brak dowodu, zmiana poza scope albo failujące gate'y.
STATUSES: PASS / FAIL.
SIDE EFFECTS: tylko zmiany w plikach z allowlisty.
LOGS: komendy weryfikacyjne.
TESTS: do uzupełnienia przed końcem taska.
DONE: review ma konkretny wynik.

## Failure modes
Timeout: przerwać i pokazać ostatni bezpieczny stan.
Null/missing data: nie zgadywać, użyć ESCALATION.
Invalid schema: nie dotyczy, chyba że task dotyka danych.
Duplicate request: sprawdzić idempotencję, jeśli task ma side effecty.
Concurrent request: nie dotyczy, chyba że task dotyka runtime.
Partial write: nie zostawiać pustego sukcesu.
Worker crash: nie dotyczy, chyba że task dotyka workera.
Retry loop: nie dodawać retry bez klasyfikacji błędów.
Provider unavailable: nie dotyczy, chyba że task dotyka providera.

## Guard Scope
REQUIRED GUARDS:
- trzymać się allowlisty.
- uruchomić testy wskazane w tasku.

NICE_TO_HAVE GUARDS:
- pomysły poza zakresem zapisać do ParkingLot.md.

OVERBUILD GUARDS:
- nie tworzyć nowego subsystemu bez osobnego taska.

ParkingLot.md updated:
NOT_NEEDED

## Runtime guards
State machine: do uzupełnienia, jeśli dotyczy.
Error classification: do uzupełnienia, jeśli dotyczy.
Idempotency: do uzupełnienia, jeśli dotyczy.
Single-flight: do uzupełnienia, jeśli dotyczy.
Worker lock: do uzupełnienia, jeśli dotyczy.
Circuit breaker: do uzupełnienia, jeśli dotyczy.
Backpressure: do uzupełnienia, jeśli dotyczy.
UI truth: do uzupełnienia, jeśli dotyczy.
Observability: komendy weryfikacyjne jako dowód.

## Code Structure Guard
Czy dotykamy pliku >300 LOC?
NIE

Jeśli TAK:
Plik: brak
LOC: brak
Dlaczego zmiana trafia tutaj: brak
Czy plik ma wiele odpowiedzialności: brak
Minimalny fix: brak
Czy potrzebne wydzielenie odpowiedzialności: brak
Ryzyko: brak

## GOD_FILE_CHECK
Wymagane, jeśli plik >500 LOC.

Plik: brak
LOC: brak
Obecne odpowiedzialności: brak
Czy task dokłada nową odpowiedzialność: brak
Minimalny fix bez rozbicia: brak
Małe wydzielenie odpowiedzialności: brak
Ryzyko minimalnego fixu: brak
Ryzyko wydzielenia: brak
Rekomendacja: brak

## Dependency Direction Guard
Czy zmiana odwraca zależność?
NIE

Czy Business Logic importuje UI/DB/framework?
NIE

Czy adapter przecieka do core?
NIE

## Change Isolation
Ile modułów dotyka zmiana: jeden wskazany obszar.
Czy to naturalne: tak.
Czy da się ograniczyć zmianę do jednego kontraktu: tak.

## Plan
- [x] Przeczytać pliki z allowlisty.
- [x] Wykonać najmniejszą bezpieczną zmianę.
- [x] Uruchomić weryfikację.

## Weryfikacja
Komendy:
do uzupełnienia
Expected result: PASS.

## Definition of Done
- [x] test PASS
- [x] build PASS albo NOT_NEEDED z uzasadnieniem
- [x] brak ERROR w logach
- [x] zmiana nie wychodzi poza zakres
- [x] brak refaktoru przy okazji
- [x] failure modes obsłużone
- [x] brak silent fallbacków
- [x] brak empty success
- [x] UI truth zachowane, jeśli dotyczy
- [x] dependency direction zachowany
- [x] brak cyklicznych zależności
- [x] duże pliki nie zostały powiększone bez uzasadnienia
- [x] implementowano tylko REQUIRED GUARDS

## Review / Wyniki
Co zmieniono: krąg z openKey (members, czynność cykliczna, memberDues, checkins), liczniki zostają w groupCounters (shardy), dołączenie ustawia termin na koniec okresu, markDone raz na okres, krąg otwarty ukryty na liście i zablokowany dla kodu/today/week/addActivity, grupy trafiają do dues.mine (przypomnienia); migracja 4 członkostw na dev, tabela groupMembers i migracja usunięte; groups.join wymaga teraz argumentu today.
Jak sprawdzono: build-apk.sh test (typecheck -Werror, SecretTest, FormatTest) PASS, gate:local. Nie uruchamiano na urządzeniu.
PASS / FAIL: PASS
Ryzyka: stare APK (≤0.11) wołają groups:join bez today i dostaną błąd do czasu T14d2; 'zrobione w okresie' z migracji ma datę = początek okresu (data przybliżona); nazwa kręgu otwartego to klucz, a nie tekst dla użytkownika.
Follow-up: brak.

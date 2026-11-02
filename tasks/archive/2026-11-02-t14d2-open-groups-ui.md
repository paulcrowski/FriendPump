# Archived Task

Closed At: 2026-11-02T10:07:53.908Z
Result: PASS
Source File: tasks/todo.md

# Current Task

Task ID: 2026-11-02-t14d2-open-groups-ui
Task Date: 2026-11-02
Task Status: ACTIVE

## Tryb pracy
FEATURE

Uzasadnienie trybu:
Task utworzony przez task lifecycle.

## Cel / Outcome
Apka dostosowana do grup jako kręgów: join z today, zgoda na powiadomienia po dołączeniu, przypomnienia o grupach z nazwą i emoji (dues.mine zwraca openKey) (APK 0.12.0)

## Kryteria sukcesu
- APK 0.12.0 buduje się; dues.mine zwraca openKey; testy PASS

## Priorytet / Blocker
Największy blocker teraz: Apka dostosowana do grup jako kręgów: join z today, zgoda na powiadomienia po dołączeniu, przypomnienia o grupach z nazwą i emoji (dues.mine zwraca openKey) (APK 0.12.0)
Dowód blockera: polecenie użytkownika i aktualny task
Czy ten task rusza blocker: TAK
Jeśli NIE, powód: NOT_APPLICABLE
Dlaczego mimo to robimy teraz: nie dotyczy
Warunek powrotu do blockera: nie dotyczy

## Kontekst dla agenta
Moduł: android app + convex
Tryb zmiany: code-change
Maksymalny zakres plików: allowlista z taska
Dozwolone pliki do zmiany:
- convex/dues.ts
- convex/groups.test.ts
- app/src/main/java/pl/friendpump/app/GroupsScreen.java
- app/src/main/java/pl/friendpump/app/HomeScreen.java
- app/src/main/AndroidManifest.xml
- tasks/todo.md
- tasks/archive/**
Kontrakty do przeczytania: AGENTS.md oraz tylko potrzebne docs dla tego taska
Pliki zakazane: wszystko poza allowlistą
Czego nie ruszać: pliki poza zakresem

## Zakres
Moduł: android app + convex
Pliki: convex/dues.ts, convex/groups.test.ts, app/src/main/java/pl/friendpump/app/GroupsScreen.java, app/src/main/java/pl/friendpump/app/HomeScreen.java, app/src/main/AndroidManifest.xml

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
Root cause: po T14d1 groups:join wymaga today, a przypomnienia o grupach otwartych nie miałyby nazwy (serwer zna tylko klucz).
Dowód: GroupsScreen wołał join bez today; dues.mine nie zwracał openKey.
Aktualny flow: do uzupełnienia, jeśli dotyczy.

## Granice
Moduły dotknięte: android app + convex
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
Co zmieniono: GroupsScreen: join z today, zgoda na powiadomienia po dołączeniu; dues.mine zwraca openKey, HomeScreen dokłada nazwę i emoji w języku telefonu przed Reminders.sync; wersja 0.12.0; deploy na dev.
Jak sprawdzono: build-apk.sh test (typecheck -Werror, SecretTest, FormatTest) PASS, gate:local. Nie uruchamiano na urządzeniu.
PASS / FAIL: PASS
Ryzyka: niesprawdzone na telefonie; wcześniejsze APK (≤0.11.0) nie dołączą do grup (brak today); alarmy synchronizują się przy wejściu na ekran główny.
Follow-up: brak.

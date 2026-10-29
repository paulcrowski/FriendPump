# Current Task

Task ID: 2026-10-29-t4b-join-screen
Task Date: 2026-10-29
Task Status: ACTIVE

## Tryb pracy
FEATURE

Uzasadnienie trybu:
Task utworzony przez task lifecycle.

## Cel / Outcome
APK 0.4.0: przycisk Dołącz kodem, kod z wiadomości ze schowka podpowiada się sam, po dołączeniu krąg jest na liście

## Kryteria sukcesu
- drugi telefon dołącza kodem od pierwszego; zły i nieistniejący kod dają czytelny komunikat; powtórne dołączenie nie dubluje

## Priorytet / Blocker
Największy blocker teraz: APK 0.4.0: przycisk Dołącz kodem, kod z wiadomości ze schowka podpowiada się sam, po dołączeniu krąg jest na liście
Dowód blockera: polecenie użytkownika i aktualny task
Czy ten task rusza blocker: TAK
Jeśli NIE, powód: NOT_APPLICABLE
Dlaczego mimo to robimy teraz: nie dotyczy
Warunek powrotu do blockera: nie dotyczy

## Kontekst dla agenta
Moduł: android app
Tryb zmiany: code-change
Maksymalny zakres plików: allowlista z taska
Dozwolone pliki do zmiany:
- app/src/main/AndroidManifest.xml
- app/src/main/java/pl/friendpump/app/HomeScreen.java
- app/src/main/java/pl/friendpump/app/Format.java
- tests/FormatTest.java
- tasks/todo.md
- tasks/archive/**
Kontrakty do przeczytania: AGENTS.md oraz tylko potrzebne docs dla tego taska
Pliki zakazane: wszystko poza allowlistą
Czego nie ruszać: pliki poza zakresem

## Zakres
Moduł: android app
Pliki: app/src/main/AndroidManifest.xml, app/src/main/java/pl/friendpump/app/HomeScreen.java, app/src/main/java/pl/friendpump/app/Format.java, tests/FormatTest.java, tasks/todo.md

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
Root cause: drugi telefon nie ma jak wejść do kręgu.
Dowód: APK 0.4.0 zbudowany; extractCode ma testy JVM; circles:join sprawdzone na żywo w T4a.
Aktualny flow: Dołącz kodem -> podpowiedź ze schowka (Format.extractCode) -> circles:join -> lista kręgów; BAD_CODE i CIRCLE_NOT_FOUND to komunikaty w formularzu.

## Granice
Moduły dotknięte: android app
Kontrakty dotknięte: do uzupełnienia, jeśli dotyczy.
Poza zakresem: wszystko poza allowlistą.

## Kontrakt
INPUT: polecenie użytkownika i pliki z allowlisty.
SUCCESS: spełnione kryteria sukcesu.
ERRORS: brak dowodu, zmiana poza scope albo failujące gate'y.
STATUSES: PASS / FAIL.
SIDE EFFECTS: tylko zmiany w plikach z allowlisty.
LOGS: komendy weryfikacyjne.
TESTS: tests/FormatTest.java (extractCode) + build.
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
- [ ] Przeczytać pliki z allowlisty.
- [ ] Wykonać najmniejszą bezpieczną zmianę.
- [ ] Uruchomić weryfikację.

## Weryfikacja
Komendy:
npm run build; npm run gate:local
Expected result: PASS.

## Definition of Done
- [x] test PASS
- [x] build PASS albo NOT_NEEDED z uzasadnieniem
- [ ] brak ERROR w logach
- [ ] zmiana nie wychodzi poza zakres
- [ ] brak refaktoru przy okazji
- [ ] failure modes obsłużone
- [ ] brak silent fallbacków
- [ ] brak empty success
- [ ] UI truth zachowane, jeśli dotyczy
- [ ] dependency direction zachowany
- [ ] brak cyklicznych zależności
- [ ] duże pliki nie zostały powiększone bez uzasadnienia
- [ ] implementowano tylko REQUIRED GUARDS

## Review / Wyniki
Co zmieniono: wersja 0.4.0, formularz Dołącz kodem, podpowiedź ze schowka, args(key,value).
Jak sprawdzono: build, testy JVM, gate:local. Dołączanie na dwóch telefonach sprawdza użytkownik.
PASS / FAIL: PASS
Ryzyka: odczyt schowka na Androidzie 10+ działa tylko gdy aplikacja jest na pierwszym planie (jest); użytkownik może wkleić kod ręcznie.
Follow-up: brak.

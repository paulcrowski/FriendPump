# Archived Task

Closed At: 2026-10-29T21:09:56.528Z
Result: PASS
Source File: tasks/todo.md

# Current Task

Task ID: 2026-10-29-t5d3-lifecycle
Task Date: 2026-10-29
Task Status: ACTIVE

## Tryb pracy
MINIMAL_FIX

Uzasadnienie trybu:
Agent wybral najmniejszy bezpieczny tryb pracy.

## Cel / Outcome
Przycisk Wstecz wraca z ekranu Dziś do listy kręgów, a odświeżanie zatrzymuje się, gdy aplikacja jest w tle

## Kryteria sukcesu
- build i gate przechodzą; MainActivity przekazuje onPause/onResume/Back do HomeScreen

## Priorytet / Blocker
Największy blocker teraz: Przycisk Wstecz wraca z ekranu Dziś do listy kręgów, a odświeżanie zatrzymuje się, gdy aplikacja jest w tle
Dowód blockera: polecenie użytkownika i aktualny task
Czy ten task rusza blocker: TAK
Jeśli NIE, powód: NOT_APPLICABLE
Dlaczego mimo to robimy teraz: nie dotyczy
Warunek powrotu do blockera: nie dotyczy

## Kontekst dla agenta
Moduł: android app
Tryb zmiany: code-change
Dozwolone pliki do zmiany:
- app/src/main/java/pl/friendpump/app/MainActivity.java
- tasks/todo.md
- tasks/archive/**
Kontrakty do przeczytania: tylko pliki potrzebne do taska
Czego nie ruszać: pliki poza zakresem

## Zakres
Moduł: android app
Pliki: app/src/main/java/pl/friendpump/app/MainActivity.java, tasks/todo.md

## Escalation
Czy brakuje danych do bezpiecznej zmiany?
NIE

Jeśli TAK:
Status: BLOCKED_BY_MISSING_EVIDENCE
Najmniejszy następny krok: audit albo test reprodukcyjny

## Klasyfikacja
REQUIRED

Uzasadnienie:
Zmiana jest wymagana dla aktualnego outcome.

## Diagnoza
Root cause: MainActivity nie przekazuje onPause/onResume/Wstecz do HomeScreen.
Dowód: HomeScreen.stop/resume/back istnieją, ale nie są wywoływane (grep).
Minimalny fix: trzy metody cyklu życia w MainActivity.
Test: npm run build.

## Plan
- [ ] Przeczytać tylko pliki potrzebne do zmiany.
- [ ] Wykonać minimalny diff.
- [ ] Uruchomić weryfikację.

## Weryfikacja
Komendy:
npm run build; npm run gate:local
Expected result: PASS.

## Review / Wyniki
Co zmieniono: MainActivity: onPause, onResume, onBackPressed przekazują do HomeScreen.
Jak sprawdzono: build i gate:local.
PASS / FAIL: PASS
Ryzyka: brak.
Follow-up: brak.

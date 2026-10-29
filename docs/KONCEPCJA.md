# FriendPump — koncepcja MVP

Status: zaakceptowane decyzje z 2026-10-29. Kod startuje od T0.

## Outcome

Kilka osób w kręgu widzi codziennie, kto już zrobił swoje (20 pompek, podciągnięcia, 10 min medytacji, rząd na drutach…). Widok cudzego ✅ ma mobilizować, nie być rankingiem.

Kryterium sukcesu MVP: 4–5 osób (Ty, przyjaciel, jego syn, żony) przez 2 tygodnie codziennie odhacza czynności w APK na Androidzie i widzi postęp pozostałych.

## Decyzje

| Pytanie | Decyzja |
| --- | --- |
| Kręgi | Kilka kręgów. Każdy ma swój kod zaproszenia, jedna osoba może być w kilku (np. „Treningi”, „Druty”). |
| Format | Od razu APK na Androida. |
| Cele | Wspólny cel dzienny dla wszystkich w kręgu. Indywidualne cele → Parking Lot. |
| Baza | Convex. |

## Jak to działa

1. Pierwsze uruchomienie: wpisuję swoje imię. Telefon dostaje losowy sekret (to jest „konto”, bez maila i hasła).
2. **Utwórz krąg** („Treningi”). Krąg od razu ma 3 czynności: pompki 20, podciągnięcia 10, medytacja 10 min.
3. **Zaproś**: Androidowe „Udostępnij” wysyła wiadomość z kodem kręgu (np. `PUMP-7K3Q-X9TA`) i linkiem do pobrania APK.
4. Znajomy instaluje APK → **Dołącz** → wkleja kod (aplikacja sama podpowie kod ze schowka) → jest w kręgu.
5. Ekran **Dziś**: lista czynności, przy każdej osoby z kręgu: ✅ zrobione, 12/20 w trakcie, szare jeszcze nic.
6. Przycisk **+**: wpisuję ile zrobiłem (10 pompek rano, 10 wieczorem; sumuje się). „Cofnij” usuwa mój ostatni wpis.
7. Ekran **Tydzień**: siatka 7 dni × osoby + seria („🔥 5 dni z rzędu”).
8. Każdy może dodać czynność: nazwa, emoji, cel dzienny, jednostka (razy / minuty / zrobione tak-nie).

Dlaczego kod, a nie klikalny link: przy samym APK link `https://…` otworzy przeglądarkę, a własny schemat `friendpump://` nie jest klikalny w WhatsAppie. Kod do wklejenia działa zawsze i nie wymaga strony WWW. Klikalny link → Parking Lot.

## Technologia (najmniej kodu)

| Warstwa | Wybór | Dlaczego |
| --- | --- | --- |
| Aplikacja | **Natywny Android w Javie, bez bibliotek** (jak `spokojniej`) | Sprawdzony u Was sposób; UI w kodzie, bez Gradle i bez node_modules. |
| APK | `scripts/build-apk.sh` (aapt2 + javac + d8 + apksigner) | Działa już w T1: `npm run build` daje `dist/FriendPump-<wersja>.apk`. Podpis lokalnym kluczem spoza repo. |
| Backend + baza | **Convex** przez HTTP API (`/api/query`, `/api/mutation`) | Bez klienta JS: `HttpURLConnection` + `org.json` z Androida. „Na żywo” = odpytywanie co kilka sekund, gdy ekran jest otwarty. |
| Tożsamość | Sekret urządzenia (32 losowe bajty) w prywatnych SharedPreferences; w bazie tylko jego hash | Zero rejestracji. Każda funkcja Convex sprawdza, czy właściciel sekretu jest członkiem kręgu. |
| Dystrybucja APK | Plik wysłany przez komunikator albo GitHub Release | Instalacja „z nieznanych źródeł” — jednorazowa zgoda na telefonie. |

## Prywatność

- Kod kręgu: 8 losowych znaków z alfabetu bez mylących liter (~40 bitów) + limit prób dołączenia. Kto nie ma kodu, nic nie zobaczy.
- Każde zapytanie i mutacja w Convex najpierw sprawdza członkostwo. Brak członkostwa = błąd, nie pusta lista.
- Ryzyko: po odinstalowaniu / zmianie telefonu tracisz swoją tożsamość. Na MVP akceptowalne; naprawa w Parking Lot (kod odzyskania).

## Model danych (Convex)

```text
users       secretHash, name, createdAt                 index: by_secretHash
circles     name, inviteCode, createdBy, createdAt      index: by_inviteCode
members     circleId, userId, joinedAt                  index: by_circle, by_user, unikalne (circleId, userId)
activities  circleId, name, emoji, unit (count|minutes|done), dailyTarget, archived   index: by_circle
checkins    activityId, circleId, userId, day "YYYY-MM-DD", value, createdAt          index: by_circle_day
```

„Zrobione dziś” = suma `value` danego dnia ≥ `dailyTarget`. `day` liczy telefon w czasie lokalnym (Polska) i wysyła razem z wpisem.

## Failure modes

- Zły kod → komunikat „Nie ma takiego kręgu”. Za dużo prób → chwilowa blokada.
- Ponowne dołączenie tym samym kodem → brak duplikatu członka, po prostu otwiera krąg.
- Brak internetu → widoczny błąd przy dodawaniu, wpis nie znika po cichu (bez kolejki offline w MVP).
- Podwójne kliknięcie + → dwa wpisy; ratuje „Cofnij”.
- Wpis po północy → nowy dzień.
- Wartość ≤ 0 albo absurdalna (np. 10 000 pompek) → walidacja w mutacji.

## Taski

Każdy task osobno, wg `AGENTS.md`: `task:new` → minimalna zmiana → dowód → `task:close`.

| # | Task | Tryb | PASS |
| --- | --- | --- | --- |
| T0 | Repo: git init, `npm install`, hooki workflow, nazwa projektu | MINIMAL_FIX | `npm run gate:local` przechodzi |
| T1 ✅ | Natywny szkielet Java + `build-apk.sh` (Expo odrzucone, nie działało lokalnie) | FEATURE | `npm run build` daje podpisany APK; instaluje się na telefonie |
| T2 | Convex: schemat + tożsamość z sekretu urządzenia + ekran „Twoje imię” | FEATURE | test: bez sekretu / z obcym sekretem funkcje zwracają błąd |
| T3 | Utwórz krąg → kod zaproszenia + 3 domyślne czynności + przycisk Udostępnij | FEATURE | po utworzeniu widać kod i 3 czynności; wiadomość udostępniania ma kod |
| T4 | Dołącz kodem (+ podpowiedź ze schowka), lista moich kręgów | FEATURE | drugi telefon dołącza; zły kod = komunikat; ponownie bez duplikatu |
| T5 | Ekran Dziś: dodaj wpis, cofnij, statusy wszystkich (na żywo) | FEATURE | wpis z telefonu A widać na B bez odświeżania |
| T6 | Pierwszy APK z działającą synchronizacją i test we dwóch | release-build | APK instaluje się, T3–T5 działają na 2 telefonach |
| T7 | Ekran Tydzień + seria dni | FEATURE | siatka zgadza się z danymi testowymi |
| T8 | Dodawanie / archiwizacja czynności | FEATURE | nowa czynność widoczna dla wszystkich w kręgu |
| T9 | APK dla wszystkich 4–5 osób | release-build | każdy ma aplikację i jest w swoim kręgu |

Po T6 możecie realnie testować we dwóch. T7–T9 to dopieszczenie i rozszerzenie na rodzinę.

## Środowisko (sprawdzone 2026-10-29)

- git działa (licencja Xcode zaakceptowana).
- Android SDK: `~/Library/Android/sdk`, platformy 33–36.1, build-tools 35–37, adb.
- JDK 21: `/Applications/Android Studio.app/Contents/jbr`.
- Node 26 (tylko do skryptów workflow). Konto Convex jest.

## Decyzja o Expo (2026-10-29)

Najpierw wybrane Expo + Convex; Expo Go nie otworzyło aplikacji lokalnie, więc wróciliśmy do natywnej Javy jak w `spokojniej`. Skutek: Convex bez gotowego klienta, przez HTTP API.

## Poza MVP → ParkingLot.md

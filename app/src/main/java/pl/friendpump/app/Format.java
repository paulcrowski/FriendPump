package pl.friendpump.app;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Czyste funkcje formatowania tekstów (testowane bez Androida). */
final class Format {
    private Format() { }

    /** "2TNBYY3T" -> "2TNB-YY3T". */
    static String code(String raw) {
        return raw.length() == 8 ? raw.substring(0, 4) + "-" + raw.substring(4) : raw;
    }

    static String people(int n) {
        if (n == 1) return "1 osoba";
        int last = n % 10, lastTwo = n % 100;
        boolean few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
        return n + (few ? " osoby" : " osób");
    }

    static String target(String unit, int value) {
        if ("minutes".equals(unit)) return value + " min";
        if ("done".equals(unit)) return "✓";
        return String.valueOf(value);
    }

    private static final Pattern CODE_WITH_DASH = Pattern.compile("\\b([ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4})\\b");

    /** Wyciąga kod XXXX-XXXX z wklejonej wiadomości; null, gdy go nie ma. */
    static String extractCode(String text) {
        if (text == null) return null;
        Matcher m = CODE_WITH_DASH.matcher(text.toUpperCase());
        return m.find() ? m.group(1) : null;
    }

    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("EEEE, d MMMM", new Locale("pl", "PL"));

    /** "czwartek, 29 października". */
    static String dayLabel(LocalDate day) { return day.format(DAY_LABEL); }

    /** Szybkie przyciski dodawania; dla "done" brak. */
    static int[] steps(String unit, int target) {
        if ("done".equals(unit)) return new int[0];
        if ("minutes".equals(unit)) return new int[] {5, 10};
        if (target <= 5) return new int[] {1, 2};
        if (target <= 12) return new int[] {2, 5};
        if (target <= 30) return new int[] {5, 10};
        if (target <= 100) return new int[] {10, 25};
        return new int[] {50, 100};
    }

    /** "Czw" - skrót dnia tygodnia. */
    static String dayShort(LocalDate day) {
        String s = day.getDayOfWeek().getDisplayName(TextStyle.SHORT, new Locale("pl", "PL")).replace(".", "");
        return s.substring(0, 1).toUpperCase(new Locale("pl", "PL")) + s.substring(1);
    }

    /** Cykl zadania w miesiącach: "raz w roku", "2 razy w roku", "co 3 mies.". */
    static String cycle(int months) {
        if (months == 1) return "co miesiąc";
        if (months == 6) return "2 razy w roku";
        if (months == 12) return "raz w roku";
        if (months == 24) return "co 2 lata";
        return "co " + months + " mies.";
    }

    /** Ile zostało do terminu; po terminie "zaległe ...". */
    static String due(LocalDate today, LocalDate due) {
        long d = ChronoUnit.DAYS.between(today, due);
        if (d == 0) return "dziś";
        if (d == 1) return "jutro";
        if (d >= 90) return "za " + d / 30 + " mies.";
        if (d > 1) return "za " + d + " dni";
        return d == -1 ? "zaległe od wczoraj" : "zaległe " + (-d) + " dni";
    }

    /** Kiedy przypomnieć o terminie: o 9:00 w dniu terminu; dziś po 9:00 za minutę; zaległe jutro o 9:00. */
    static LocalDateTime reminderAt(LocalDateTime now, LocalDate due) {
        LocalDate today = now.toLocalDate();
        if (due.isBefore(today)) return today.plusDays(1).atTime(LocalTime.of(9, 0));
        LocalDateTime at = due.atTime(LocalTime.of(9, 0));
        return at.isAfter(now) ? at : now.plusMinutes(1);
    }
}

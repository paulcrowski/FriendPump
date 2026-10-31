package pl.friendpump.app;

public final class FormatTest {
    public static void main(String[] args) {
        eq(Format.code("2TNBYY3T"), "2TNB-YY3T");
        eq(Format.code("ABC"), "ABC");
        eq(Format.people(1), "1 osoba");
        eq(Format.people(2), "2 osoby");
        eq(Format.people(4), "4 osoby");
        eq(Format.people(5), "5 osób");
        eq(Format.people(12), "12 osób");
        eq(Format.people(22), "22 osoby");
        eq(Format.target("count", 20), "20");
        eq(Format.target("minutes", 10), "10 min");
        eq(Format.target("done", 1), "✓");
        eq(Format.extractCode("Dołącz do mojego kręgu „Treningi” w FriendPump. Kod zaproszenia: 2TNB-YY3T"), "2TNB-YY3T");
        eq(Format.extractCode("kod 2tnb-yy3t"), "2TNB-YY3T");
        eq(Format.extractCode("Cześć, co słychać?"), null);
        eq(Format.extractCode(null), null);
        eq(Format.dayLabel(java.time.LocalDate.of(2026, 10, 29)), "czwartek, 29 października");
        eq(java.util.Arrays.toString(Format.steps("count", 20)), "[5, 10]");
        eq(java.util.Arrays.toString(Format.steps("count", 10)), "[2, 5]");
        eq(java.util.Arrays.toString(Format.steps("minutes", 30)), "[5, 10]");
        eq(java.util.Arrays.toString(Format.steps("done", 1)), "[]");
        eq(Format.dayShort(java.time.LocalDate.of(2026, 10, 29)), "Czw");
        eq(Format.cycle(12), "raz w roku");
        eq(Format.cycle(6), "2 razy w roku");
        eq(Format.cycle(3), "co 3 mies.");
        java.time.LocalDate t = java.time.LocalDate.of(2026, 10, 31);
        eq(Format.due(t, t), "dziś");
        eq(Format.due(t, t.plusDays(1)), "jutro");
        eq(Format.due(t, t.plusDays(12)), "za 12 dni");
        eq(Format.due(t, t.plusDays(180)), "za 6 mies.");
        eq(Format.due(t, t.minusDays(1)), "zaległe od wczoraj");
        eq(Format.due(t, t.minusDays(5)), "zaległe 5 dni");
        System.out.println("FormatTest PASS");
    }

    private static void eq(String actual, String expected) {
        if (expected == null ? actual != null : !expected.equals(actual)) throw new AssertionError("oczekiwano '" + expected + "', jest '" + actual + "'");
    }
}

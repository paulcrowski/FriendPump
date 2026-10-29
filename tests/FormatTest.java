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
        System.out.println("FormatTest PASS");
    }

    private static void eq(String actual, String expected) {
        if (expected == null ? actual != null : !expected.equals(actual)) throw new AssertionError("oczekiwano '" + expected + "', jest '" + actual + "'");
    }
}

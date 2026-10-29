package pl.friendpump.app;

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
}

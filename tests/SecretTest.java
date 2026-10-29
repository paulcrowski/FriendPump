package pl.friendpump.app;

public final class SecretTest {
    public static void main(String[] args) {
        String a = Secret.generate();
        String b = Secret.generate();
        check(Secret.isValid(a), "wygenerowany sekret ma 64 znaki hex");
        check(!a.equals(b), "dwa sekrety są różne");
        check(!Secret.isValid(null), "null jest nieprawidłowy");
        check(!Secret.isValid(""), "pusty jest nieprawidłowy");
        check(!Secret.isValid(a.substring(1)), "za krótki jest nieprawidłowy");
        check(!Secret.isValid(a.toUpperCase().replace('A', 'Z')), "znaki spoza hex są nieprawidłowe");
        System.out.println("SecretTest PASS");
    }

    private static void check(boolean ok, String what) {
        if (!ok) throw new AssertionError(what);
    }
}

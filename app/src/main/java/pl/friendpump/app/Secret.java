package pl.friendpump.app;

import java.security.SecureRandom;

/** Sekret urządzenia: 32 losowe bajty jako 64 znaki hex (format wymagany przez serwer). */
final class Secret {
    static final int HEX_LENGTH = 64;
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private Secret() { }

    static String generate() {
        return generate(new SecureRandom());
    }

    static String generate(SecureRandom random) {
        byte[] bytes = new byte[HEX_LENGTH / 2];
        random.nextBytes(bytes);
        char[] out = new char[HEX_LENGTH];
        for (int i = 0; i < bytes.length; i++) {
            out[i * 2] = HEX[(bytes[i] >> 4) & 0xF];
            out[i * 2 + 1] = HEX[bytes[i] & 0xF];
        }
        return new String(out);
    }

    static boolean isValid(String secret) {
        if (secret == null || secret.length() != HEX_LENGTH) return false;
        for (int i = 0; i < secret.length(); i++) {
            char c = secret.charAt(i);
            if ((c < '0' || c > '9') && (c < 'a' || c > 'f')) return false;
        }
        return true;
    }
}

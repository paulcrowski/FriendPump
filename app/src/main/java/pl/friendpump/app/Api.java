package pl.friendpump.app;

import android.os.Handler;
import android.os.Looper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONException;
import org.json.JSONObject;

/** Cienki klient Convex HTTP. Wynik zawsze ma jawny stan: ok albo kod błędu. */
final class Api {
    static final String BASE_URL = "https://silent-porpoise-665.convex.cloud";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    static final class Result {
        final JSONObject value;
        final String error;

        private Result(JSONObject value, String error) { this.value = value; this.error = error; }
        static Result ok(JSONObject value) { return new Result(value, null); }
        static Result fail(String code) { return new Result(null, code); }
        boolean isOk() { return error == null; }
    }

    interface Callback { void done(Result result); }

    static void query(String path, JSONObject args, Callback cb) { run("query", path, args, cb); }

    static void mutation(String path, JSONObject args, Callback cb) { run("mutation", path, args, cb); }

    private static void run(String kind, String path, JSONObject args, Callback cb) {
        new Thread(() -> {
            Result result = call(kind, path, args);
            MAIN.post(() -> cb.done(result));
        }).start();
    }

    private static Result call(String kind, String path, JSONObject args) {
        HttpURLConnection conn = null;
        try {
            JSONObject body = new JSONObject().put("path", path).put("args", args).put("format", "json");
            conn = (HttpURLConnection) new URL(BASE_URL + "/api/" + kind).openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(10000);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = conn.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int status = conn.getResponseCode();
            InputStream in = status < 400 ? conn.getInputStream() : conn.getErrorStream();
            return parse(status, in == null ? "" : read(in));
        } catch (IOException | JSONException e) {
            return Result.fail("NETWORK");
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static Result parse(int httpStatus, String text) throws JSONException {
        JSONObject json;
        try {
            json = new JSONObject(text);
        } catch (JSONException e) {
            return Result.fail("HTTP_" + httpStatus);
        }
        if ("success".equals(json.optString("status"))) {
            JSONObject value = json.optJSONObject("value");
            return value != null ? Result.ok(value) : Result.fail("BAD_RESPONSE");
        }
        JSONObject data = json.optJSONObject("errorData");
        String code = data == null ? "" : data.optString("code", "");
        return Result.fail(code.isEmpty() ? "SERVER_ERROR" : code);
    }

    private static String read(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[2048];
        int n;
        while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
        return buf.toString("UTF-8");
    }
}

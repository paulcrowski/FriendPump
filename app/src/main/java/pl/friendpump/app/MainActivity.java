package pl.friendpump.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONException;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int MAX_NAME = 30;

    private final Ui ui = new Ui(this);
    private LinearLayout content;
    private HomeScreen home;
    private String secret;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        secret = loadOrCreateSecret();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Ui.BG);
        int pad = ui.dp(24);
        root.setPadding(pad, pad * 2, pad, pad);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        TextView footer = ui.text(ui.s(R.string.app_footer, versionName(), secret.substring(0, 6)), 12, Ui.MUTED);
        footer.setGravity(Gravity.CENTER);
        root.addView(footer, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);
        checkMe();
    }

    @Override protected void onPause() {
        super.onPause();
        if (home != null) home.stop();
    }

    @Override protected void onResume() {
        super.onResume();
        if (home != null) home.resume();
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (home == null || !home.back()) super.onBackPressed();
    }

    private void checkMe() {
        showMessage(ui.s(R.string.main_connecting), null);
        Api.query("users:me", args(null), r -> {
            if (r.isOk()) showReady(r.value.optString("name"));
            else if ("NOT_REGISTERED".equals(r.error)) showNameForm(null);
            else showMessage(ui.s(R.string.main_conn_err, r.error), this::checkMe);
        });
    }

    private void register(String rawName) {
        String name = rawName.trim();
        if (name.isEmpty()) { showNameForm(ui.s(R.string.main_enter_name)); return; }
        showMessage(ui.s(R.string.main_saving), null);
        Api.mutation("users:register", args(name), r -> {
            if (r.isOk()) showReady(r.value.optString("name"));
            else if ("BAD_NAME".equals(r.error)) showNameForm(ui.s(R.string.main_bad_name, MAX_NAME));
            else showMessage(ui.s(R.string.main_save_err, r.error), () -> register(name));
        });
    }

    private void showReady(String name) {
        content.removeAllViews();
        home = new HomeScreen(this, ui, secret, content, name);
        home.show();
    }

    private void showNameForm(String problem) {
        content.removeAllViews();
        content.addView(ui.title("FriendPump"));
        content.addView(ui.label(ui.s(R.string.main_tagline), 16, Ui.MUTED));
        EditText input = ui.input(ui.s(R.string.main_name_hint));
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        input.setFilters(new InputFilter[] {new InputFilter.LengthFilter(MAX_NAME)});
        content.addView(input);
        if (problem != null) content.addView(ui.label(problem, 14, Ui.ACCENT));
        content.addView(ui.button(ui.s(R.string.main_start), () -> {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) imm.hideSoftInputFromWindow(input.getWindowToken(), 0);
            register(input.getText().toString());
        }));
    }

    private void showMessage(String message, Runnable retry) {
        content.removeAllViews();
        content.addView(ui.label(message, 18, Ui.INK));
        if (retry != null) content.addView(ui.button(ui.s(R.string.common_retry), retry));
    }

    private JSONObject args(String name) {
        try {
            JSONObject json = new JSONObject().put("secret", secret);
            return name == null ? json : json.put("name", name);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    private String loadOrCreateSecret() {
        SharedPreferences prefs = getSharedPreferences("friendpump", MODE_PRIVATE);
        String saved = prefs.getString("secret", null);
        if (Secret.isValid(saved)) return saved;
        String fresh = Secret.generate();
        prefs.edit().putString("secret", fresh).apply();
        return fresh;
    }

    @SuppressWarnings("deprecation")
    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "?";
        }
    }
}

package pl.friendpump.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONException;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int BG = Color.rgb(255, 248, 241), INK = Color.rgb(51, 36, 28), MUTED = Color.rgb(115, 98, 88), ACCENT = Color.rgb(224, 96, 42);
    private static final int MAX_NAME = 30;

    private LinearLayout content;
    private String secret;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        secret = loadOrCreateSecret();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        int pad = dp(24);
        root.setPadding(pad, pad * 2, pad, pad);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        TextView footer = text("FriendPump v" + versionName() + " · ID urządzenia " + secret.substring(0, 6), 12, MUTED);
        footer.setGravity(Gravity.CENTER);
        root.addView(footer, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);
        checkMe();
    }

    private void checkMe() {
        showMessage("Łączę z serwerem…", null);
        Api.query("users:me", args(null), r -> {
            if (r.isOk()) showReady(r.value.optString("name"));
            else if ("NOT_REGISTERED".equals(r.error)) showNameForm(null);
            else showMessage("Brak połączenia z serwerem (" + r.error + ")", this::checkMe);
        });
    }

    private void register(String rawName) {
        String name = rawName.trim();
        if (name.isEmpty()) { showNameForm("Wpisz imię"); return; }
        showMessage("Zapisuję…", null);
        Api.mutation("users:register", args(name), r -> {
            if (r.isOk()) showReady(r.value.optString("name"));
            else if ("BAD_NAME".equals(r.error)) showNameForm("Imię musi mieć od 1 do " + MAX_NAME + " znaków");
            else showMessage("Nie udało się zapisać (" + r.error + ")", () -> register(name));
        });
    }

    private void showReady(String name) {
        content.removeAllViews();
        content.addView(label("Cześć, " + name + "!", 32, INK));
        content.addView(label("Połączono z serwerem. Wkrótce: kręgi i wspólne czynności.", 16, MUTED));
    }

    private void showNameForm(String problem) {
        content.removeAllViews();
        content.addView(label("FriendPump", 32, INK));
        content.addView(label("Razem łatwiej o codzienny nawyk", 16, MUTED));
        EditText input = new EditText(this);
        input.setHint("Twoje imię");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        input.setFilters(new InputFilter[] {new InputFilter.LengthFilter(MAX_NAME)});
        input.setTextColor(INK);
        input.setTextSize(20);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(32);
        content.addView(input, p);
        if (problem != null) content.addView(label(problem, 14, ACCENT));
        content.addView(button("Zacznij", () -> {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) imm.hideSoftInputFromWindow(input.getWindowToken(), 0);
            register(input.getText().toString());
        }));
    }

    private void showMessage(String message, Runnable retry) {
        content.removeAllViews();
        content.addView(label(message, 18, INK));
        if (retry != null) content.addView(button("Spróbuj ponownie", retry));
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

    private int dp(float value) { return (int) (value * getResources().getDisplayMetrics().density + .5f); }

    private TextView text(String value, float size, int color) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        return t;
    }

    private TextView label(String value, float size, int color) {
        TextView t = text(value, size, color);
        t.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(8);
        t.setLayoutParams(p);
        return t;
    }

    private Button button(String label, Runnable click) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTextColor(BG);
        b.setMinHeight(dp(48));
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(ACCENT);
        shape.setCornerRadius(dp(12));
        b.setBackground(shape);
        b.setOnClickListener(v -> click.run());
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(24);
        b.setLayoutParams(p);
        return b;
    }
}

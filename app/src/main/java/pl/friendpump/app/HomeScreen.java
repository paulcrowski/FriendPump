package pl.friendpump.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Ekran główny po zalogowaniu: lista kręgów, tworzenie kręgu, udostępnianie kodu. */
final class HomeScreen {
    private static final int MAX_NAME = 30;

    private final Activity activity;
    private final Ui ui;
    private final String secret;
    private final LinearLayout host;
    private final String userName;

    HomeScreen(Activity activity, Ui ui, String secret, LinearLayout host, String userName) {
        this.activity = activity;
        this.ui = ui;
        this.secret = secret;
        this.host = host;
        this.userName = userName;
    }

    void show() {
        setBody(ui.label("Ładuję kręgi…", 18, Ui.INK));
        Api.query("circles:list", args(null), r -> {
            if (!r.isOk()) { showError("Nie udało się pobrać kręgów (" + r.error + ")", this::show); return; }
            showCircles(r.value.optJSONArray("items"));
        });
    }

    private void showCircles(JSONArray items) {
        LinearLayout col = column();
        col.addView(ui.label("Cześć, " + userName + "!", 28, Ui.INK));
        if (items.length() == 0) col.addView(ui.label("Nie masz jeszcze kręgu. Utwórz pierwszy i wyślij kod znajomym.", 16, Ui.MUTED));
        for (int i = 0; i < items.length(); i++) col.addView(card(items.optJSONObject(i)));
        col.addView(ui.button("Utwórz krąg", this::showCreateForm));
        setBody(col);
    }

    private LinearLayout card(JSONObject c) {
        LinearLayout card = column();
        card.setBackground(ui.rounded(Ui.CARD));
        card.setPadding(ui.dp(16), ui.dp(16), ui.dp(16), ui.dp(16));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = ui.dp(16);
        card.setLayoutParams(p);
        String name = c.optString("name");
        String code = Format.code(c.optString("inviteCode"));
        TextView title = ui.text(name, 20, Ui.INK);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(title);
        card.addView(ui.text(Format.people(c.optInt("memberCount")), 14, Ui.MUTED));
        JSONArray acts = c.optJSONArray("activities");
        for (int i = 0; acts != null && i < acts.length(); i++) {
            JSONObject a = acts.optJSONObject(i);
            TextView line = ui.text(a.optString("emoji") + " " + a.optString("name") + " · " + Format.target(a.optString("unit"), a.optInt("dailyTarget")), 16, Ui.INK);
            line.setPadding(0, ui.dp(6), 0, 0);
            card.addView(line);
        }
        TextView codeView = ui.text("Kod: " + code, 22, Ui.ACCENT);
        codeView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        codeView.setPadding(0, ui.dp(16), 0, 0);
        card.addView(codeView);
        card.addView(ui.button("Udostępnij", () -> share(name, code)));
        return card;
    }

    private void share(String circleName, String code) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, "Dołącz do mojego kręgu „" + circleName + "” w FriendPump. Kod zaproszenia: " + code);
        activity.startActivity(Intent.createChooser(send, "Wyślij kod"));
    }

    private void showCreateForm() { showCreateForm(null); }

    private void showCreateForm(String problem) {
        LinearLayout col = column();
        col.addView(ui.label("Nowy krąg", 28, Ui.INK));
        EditText input = new EditText(activity);
        input.setHint("Nazwa, np. Treningi");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setFilters(new InputFilter[] {new InputFilter.LengthFilter(MAX_NAME)});
        input.setTextColor(Ui.INK);
        input.setTextSize(20);
        col.addView(input);
        if (problem != null) col.addView(ui.label(problem, 14, Ui.ACCENT));
        col.addView(ui.button("Utwórz", () -> create(input.getText().toString())));
        col.addView(ui.button("Anuluj", this::show));
        setBody(col);
    }

    private void create(String rawName) {
        String name = rawName.trim();
        if (name.isEmpty()) { showCreateForm("Wpisz nazwę kręgu"); return; }
        setBody(ui.label("Tworzę krąg…", 18, Ui.INK));
        Api.mutation("circles:create", args(name), r -> {
            if (r.isOk()) show();
            else if ("BAD_NAME".equals(r.error)) showCreateForm("Nazwa musi mieć od 1 do " + MAX_NAME + " znaków");
            else showError("Nie udało się utworzyć kręgu (" + r.error + ")", () -> create(name));
        });
    }

    private void showError(String message, Runnable retry) {
        LinearLayout col = column();
        col.addView(ui.label(message, 18, Ui.INK));
        col.addView(ui.button("Spróbuj ponownie", retry));
        setBody(col);
    }

    private LinearLayout column() {
        LinearLayout v = new LinearLayout(activity);
        v.setOrientation(LinearLayout.VERTICAL);
        v.setGravity(Gravity.CENTER_HORIZONTAL);
        return v;
    }

    private void setBody(android.view.View view) {
        host.removeAllViews();
        ScrollView scroll = new ScrollView(activity);
        scroll.addView(view);
        host.addView(scroll, new LinearLayout.LayoutParams(-1, -1));
    }

    private JSONObject args(String name) {
        try {
            JSONObject json = new JSONObject().put("secret", secret);
            return name == null ? json : json.put("name", name);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}

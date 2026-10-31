package pl.friendpump.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
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
    private final Activity activity;
    private final Ui ui;
    private final String secret;
    private final LinearLayout host;
    private final String userName;
    private TodayScreen today;
    private ChoresScreen chores;

    HomeScreen(Activity activity, Ui ui, String secret, LinearLayout host, String userName) {
        this.activity = activity;
        this.ui = ui;
        this.secret = secret;
        this.host = host;
        this.userName = userName;
    }

    void show() {
        setBody(ui.label("Ładuję kręgi…", 18, Ui.INK));
        Api.query("circles:list", args(null, null), r -> {
            if (!r.isOk()) { showError("Nie udało się pobrać kręgów (" + r.error + ")", this::show); return; }
            showCircles(r.value.optJSONArray("items"));
        });
    }

    private void showCircles(JSONArray items) {
        LinearLayout col = column();
        col.addView(ui.title("Cześć, " + userName + "!"));
        if (items.length() == 0) col.addView(ui.label("Nie masz jeszcze kręgu. Utwórz pierwszy i wyślij kod znajomym.", 16, Ui.MUTED));
        for (int i = 0; i < items.length(); i++) col.addView(card(items.optJSONObject(i)));
        col.addView(ui.button("Utwórz krąg", this::showCreateForm));
        col.addView(ui.secondary("Dołącz kodem", () -> showJoinForm(clipboardCode(), null)));
        col.addView(ui.secondary("🗓 Rzeczy na życie", this::openChores));
        setBody(col);
    }

    private LinearLayout card(JSONObject c) {
        LinearLayout card = ui.card();
        String id = c.optString("id");
        TextView title = ui.text(c.optString("name"), 20, Ui.INK);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(title);
        StringBuilder emojis = new StringBuilder();
        JSONArray acts = c.optJSONArray("activities");
        for (int i = 0; acts != null && i < acts.length(); i++) emojis.append(acts.optJSONObject(i).optString("emoji")).append(' ');
        card.addView(ui.text(Format.people(c.optInt("memberCount")) + "  ·  " + emojis.toString().trim(), 15, Ui.MUTED));
        TextView open = ui.text("Otwórz ›", 15, Ui.ACCENT);
        open.setTypeface(Typeface.DEFAULT_BOLD);
        open.setPadding(0, ui.dp(10), 0, 0);
        card.addView(open);
        card.setOnClickListener(v -> openToday(id));
        return card;
    }

    private void openToday(String circleId) {
        today = new TodayScreen(activity, ui, secret, host, circleId, () -> { today = null; show(); });
        today.start();
    }

    private void openChores() {
        chores = new ChoresScreen(activity, ui, secret, host, () -> { chores = null; show(); });
        chores.show();
    }

    /** Wywoływane z cyklu życia aktywności i przycisku wstecz. */
    void stop() { if (today != null) today.stop(); }

    void resume() { if (today != null) today.start(); }

    boolean back() {
        if (chores != null) { chores.back(); return true; }
        if (today == null) return false;
        today.stop();
        today = null;
        show();
        return true;
    }

    static void share(Activity activity, String circleName, String code) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, "Dołącz do mojego kręgu „" + circleName + "” w FriendPump. Kod zaproszenia: " + code);
        activity.startActivity(Intent.createChooser(send, "Wyślij kod"));
    }

    private void showCreateForm() {
        new CreateCircleForm(activity, ui, secret, host, this::show, this::show).show();
    }

    private String clipboardCode() {
        ClipboardManager cm = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = cm == null ? null : cm.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0) return null;
        CharSequence text = clip.getItemAt(0).coerceToText(activity);
        return Format.extractCode(text == null ? null : text.toString());
    }

    private void showJoinForm(String prefill, String problem) {
        LinearLayout col = column();
        col.addView(ui.title("Dołącz do kręgu"));
        col.addView(ui.label("Wklej kod od znajomego", 16, Ui.MUTED));
        EditText input = ui.input("np. 2TNB-YY3T");
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        input.setFilters(new InputFilter[] {new InputFilter.LengthFilter(20)});
        input.setTypeface(Typeface.MONOSPACE);
        if (prefill != null) input.setText(prefill);
        col.addView(input);
        if (prefill != null && problem == null) col.addView(ui.label("Wstawiłem kod ze schowka", 14, Ui.MUTED));
        if (problem != null) col.addView(ui.label(problem, 14, Ui.ACCENT));
        col.addView(ui.button("Dołącz", () -> join(input.getText().toString())));
        col.addView(ui.secondary("Anuluj", this::show));
        setBody(col);
    }

    private void join(String rawCode) {
        String code = rawCode.trim();
        if (code.isEmpty()) { showJoinForm(null, "Wpisz kod"); return; }
        setBody(ui.label("Dołączam…", 18, Ui.INK));
        Api.mutation("circles:join", args("code", code), r -> {
            if (r.isOk()) show();
            else if ("BAD_CODE".equals(r.error)) showJoinForm(code, "Kod ma 8 znaków, np. 2TNB-YY3T");
            else if ("CIRCLE_NOT_FOUND".equals(r.error)) showJoinForm(code, "Nie ma takiego kręgu. Sprawdź kod.");
            else showError("Nie udało się dołączyć (" + r.error + ")", () -> join(code));
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

    private JSONObject args(String key, String value) {
        try {
            JSONObject json = new JSONObject().put("secret", secret);
            return key == null ? json : json.put(key, value);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}

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
    private GroupsScreen groups;

    HomeScreen(Activity activity, Ui ui, String secret, LinearLayout host, String userName) {
        this.activity = activity;
        this.ui = ui;
        this.secret = secret;
        this.host = host;
        this.userName = userName;
    }

    void show() {
        setBody(ui.label(ui.s(R.string.home_loading), 18, Ui.INK));
        Api.query("circles:list", args(null, null), r -> {
            if (!r.isOk()) { showError(ui.s(R.string.home_list_err, r.error), this::show); return; }
            showCircles(r.value.optJSONArray("items"));
        });
    }

    private void showCircles(JSONArray items) {
        LinearLayout col = column();
        col.addView(ui.title(ui.s(R.string.home_hello, userName)));
        if (items.length() == 0) col.addView(ui.label(ui.s(R.string.home_no_circles), 16, Ui.MUTED));
        for (int i = 0; i < items.length(); i++) col.addView(card(items.optJSONObject(i)));
        col.addView(ui.button(ui.s(R.string.home_create), this::showCreateForm));
        col.addView(ui.secondary(ui.s(R.string.home_join_btn), () -> showJoinForm(clipboardCode(), null)));
        col.addView(ui.secondary(ui.s(R.string.home_chores_btn), this::openChores));
        col.addView(ui.secondary(ui.s(R.string.home_groups_btn), this::openGroups));
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
        TextView open = ui.text(ui.s(R.string.home_open), 15, Ui.ACCENT);
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

    private void openGroups() {
        groups = new GroupsScreen(activity, ui, secret, host, () -> { groups = null; show(); });
        groups.show();
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
        if (groups != null) { groups.back(); return true; }
        if (today == null) return false;
        today.stop();
        today = null;
        show();
        return true;
    }

    static void share(Activity activity, String circleName, String code) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, activity.getString(R.string.home_share_text, circleName, code));
        activity.startActivity(Intent.createChooser(send, activity.getString(R.string.home_share_chooser)));
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
        col.addView(ui.title(ui.s(R.string.home_join_title)));
        col.addView(ui.label(ui.s(R.string.home_paste_code), 16, Ui.MUTED));
        EditText input = ui.input(ui.s(R.string.home_code_hint));
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        input.setFilters(new InputFilter[] {new InputFilter.LengthFilter(20)});
        input.setTypeface(Typeface.MONOSPACE);
        if (prefill != null) input.setText(prefill);
        col.addView(input);
        if (prefill != null && problem == null) col.addView(ui.label(ui.s(R.string.home_pasted), 14, Ui.MUTED));
        if (problem != null) col.addView(ui.label(problem, 14, Ui.ACCENT));
        col.addView(ui.button(ui.s(R.string.home_join), () -> join(input.getText().toString())));
        col.addView(ui.secondary(ui.s(R.string.common_cancel), this::show));
        setBody(col);
    }

    private void join(String rawCode) {
        String code = rawCode.trim();
        if (code.isEmpty()) { showJoinForm(null, ui.s(R.string.home_enter_code)); return; }
        setBody(ui.label(ui.s(R.string.home_joining), 18, Ui.INK));
        Api.mutation("circles:join", args("code", code), r -> {
            if (r.isOk()) show();
            else if ("BAD_CODE".equals(r.error)) showJoinForm(code, ui.s(R.string.home_bad_code));
            else if ("CIRCLE_FULL".equals(r.error)) showJoinForm(code, ui.s(R.string.home_circle_full));
            else if ("CIRCLE_NOT_FOUND".equals(r.error)) showJoinForm(code, ui.s(R.string.home_not_found));
            else showError(ui.s(R.string.home_join_err, r.error), () -> join(code));
        });
    }

    private void showError(String message, Runnable retry) {
        LinearLayout col = column();
        col.addView(ui.label(message, 18, Ui.INK));
        col.addView(ui.button(ui.s(R.string.common_retry), retry));
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

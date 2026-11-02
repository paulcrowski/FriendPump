package pl.friendpump.app;

import android.app.Activity;
import android.graphics.Typeface;
import android.os.Build;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.text.NumberFormat;
import java.time.LocalDate;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** "Grupy otwarte": wspólne cykliczne sprawy z licznikami. Nikt nie widzi innych członków. */
final class GroupsScreen {
    // klucz grupy na serwerze, emoji, id tekstu z nazwą
    private static final Object[][] NAMES = {
        {"car", "🚗", R.string.tpl_car}, {"tires", "🛞", R.string.tpl_tires}, {"blood", "🩸", R.string.tpl_blood},
        {"dentist", "🦷", R.string.tpl_dentist}, {"boiler", "🔥", R.string.tpl_boiler}, {"smoke", "🔋", R.string.tpl_smoke}};

    private final Activity activity;
    private final Ui ui;
    private final String secret;
    private final LinearLayout host;
    private final Runnable onClose;

    GroupsScreen(Activity activity, Ui ui, String secret, LinearLayout host, Runnable onClose) {
        this.activity = activity; this.ui = ui; this.secret = secret; this.host = host; this.onClose = onClose;
    }

    void back() { onClose.run(); }

    void show() {
        setBody(ui.label(ui.s(R.string.chores_loading), 18, Ui.INK));
        Api.query("groups:list", args("today", LocalDate.now().toString()), r -> {
            if (r.isOk()) showList(r.value.optJSONArray("items"));
            else showError(ui.s(R.string.groups_load_err, r.error), this::show);
        });
    }

    private void showList(JSONArray items) {
        LinearLayout col = column();
        col.addView(ui.title(ui.s(R.string.groups_title)));
        col.addView(ui.label(ui.s(R.string.groups_intro), 15, Ui.MUTED));
        for (int i = 0; i < items.length(); i++) {
            JSONObject g = items.optJSONObject(i);
            Object[] name = nameFor(g.optString("key"));
            if (name != null) col.addView(card(g, (String) name[1], (Integer) name[2]));
        }
        col.addView(ui.secondary(ui.s(R.string.chores_back), onClose));
        setBody(col);
    }

    private LinearLayout card(JSONObject g, String emoji, int nameRes) {
        String key = g.optString("key");
        boolean joined = g.optBoolean("joined");
        NumberFormat nf = NumberFormat.getIntegerInstance();
        LinearLayout card = ui.card();
        TextView title = ui.text(emoji + "  " + ui.s(nameRes), 20, Ui.INK);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(title);
        card.addView(ui.text(Format.cycle(g.optInt("everyMonths")), 14, Ui.MUTED));
        TextView stats = ui.text(ui.s(R.string.groups_stats, nf.format(g.optLong("members")), nf.format(g.optLong("doneThisPeriod"))), 15, Ui.INK);
        stats.setPadding(0, ui.dp(6), 0, 0);
        card.addView(stats);
        // Zrobiło może przekraczać członków (część wyszła po odhaczeniu): pasek jest wtedy pełny.
        long members = g.optLong("members");
        card.addView(ui.progress(members == 0 ? 0 : (double) g.optLong("doneThisPeriod") / members, Ui.GOOD));
        LinearLayout row = new LinearLayout(activity);
        row.setPadding(0, ui.dp(8), 0, 0);
        if (!joined) {
            row.addView(ui.chip(ui.s(R.string.home_join), Ui.ACCENT, Ui.BG, () -> act("groups:join", key, null)));
        } else {
            if (g.optBoolean("doneByMe")) row.addView(ui.chip(ui.s(R.string.groups_done_already), Ui.GOOD_SOFT, Ui.GOOD, () -> { }));
            else row.addView(ui.chip(ui.s(R.string.groups_done), Ui.ACCENT, Ui.BG, () -> act("groups:markDone", key, LocalDate.now().toString())));
            row.addView(ui.chip(ui.s(R.string.groups_leave), Ui.TRACK, Ui.MUTED, () -> act("groups:leave", key, null)));
        }
        card.addView(row);
        return card;
    }

    private void act(String path, String key, String day) {
        setBody(ui.label(ui.s(R.string.chores_saving), 18, Ui.INK));
        Api.mutation(path, argsFor(path, key, day), r -> {
            if (r.isOk()) {
                if ("groups:join".equals(path) && Build.VERSION.SDK_INT >= 33) activity.requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, 1);
                show();
            }
            else showError(ui.s(R.string.groups_act_err, r.error), () -> act(path, key, day));
        });
    }

    static Object[] nameFor(String key) {
        for (Object[] n : NAMES) if (n[0].equals(key)) return n;
        return null; // klucz nieznany tej wersji apki: pomijamy, nie udajemy
    }

    private void showError(String message, Runnable retry) {
        LinearLayout col = column();
        col.addView(ui.label(message, 18, Ui.INK));
        col.addView(ui.button(ui.s(R.string.common_retry), retry));
        col.addView(ui.secondary(ui.s(R.string.chores_back), onClose));
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

    /** join dostaje "today", markDone "day", leave tylko klucz: serwer odrzuca nieznane argumenty. */
    private JSONObject argsFor(String path, String key, String day) {
        try {
            JSONObject json = args("key", key);
            if ("groups:join".equals(path)) json.put("today", LocalDate.now().toString());
            if (day != null) json.put("day", day);
            return json;
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    private JSONObject args(String k, String v) {
        try {
            return new JSONObject().put("secret", secret).put(k, v);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}

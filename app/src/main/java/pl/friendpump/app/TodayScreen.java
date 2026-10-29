package pl.friendpump.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.time.LocalDate;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Ekran Dziś: czynności kręgu, postęp każdej osoby, szybkie wpisy. Odświeża się co kilka sekund. */
final class TodayScreen {
    private static final long POLL_MS = 5000;

    private final Activity activity;
    private final Ui ui;
    private final String secret, circleId;
    private final LinearLayout host;
    private final Runnable onBack;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable poll = new Runnable() {
        @Override public void run() { load(true); handler.postDelayed(this, POLL_MS); }
    };
    private String last = "";

    TodayScreen(Activity activity, Ui ui, String secret, LinearLayout host, String circleId, Runnable onBack) {
        this.activity = activity; this.ui = ui; this.secret = secret; this.host = host; this.circleId = circleId; this.onBack = onBack;
    }

    void start() {
        stop();
        load(false);
        handler.postDelayed(poll, POLL_MS);
    }

    void stop() { handler.removeCallbacks(poll); }

    private void leave() { stop(); onBack.run(); }

    private void load(boolean quiet) {
        Api.query("checkins:today", args(null, 0), r -> {
            if (r.isOk()) {
                String now = r.value.toString() + LocalDate.now();
                if (!now.equals(last)) { last = now; render(r.value); }
            } else if (!quiet) {
                LinearLayout col = new LinearLayout(activity);
                col.setOrientation(LinearLayout.VERTICAL);
                col.addView(ui.label("Nie udało się pobrać danych (" + r.error + ")", 18, Ui.INK));
                col.addView(ui.button("Spróbuj ponownie", () -> load(false)));
                col.addView(ui.secondary("Wróć", this::leave));
                setBody(col);
            }
        });
    }

    private void render(JSONObject v) {
        LinearLayout col = new LinearLayout(activity);
        col.setOrientation(LinearLayout.VERTICAL);
        TextView back = ui.label("‹ Kręgi", 16, Ui.ACCENT);
        back.setTypeface(Typeface.DEFAULT_BOLD);
        back.setPadding(0, ui.dp(8), ui.dp(24), ui.dp(8));
        back.setOnClickListener(x -> leave());
        col.addView(back);
        JSONObject circle = v.optJSONObject("circle");
        String code = Format.code(circle.optString("inviteCode"));
        col.addView(ui.title(circle.optString("name")));
        col.addView(ui.label(Format.dayLabel(LocalDate.now()), 15, Ui.MUTED));
        col.addView(ui.secondary("Kod " + code + " · Udostępnij", () -> HomeScreen.share(activity, circle.optString("name"), code)));
        JSONArray members = v.optJSONArray("members");
        JSONArray acts = v.optJSONArray("activities");
        for (int i = 0; i < acts.length(); i++) col.addView(activityCard(acts.optJSONObject(i), members));
        setBody(col);
    }

    private LinearLayout activityCard(JSONObject a, JSONArray members) {
        String unit = a.optString("unit");
        int target = a.optInt("dailyTarget");
        JSONArray totals = a.optJSONArray("totals");
        int done = 0, mine = 0;
        LinearLayout card = ui.card();
        for (int i = 0; i < totals.length(); i++) {
            int total = totals.optJSONObject(i).optInt("total");
            if (total >= target) done++;
            if (members.optJSONObject(i).optBoolean("isMe")) mine = total;
        }
        LinearLayout head = new LinearLayout(activity);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView name = ui.text(a.optString("emoji") + "  " + a.optString("name"), 19, Ui.INK);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        head.addView(name, new LinearLayout.LayoutParams(0, -2, 1));
        boolean all = done == totals.length();
        head.addView(ui.text(done + "/" + totals.length() + " zrobiło", 14, all ? Ui.GOOD : Ui.MUTED));
        card.addView(head);
        card.addView(ui.text("done".equals(unit) ? "Raz dziennie" : "Cel: " + Format.target(unit, target) + " dziennie", 14, Ui.MUTED));
        for (int i = 0; i < totals.length(); i++) card.addView(memberRow(members.optJSONObject(i), totals.optJSONObject(i).optInt("total"), unit, target));
        card.addView(actions(a.optString("id"), unit, target, mine));
        return card;
    }

    private LinearLayout memberRow(JSONObject m, int total, String unit, int target) {
        boolean ok = total >= target;
        LinearLayout row = new LinearLayout(activity);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setLayoutParams(ui.margins(12));
        String who = m.optString("name") + (m.optBoolean("isMe") ? " (Ty)" : "");
        row.addView(ui.avatar(m.optString("name")));
        LinearLayout mid = new LinearLayout(activity);
        mid.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams mp = new LinearLayout.LayoutParams(0, -2, 1);
        mp.leftMargin = ui.dp(12);
        mp.rightMargin = ui.dp(12);
        mid.addView(ui.text(who, 15, Ui.INK));
        boolean tick = "done".equals(unit);
        if (!tick) {
            LinearLayout bar = ui.progress(total / (double) target, ok ? Ui.GOOD : Ui.ACCENT);
            LinearLayout.LayoutParams bp = (LinearLayout.LayoutParams) bar.getLayoutParams();
            bp.topMargin = ui.dp(6);
            mid.addView(bar);
        }
        row.addView(mid, mp);
        String value = tick ? (ok ? "✓ zrobione" : "jeszcze nie") : (ok ? "✓ " + total : total + "/" + target);
        TextView v = ui.text(value, 15, ok ? Ui.GOOD : (total > 0 ? Ui.INK : Ui.MUTED));
        v.setTypeface(ok ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        row.addView(v);
        return row;
    }

    private LinearLayout actions(String activityId, String unit, int target, int mine) {
        LinearLayout row = new LinearLayout(activity);
        row.setLayoutParams(ui.margins(16));
        if ("done".equals(unit)) {
            if (mine == 0) row.addView(ui.chip("Zrobione ✓", Ui.ACCENT, Ui.BG, () -> add(activityId, 1)));
            else row.addView(ui.chip("Cofnij", Ui.TRACK, Ui.MUTED, () -> undo(activityId)));
            return row;
        }
        for (int s : Format.steps(unit, target)) row.addView(ui.chip("+" + s, Ui.ACCENT_SOFT, Ui.ACCENT, () -> add(activityId, s)));
        row.addView(ui.chip("Inne", Ui.ACCENT_SOFT, Ui.ACCENT, () -> askAmount(activityId)));
        if (mine > 0) row.addView(ui.chip("Cofnij", Ui.TRACK, Ui.MUTED, () -> undo(activityId)));
        return row;
    }

    private void askAmount(String activityId) {
        EditText input = ui.input("Ile?");
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        new AlertDialog.Builder(activity).setTitle("Dodaj wpis").setView(input)
            .setNegativeButton("Anuluj", null)
            .setPositiveButton("Dodaj", (d, w) -> {
                try {
                    add(activityId, Integer.parseInt(input.getText().toString().trim()));
                } catch (NumberFormatException e) {
                    Toast.makeText(activity, "Wpisz liczbę", Toast.LENGTH_SHORT).show();
                }
            }).show();
    }

    private void add(String activityId, int value) {
        Api.mutation("checkins:add", args(activityId, value), r -> afterWrite(r, "Nie udało się zapisać"));
    }

    private void undo(String activityId) {
        Api.mutation("checkins:undoLast", args(activityId, 0), r -> afterWrite(r, "Nie udało się cofnąć"));
    }

    private void afterWrite(Api.Result r, String failure) {
        if (r.isOk()) { load(false); return; }
        String why = "NOTHING_TO_UNDO".equals(r.error) ? "Nie ma czego cofać" : "BAD_VALUE".equals(r.error) ? "Niepoprawna liczba" : failure + " (" + r.error + ")";
        Toast.makeText(activity, why, Toast.LENGTH_SHORT).show();
    }

    private void setBody(LinearLayout col) {
        ScrollView scroll = new ScrollView(activity);
        scroll.addView(col);
        host.removeAllViews();
        host.addView(scroll, new LinearLayout.LayoutParams(-1, -1));
    }

    private JSONObject args(String activityId, int value) {
        try {
            JSONObject json = new JSONObject().put("secret", secret).put("day", LocalDate.now().toString());
            if (activityId == null) return json.put("circleId", circleId);
            json.put("activityId", activityId);
            return value > 0 ? json.put("value", value) : json;
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}

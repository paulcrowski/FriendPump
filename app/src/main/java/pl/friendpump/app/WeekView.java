package pl.friendpump.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.time.LocalDate;
import org.json.JSONArray;
import org.json.JSONObject;

/** Zakładka Tydzień: siatka 7 dni każdej osoby, seria dni i sumy tygodnia na czynność. */
final class WeekView {
    private final Activity activity;
    private final Ui ui;

    WeekView(Activity activity, Ui ui) { this.activity = activity; this.ui = ui; }

    LinearLayout build(JSONObject week) {
        LinearLayout col = vertical();
        JSONArray days = week.optJSONArray("days");
        JSONArray members = week.optJSONArray("members");
        LinearLayout grid = ui.card();
        TextView title = ui.text(ui.s(R.string.week_title), 18, Ui.INK);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        grid.addView(title);
        grid.addView(ui.text(ui.s(R.string.week_legend), 13, Ui.MUTED));
        grid.addView(dayHeader(days));
        for (int i = 0; i < members.length(); i++) grid.addView(memberGrid(members.optJSONObject(i)));
        col.addView(grid);
        JSONArray acts = week.optJSONArray("activities");
        for (int i = 0; i < acts.length(); i++) col.addView(activityTotals(acts.optJSONObject(i), members));
        return col;
    }

    private LinearLayout dayHeader(JSONArray days) {
        LinearLayout row = horizontal();
        row.setLayoutParams(ui.margins(14));
        for (int i = 0; i < days.length(); i++) {
            boolean today = i == days.length() - 1;
            TextView d = ui.text(Format.dayShort(LocalDate.parse(days.optString(i))), 12, today ? Ui.ACCENT : Ui.MUTED);
            d.setGravity(Gravity.CENTER);
            if (today) d.setTypeface(Typeface.DEFAULT_BOLD);
            row.addView(d, new LinearLayout.LayoutParams(0, -2, 1));
        }
        return row;
    }

    private LinearLayout memberGrid(JSONObject m) {
        LinearLayout box = vertical();
        box.setLayoutParams(ui.margins(14));
        LinearLayout head = horizontal();
        head.setGravity(Gravity.CENTER_VERTICAL);
        String name = m.optString("name");
        head.addView(ui.avatar(name));
        TextView who = ui.text(name + (m.optBoolean("isMe") ? ui.s(R.string.week_you) : ""), 15, Ui.INK);
        who.setPadding(ui.dp(10), 0, 0, 0);
        head.addView(who, new LinearLayout.LayoutParams(0, -2, 1));
        int streak = m.optInt("streak");
        if (streak > 0) {
            TextView s = ui.text(streak == 1 ? ui.s(R.string.week_streak_one) : ui.s(R.string.week_streak_many, streak), 14, Ui.ACCENT);
            s.setTypeface(Typeface.DEFAULT_BOLD);
            head.addView(s);
        }
        box.addView(head);
        LinearLayout cells = horizontal();
        cells.setLayoutParams(ui.margins(8));
        JSONArray days = m.optJSONArray("days");
        for (int i = 0; i < days.length(); i++) cells.addView(cell(days.optJSONObject(i).optInt("done"), days.optJSONObject(i).optInt("of")));
        box.addView(cells);
        return box;
    }

    private LinearLayout cell(int done, int of) {
        boolean full = of > 0 && done == of;
        TextView c = ui.text(full ? "✓" : (done > 0 ? String.valueOf(done) : ""), 13, full ? Color.WHITE : Ui.ACCENT);
        c.setGravity(Gravity.CENTER);
        c.setTypeface(Typeface.DEFAULT_BOLD);
        c.setBackground(circle(full ? Ui.GOOD : (done > 0 ? Ui.ACCENT_SOFT : Ui.TRACK)));
        LinearLayout holder = horizontal();
        holder.setGravity(Gravity.CENTER);
        holder.addView(c, new LinearLayout.LayoutParams(ui.dp(30), ui.dp(30)));
        holder.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1));
        return holder;
    }

    private LinearLayout activityTotals(JSONObject a, JSONArray members) {
        String unit = a.optString("unit");
        int target = a.optInt("dailyTarget");
        LinearLayout card = ui.card();
        TextView name = ui.text(a.optString("emoji") + "  " + a.optString("name"), 18, Ui.INK);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(name);
        card.addView(ui.text(ui.s(R.string.week_total), 13, Ui.MUTED));
        for (int i = 0; i < members.length(); i++) {
            JSONObject m = members.optJSONObject(i);
            int total = 0;
            JSONArray totals = m.optJSONArray("totals");
            for (int j = 0; j < totals.length(); j++) if (totals.optJSONObject(j).optString("activityId").equals(a.optString("id"))) total = totals.optJSONObject(j).optInt("total");
            LinearLayout row = horizontal();
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setLayoutParams(ui.margins(12));
            row.addView(ui.avatar(m.optString("name")));
            LinearLayout mid = vertical();
            mid.addView(ui.text(m.optString("name") + (m.optBoolean("isMe") ? ui.s(R.string.week_you) : ""), 15, Ui.INK));
            LinearLayout bar = ui.progress(total / (double) (target * 7), total >= target * 7 ? Ui.GOOD : Ui.ACCENT);
            ((LinearLayout.LayoutParams) bar.getLayoutParams()).topMargin = ui.dp(6);
            mid.addView(bar);
            LinearLayout.LayoutParams mp = new LinearLayout.LayoutParams(0, -2, 1);
            mp.leftMargin = ui.dp(12);
            mp.rightMargin = ui.dp(12);
            row.addView(mid, mp);
            String value = "done".equals(unit) ? (total == 1 ? ui.s(R.string.week_days_one) : ui.s(R.string.week_days_many, total)) : "minutes".equals(unit) ? total + " min" : String.valueOf(total);
            TextView v = ui.text(value, 15, total > 0 ? Ui.INK : Ui.MUTED);
            v.setTypeface(Typeface.DEFAULT_BOLD);
            row.addView(v);
            card.addView(row);
        }
        return card;
    }

    private android.graphics.drawable.GradientDrawable circle(int color) {
        android.graphics.drawable.GradientDrawable g = new android.graphics.drawable.GradientDrawable();
        g.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        g.setColor(color);
        return g;
    }

    private LinearLayout vertical() {
        LinearLayout v = new LinearLayout(activity);
        v.setOrientation(LinearLayout.VERTICAL);
        return v;
    }

    private LinearLayout horizontal() { return new LinearLayout(activity); }
}

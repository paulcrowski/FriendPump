package pl.friendpump.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Formularz nowego kręgu: nazwa + wybór czynności z celami. */
final class CreateCircleForm {
    private static final int MAX_NAME = 30;

    private static final class Row {
        final String emoji, name, unit;
        final int defaultTarget;
        EditText target;
        boolean selected;
        LinearLayout view;

        Row(String emoji, String name, String unit, int defaultTarget) {
            this.emoji = emoji; this.name = name; this.unit = unit; this.defaultTarget = defaultTarget;
        }
    }

    private final Activity activity;
    private final Ui ui;
    private final String secret;
    private final LinearLayout host;
    private final Runnable onDone, onCancel;
    private final List<Row> rows = new ArrayList<>();
    private EditText nameInput;
    private LinearLayout list;
    private TextView problem;

    CreateCircleForm(Activity activity, Ui ui, String secret, LinearLayout host, Runnable onDone, Runnable onCancel) {
        this.activity = activity; this.ui = ui; this.secret = secret; this.host = host; this.onDone = onDone; this.onCancel = onCancel;
        rows.add(new Row("💪", "Pompki", "count", 20));
        rows.add(new Row("🧗", "Podciągnięcia", "count", 10));
        rows.add(new Row("🧘", "Medytacja", "minutes", 10));
        rows.add(new Row("🧶", "Druty", "done", 1));
        rows.add(new Row("🏃", "Bieganie", "minutes", 30));
        rows.add(new Row("📖", "Czytanie", "minutes", 20));
        rows.add(new Row("💧", "Woda (szklanki)", "count", 8));
        rows.add(new Row("🥗", "Zdrowy obiad", "done", 1));
    }

    void show() {
        LinearLayout col = new LinearLayout(activity);
        col.setOrientation(LinearLayout.VERTICAL);
        col.addView(ui.title("Nowy krąg"));
        nameInput = ui.input("Nazwa, np. Treningi");
        nameInput.setFilters(new InputFilter[] {new InputFilter.LengthFilter(MAX_NAME)});
        col.addView(nameInput);
        col.addView(ui.label("Co robicie razem? Wybierz i ustaw cel na dzień.", 15, Ui.MUTED));
        list = new LinearLayout(activity);
        list.setOrientation(LinearLayout.VERTICAL);
        col.addView(list);
        for (Row r : rows) addRowView(r);
        col.addView(ui.secondary("+ Własna czynność", this::showCustomDialog));
        problem = ui.label("", 14, Ui.ACCENT);
        col.addView(problem);
        col.addView(ui.button("Utwórz krąg", this::submit));
        col.addView(ui.secondary("Anuluj", onCancel));
        ScrollView scroll = new ScrollView(activity);
        scroll.addView(col);
        host.removeAllViews();
        host.addView(scroll, new LinearLayout.LayoutParams(-1, -1));
    }

    private void addRowView(Row r) {
        LinearLayout row = new LinearLayout(activity);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(ui.dp(16), ui.dp(12), ui.dp(16), ui.dp(12));
        row.setLayoutParams(ui.margins(10));
        TextView label = ui.text(r.emoji + "  " + r.name, 17, Ui.INK);
        row.addView(label, new LinearLayout.LayoutParams(0, -2, 1));
        r.target = new EditText(activity);
        r.target.setInputType(InputType.TYPE_CLASS_NUMBER);
        r.target.setFilters(new InputFilter[] {new InputFilter.LengthFilter(4)});
        r.target.setText(String.valueOf(r.defaultTarget));
        r.target.setGravity(Gravity.CENTER);
        r.target.setTextColor(Ui.INK);
        r.target.setBackground(ui.rounded(Ui.CARD, Ui.LINE, 10));
        row.addView(r.target, new LinearLayout.LayoutParams(ui.dp(64), -2));
        TextView unit = ui.text("minutes".equals(r.unit) ? " min" : " razy", 14, Ui.MUTED);
        unit.setVisibility("done".equals(r.unit) ? View.GONE : View.VISIBLE);
        row.addView(unit);
        r.view = row;
        row.setOnClickListener(v -> { r.selected = !r.selected; style(r); });
        style(r);
        list.addView(row);
    }

    private void style(Row r) {
        r.view.setBackground(r.selected ? ui.rounded(Ui.ACCENT_SOFT, Ui.ACCENT, 16) : ui.rounded(Ui.CARD, Ui.LINE, 16));
        boolean showTarget = r.selected && !"done".equals(r.unit);
        r.target.setVisibility(showTarget ? View.VISIBLE : View.GONE);
        r.view.getChildAt(2).setVisibility(showTarget ? View.VISIBLE : View.GONE);
    }

    private void showCustomDialog() {
        LinearLayout box = new LinearLayout(activity);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = ui.dp(20);
        box.setPadding(pad, pad, pad, 0);
        EditText name = ui.input("Nazwa czynności");
        EditText target = ui.input("Cel na dzień");
        target.setInputType(InputType.TYPE_CLASS_NUMBER);
        RadioGroup units = new RadioGroup(activity);
        String[] labels = {"razy", "minuty", "zrobione (tak/nie)"};
        for (int i = 0; i < labels.length; i++) {
            RadioButton rb = new RadioButton(activity);
            rb.setText(labels[i]);
            rb.setId(i + 1);
            units.addView(rb);
        }
        units.check(1);
        box.addView(name);
        box.addView(target);
        box.addView(units);
        new AlertDialog.Builder(activity).setTitle("Własna czynność").setView(box)
            .setNegativeButton("Anuluj", null)
            .setPositiveButton("Dodaj", (d, w) -> {
                String n = name.getText().toString().trim();
                String unit = new String[] {"count", "minutes", "done"}[units.getCheckedRadioButtonId() - 1];
                int t = parse(target.getText().toString(), "done".equals(unit) ? 1 : -1);
                if (n.isEmpty() || t < 1) { problem.setText("Własna czynność: podaj nazwę i cel (1–1000)"); return; }
                Row r = new Row("⭐", n, unit, t);
                r.selected = true;
                rows.add(r);
                addRowView(r);
                problem.setText("");
            }).show();
    }

    private static int parse(String s, int fallback) {
        try {
            int v = Integer.parseInt(s.trim());
            return v >= 1 && v <= 1000 ? v : fallback;
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private void submit() {
        String name = nameInput.getText().toString().trim();
        if (name.isEmpty()) { problem.setText("Wpisz nazwę kręgu"); return; }
        JSONArray chosen = new JSONArray();
        try {
            for (Row r : rows) {
                if (!r.selected) continue;
                int t = "done".equals(r.unit) ? 1 : parse(r.target.getText().toString(), -1);
                if (t < 1) { problem.setText("Cel przy „" + r.name + "” musi być liczbą 1–1000"); return; }
                chosen.put(new JSONObject().put("name", r.name).put("emoji", r.emoji).put("unit", r.unit).put("dailyTarget", t));
            }
            if (chosen.length() == 0) { problem.setText("Wybierz co najmniej jedną czynność"); return; }
            JSONObject args = new JSONObject().put("secret", secret).put("name", name).put("activities", chosen);
            problem.setText("Tworzę krąg…");
            Api.mutation("circles:create", args, r -> {
                if (r.isOk()) onDone.run();
                else problem.setText("Nie udało się utworzyć kręgu (" + r.error + ")");
            });
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}

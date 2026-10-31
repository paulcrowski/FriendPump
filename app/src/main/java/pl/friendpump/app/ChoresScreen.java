package pl.friendpump.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.graphics.Typeface;
import android.text.InputFilter;
import android.view.Gravity;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.time.LocalDate;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** "Rzeczy na życie": prywatne zadania co N miesięcy (przegląd auta, opony, badania krwi). */
final class ChoresScreen {
    private static final int MAX_NAME = 30;
    private static final int[] CYCLES = {3, 6, 12, 24};
    // emoji, nazwa, cykl w miesiącach
    private static final Object[][] TEMPLATES = {
        {"🚗", "Przegląd auta", 12}, {"🛞", "Wymiana opon", 6}, {"🩸", "Badania krwi", 12},
        {"🦷", "Dentysta", 6}, {"🔥", "Przegląd kotła", 12}, {"🔋", "Baterie w czujnikach dymu", 12}};

    private final Activity activity;
    private final Ui ui;
    private final String secret;
    private final LinearLayout host;
    private final Runnable onClose;
    private Runnable backAction;

    ChoresScreen(Activity activity, Ui ui, String secret, LinearLayout host, Runnable onClose) {
        this.activity = activity; this.ui = ui; this.secret = secret; this.host = host; this.onClose = onClose;
        this.backAction = onClose;
    }

    void back() { backAction.run(); }

    void show() {
        backAction = onClose;
        setBody(ui.label("Ładuję…", 18, Ui.INK));
        Api.query("chores:list", args(), r -> {
            if (!r.isOk()) { showError("Nie udało się pobrać listy (" + r.error + ")", this::show); return; }
            showList(r.value.optJSONArray("items"));
        });
    }

    private void showList(JSONArray items) {
        LinearLayout col = column();
        col.addView(ui.title("Rzeczy na życie"));
        col.addView(ui.label("Cykliczne sprawy tylko dla Ciebie. Termin liczymy od dnia, w którym je zrobisz.", 15, Ui.MUTED));
        LocalDate today = LocalDate.now();
        for (int i = 0; i < items.length(); i++) col.addView(card(items.optJSONObject(i), today));
        col.addView(ui.button("Dodaj", this::showPicker));
        col.addView(ui.secondary("Wróć", onClose));
        setBody(col);
    }

    private LinearLayout card(JSONObject c, LocalDate today) {
        LocalDate due = LocalDate.parse(c.optString("nextDue"));
        boolean late = due.isBefore(today);
        String id = c.optString("id"), name = c.optString("name");
        LinearLayout card = ui.card();
        TextView title = ui.text(c.optString("emoji") + "  " + name, 20, Ui.INK);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(title);
        card.addView(ui.text(Format.cycle(c.optInt("everyMonths")) + "  ·  termin " + due, 15, Ui.MUTED));
        TextView when = ui.text(Format.due(today, due), 16, late ? Ui.ACCENT : Ui.GOOD);
        when.setTypeface(Typeface.DEFAULT_BOLD);
        when.setPadding(0, ui.dp(6), 0, 0);
        card.addView(when);
        LinearLayout row = new LinearLayout(activity);
        row.setPadding(0, ui.dp(8), 0, 0);
        row.addView(ui.chip("Zrobione", Ui.GOOD_SOFT, Ui.GOOD, () -> markDone(id)));
        row.addView(ui.chip("Usuń", Ui.ACCENT_SOFT, Ui.ACCENT, () -> confirmArchive(id, name)));
        card.addView(row);
        return card;
    }

    private void markDone(String id) {
        setBody(ui.label("Zapisuję…", 18, Ui.INK));
        Api.mutation("chores:markDone", args("choreId", id, "day", LocalDate.now().toString()), r -> {
            if (r.isOk()) show();
            else if ("BAD_DAY".equals(r.error)) showError("Sprawdź datę i godzinę w telefonie.", this::show);
            else showError("Nie udało się zapisać (" + r.error + ")", () -> markDone(id));
        });
    }

    private void confirmArchive(String id, String name) {
        new AlertDialog.Builder(activity).setMessage("Usunąć „" + name + "”?")
            .setPositiveButton("Usuń", (d, w) -> archive(id)).setNegativeButton("Anuluj", null).show();
    }

    private void archive(String id) {
        setBody(ui.label("Usuwam…", 18, Ui.INK));
        Api.mutation("chores:archive", args("choreId", id), r -> {
            if (r.isOk() || "CHORE_NOT_FOUND".equals(r.error)) show();
            else showError("Nie udało się usunąć (" + r.error + ")", () -> archive(id));
        });
    }

    private void showPicker() {
        backAction = this::show;
        LinearLayout col = column();
        col.addView(ui.title("Co dodać?"));
        for (Object[] t : TEMPLATES) {
            LinearLayout card = ui.card();
            card.addView(ui.text(t[0] + "  " + t[1], 18, Ui.INK));
            card.addView(ui.text(Format.cycle((Integer) t[2]), 14, Ui.MUTED));
            card.setOnClickListener(v -> showForm((String) t[0], (String) t[1], (Integer) t[2], null));
            col.addView(card);
        }
        col.addView(ui.secondary("+ Własne", () -> showForm("📌", "", 12, null)));
        col.addView(ui.secondary("Anuluj", this::show));
        setBody(col);
    }

    private void showForm(String emoji, String name, int cycle, String problem) {
        backAction = this::showPicker;
        LocalDate[] due = {LocalDate.now().plusMonths(cycle)};
        int[] chosen = {cycle};
        LinearLayout col = column();
        col.addView(ui.title(emoji + " Nowa rzecz"));
        EditText input = ui.input("Nazwa, np. Przegląd auta");
        input.setFilters(new InputFilter[] {new InputFilter.LengthFilter(MAX_NAME)});
        input.setText(name);
        col.addView(input);
        col.addView(ui.label("Jak często?", 15, Ui.MUTED));
        LinearLayout cycles = new LinearLayout(activity);
        cycles.setGravity(Gravity.CENTER);
        col.addView(cycles);
        TextView dueLabel = ui.text("", 16, Ui.INK);
        Runnable[] redraw = new Runnable[1];
        redraw[0] = () -> {
            cycles.removeAllViews();
            for (int m : CYCLES) {
                boolean on = m == chosen[0];
                cycles.addView(ui.chip(Format.cycle(m), on ? Ui.ACCENT : Ui.ACCENT_SOFT, on ? Ui.BG : Ui.ACCENT, () -> { chosen[0] = m; redraw[0].run(); }));
            }
            dueLabel.setText("Pierwszy termin: " + due[0]);
        };
        redraw[0].run();
        col.addView(dueLabel);
        col.addView(ui.secondary("Zmień termin", () -> new DatePickerDialog(activity, (p, y, mo, d) -> { due[0] = LocalDate.of(y, mo + 1, d); redraw[0].run(); },
            due[0].getYear(), due[0].getMonthValue() - 1, due[0].getDayOfMonth()).show()));
        if (problem != null) col.addView(ui.label(problem, 14, Ui.ACCENT));
        col.addView(ui.button("Zapisz", () -> create(emoji, input.getText().toString(), chosen[0], due[0])));
        col.addView(ui.secondary("Anuluj", this::showPicker));
        setBody(col);
    }

    private void create(String emoji, String rawName, int cycle, LocalDate due) {
        String name = rawName.trim();
        if (name.isEmpty()) { showForm(emoji, name, cycle, "Wpisz nazwę"); return; }
        setBody(ui.label("Zapisuję…", 18, Ui.INK));
        Api.mutation("chores:create", args("name", name, "emoji", emoji, "everyMonths", cycle, "nextDue", due.toString(), "today", LocalDate.now().toString()), r -> {
            if (r.isOk()) show();
            else if ("BAD_CHORE".equals(r.error)) showForm(emoji, name, cycle, "Sprawdź nazwę i termin (najdalej za 3 lata, najwyżej 50 rzeczy).");
            else if ("BAD_DAY".equals(r.error)) showForm(emoji, name, cycle, "Sprawdź datę i godzinę w telefonie.");
            else showError("Nie udało się zapisać (" + r.error + ")", () -> create(emoji, name, cycle, due));
        });
    }

    private void showError(String message, Runnable retry) {
        LinearLayout col = column();
        col.addView(ui.label(message, 18, Ui.INK));
        col.addView(ui.button("Spróbuj ponownie", retry));
        col.addView(ui.secondary("Wróć", onClose));
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

    private JSONObject args(Object... kv) {
        try {
            JSONObject json = new JSONObject().put("secret", secret);
            for (int i = 0; i < kv.length; i += 2) json.put((String) kv[i], kv[i + 1]);
            return json;
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}

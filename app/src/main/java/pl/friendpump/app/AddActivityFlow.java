package pl.friendpump.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.os.Build;
import android.text.InputFilter;
import android.widget.EditText;
import android.widget.Toast;
import java.time.LocalDate;
import org.json.JSONException;
import org.json.JSONObject;

/** Dodanie czynności cyklicznej do istniejącego kręgu: szablon albo własna, cykl, pierwszy termin. */
final class AddActivityFlow {
    private static final int MAX_NAME = 30;
    private static final int[] CYCLES = {3, 6, 12, 24};
    // emoji, id tekstu z nazwą, cykl w miesiącach
    private static final Object[][] TEMPLATES = {
        {"🚗", R.string.tpl_car, 12}, {"🛞", R.string.tpl_tires, 6}, {"🩸", R.string.tpl_blood, 12},
        {"🦷", R.string.tpl_dentist, 6}, {"🔥", R.string.tpl_boiler, 12}, {"🔋", R.string.tpl_smoke, 12}};

    private final Activity activity;
    private final Ui ui;
    private final String secret, circleId;
    private final Runnable onDone;

    AddActivityFlow(Activity activity, Ui ui, String secret, String circleId, Runnable onDone) {
        this.activity = activity; this.ui = ui; this.secret = secret; this.circleId = circleId; this.onDone = onDone;
    }

    void start() {
        String[] labels = new String[TEMPLATES.length + 1];
        for (int i = 0; i < TEMPLATES.length; i++) labels[i] = TEMPLATES[i][0] + "  " + ui.s((Integer) TEMPLATES[i][1]);
        labels[TEMPLATES.length] = ui.s(R.string.chores_custom);
        new AlertDialog.Builder(activity).setTitle(ui.s(R.string.chores_pick_title)).setItems(labels, (d, i) -> {
            if (i < TEMPLATES.length) pickDate((String) TEMPLATES[i][0], ui.s((Integer) TEMPLATES[i][1]), (Integer) TEMPLATES[i][2]);
            else askName();
        }).show();
    }

    private void askName() {
        EditText input = ui.input(ui.s(R.string.chores_name_hint));
        input.setFilters(new InputFilter[] {new InputFilter.LengthFilter(MAX_NAME)});
        new AlertDialog.Builder(activity).setView(input).setNegativeButton(ui.s(R.string.common_cancel), null)
            .setPositiveButton(ui.s(R.string.chores_save), (d, w) -> {
                String name = input.getText().toString().trim();
                if (name.isEmpty()) { Toast.makeText(activity, ui.s(R.string.chores_name_required), Toast.LENGTH_SHORT).show(); return; }
                askCycle(name);
            }).show();
    }

    private void askCycle(String name) {
        String[] labels = new String[CYCLES.length];
        for (int i = 0; i < CYCLES.length; i++) labels[i] = Format.cycle(CYCLES[i]);
        new AlertDialog.Builder(activity).setTitle(ui.s(R.string.chores_how_often)).setItems(labels, (d, i) -> pickDate("📌", name, CYCLES[i])).show();
    }

    private void pickDate(String emoji, String name, int months) {
        LocalDate def = LocalDate.now().plusMonths(months);
        new DatePickerDialog(activity, (p, y, mo, d) -> submit(emoji, name, months, LocalDate.of(y, mo + 1, d)),
            def.getYear(), def.getMonthValue() - 1, def.getDayOfMonth()).show();
    }

    private void submit(String emoji, String name, int months, LocalDate due) {
        try {
            JSONObject activityJson = new JSONObject().put("name", name).put("emoji", emoji).put("unit", "done").put("dailyTarget", 1)
                .put("everyMonths", months).put("firstDue", due.toString());
            JSONObject args = new JSONObject().put("secret", secret).put("circleId", circleId).put("activity", activityJson);
            Api.mutation("circles:addActivity", args, r -> {
                if (r.isOk()) {
                    if (Build.VERSION.SDK_INT >= 33) activity.requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, 1);
                    onDone.run();
                } else {
                    String msg = "BAD_ACTIVITIES".equals(r.error) ? ui.s(R.string.chores_bad_chore) : ui.s(R.string.chores_save_err, r.error);
                    Toast.makeText(activity, msg, Toast.LENGTH_LONG).show();
                }
            });
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}

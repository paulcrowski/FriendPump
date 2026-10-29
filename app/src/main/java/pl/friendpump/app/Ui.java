package pl.friendpump.app;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Paleta i komponenty do budowania ekranów w kodzie (bez XML). */
final class Ui {
    static final int BG = Color.rgb(251, 246, 239), CARD = Color.WHITE, LINE = Color.rgb(234, 223, 211),
        INK = Color.rgb(43, 29, 20), MUTED = Color.rgb(138, 120, 104),
        ACCENT = Color.rgb(224, 96, 42), ACCENT_SOFT = Color.rgb(252, 230, 216),
        GOOD = Color.rgb(46, 158, 107), GOOD_SOFT = Color.rgb(221, 243, 232), TRACK = Color.rgb(239, 229, 218);

    private final Context context;

    Ui(Context context) { this.context = context; }

    int dp(float value) { return (int) (value * context.getResources().getDisplayMetrics().density + .5f); }

    TextView text(String value, float size, int color) {
        TextView t = new TextView(context);
        t.setText(value);
        t.setTextSize(size);
        t.setTextColor(color);
        return t;
    }

    /** Tekst do lewej z odstępem od poprzedniego elementu. */
    TextView label(String value, float size, int color) {
        TextView t = text(value, size, color);
        t.setLayoutParams(margins(8));
        return t;
    }

    TextView title(String value) {
        TextView t = label(value, 30, INK);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    LinearLayout card() {
        LinearLayout card = new LinearLayout(context);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(CARD, LINE, 20));
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        card.setLayoutParams(margins(14));
        return card;
    }

    Button button(String label, Runnable click) { return pill(label, click, ACCENT, BG); }

    Button secondary(String label, Runnable click) { return pill(label, click, ACCENT_SOFT, ACCENT); }

    EditText input(String hint) {
        EditText e = new EditText(context);
        e.setHint(hint);
        e.setSingleLine(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        e.setTextColor(INK);
        e.setHintTextColor(MUTED);
        e.setTextSize(18);
        e.setBackground(rounded(CARD, LINE, 14));
        e.setPadding(dp(16), dp(12), dp(16), dp(12));
        e.setLayoutParams(margins(16));
        return e;
    }

    GradientDrawable rounded(int color) { return rounded(color, 0, 16); }

    GradientDrawable rounded(int color, int stroke, float radiusDp) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(dp(radiusDp));
        if (stroke != 0) shape.setStroke(dp(1), stroke);
        return shape;
    }

    LinearLayout.LayoutParams margins(int topDp) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(topDp);
        return p;
    }

    private Button pill(String label, Runnable click, int fill, int textColor) {
        Button b = new Button(context);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(textColor);
        b.setGravity(Gravity.CENTER);
        b.setMinHeight(dp(52));
        b.setStateListAnimator(null);
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(Color.argb(60, 0, 0, 0)), rounded(fill, 0, 26), null));
        b.setOnClickListener(v -> click.run());
        b.setLayoutParams(margins(14));
        return b;
    }
}

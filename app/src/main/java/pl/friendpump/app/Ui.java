package pl.friendpump.app;

import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Małe pomocniki do budowania ekranów w kodzie (bez XML). */
final class Ui {
    static final int BG = Color.rgb(255, 248, 241), INK = Color.rgb(51, 36, 28), MUTED = Color.rgb(115, 98, 88), ACCENT = Color.rgb(224, 96, 42), CARD = Color.rgb(255, 236, 222);

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

    TextView label(String value, float size, int color) {
        TextView t = text(value, size, color);
        t.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(8);
        t.setLayoutParams(p);
        return t;
    }

    Button button(String label, Runnable click) {
        Button b = new Button(context);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTextColor(BG);
        b.setMinHeight(dp(48));
        b.setBackground(rounded(ACCENT));
        b.setOnClickListener(v -> click.run());
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(24);
        b.setLayoutParams(p);
        return b;
    }

    GradientDrawable rounded(int color) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(dp(12));
        return shape;
    }
}

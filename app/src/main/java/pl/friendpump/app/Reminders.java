package pl.friendpump.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Lokalne przypomnienia o terminach zadań cyklicznych (bez serwera).
 * Prawda o terminie jest w Convex; w telefonie trzymamy tylko kopię do odtworzenia alarmów po restarcie.
 */
final class Reminders {
    static final String CHANNEL = "chores";
    private static final String PREFS = "friendpump", KEY = "reminders";

    private Reminders() { }

    /** Zastępuje wszystkie alarmy aktualną listą z serwera. */
    static void sync(Context ctx, JSONArray chores) {
        cancelAll(ctx, saved(ctx));
        JSONArray next = new JSONArray();
        LocalDateTime now = LocalDateTime.now();
        try {
            for (int i = 0; i < chores.length(); i++) {
                JSONObject c = chores.getJSONObject(i);
                long at = Format.reminderAt(now, LocalDate.parse(c.getString("nextDue"))).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                next.put(new JSONObject().put("id", c.getString("id")).put("name", c.getString("name")).put("emoji", c.getString("emoji")).put("at", at));
            }
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, next.toString()).apply();
        scheduleAll(ctx, next);
    }

    /** Po restarcie telefonu: alarmy z przyszłości wracają z zapisanej kopii. */
    static void restore(Context ctx) { scheduleAll(ctx, saved(ctx)); }

    static void notifyDue(Context ctx, String id, String emoji, String name) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Rzeczy na życie", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open = PendingIntent.getActivity(ctx, 0, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        nm.notify(id.hashCode(), new android.app.Notification.Builder(ctx, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(emoji + " " + name)
            .setContentText("Termin mija. Gdy zrobisz, odhacz w FriendPump.")
            .setContentIntent(open).setAutoCancel(true).build());
    }

    private static JSONArray saved(Context ctx) {
        try {
            return new JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void scheduleAll(Context ctx, JSONArray list) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int i = 0; i < list.length(); i++) {
            JSONObject c = list.optJSONObject(i);
            if (c == null || c.optLong("at") <= System.currentTimeMillis()) continue;
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, c.optLong("at"), pending(ctx, c));
        }
    }

    private static void cancelAll(Context ctx, JSONArray list) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int i = 0; i < list.length(); i++) {
            JSONObject c = list.optJSONObject(i);
            if (c != null) am.cancel(pending(ctx, c));
        }
    }

    private static PendingIntent pending(Context ctx, JSONObject c) {
        Intent intent = new Intent(ctx, ReminderReceiver.class)
            .putExtra("id", c.optString("id")).putExtra("emoji", c.optString("emoji")).putExtra("name", c.optString("name"));
        return PendingIntent.getBroadcast(ctx, c.optString("id").hashCode(), intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}

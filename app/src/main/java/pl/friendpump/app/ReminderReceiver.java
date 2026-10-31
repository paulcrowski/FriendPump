package pl.friendpump.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Odbiera alarm przypomnienia oraz restart telefonu (wtedy odtwarza alarmy). */
public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) { Reminders.restore(context); return; }
        String id = intent.getStringExtra("id");
        if (id == null) return;
        Reminders.notifyDue(context, id, String.valueOf(intent.getStringExtra("emoji")), String.valueOf(intent.getStringExtra("name")));
    }
}

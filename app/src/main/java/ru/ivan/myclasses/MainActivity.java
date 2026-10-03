package ru.ivan.myclasses;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

public final class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private static final int NOTIFICATION_PERMISSION = 711, IMPORT = 712, EXPORT = 713;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        } else {
            root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                root.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return WindowInsets.CONSUMED;
            } else {
                root.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets.consumeSystemWindowInsets();
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setDomStorageEnabled(false);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
            @Override public void onPageFinished(WebView view, String url) { pushState(); }
        });
        updateColors();
        ReminderScheduler.createChannel(this);
        ReminderScheduler.reschedule(this);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override public void onResume() {
        super.onResume();
        ReminderScheduler.reschedule(this);
        if (web != null) { updateColors(); pushState(); }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent); pushState();
    }

    private void updateColors() {
        String theme = ScheduleRepository.prefs(this).getString("theme", "system");
        boolean dark = theme.equals("dark") || (theme.equals("system") &&
            (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        int background = Color.parseColor(dark ? "#131B1A" : "#F5F5F2");
        root.setBackgroundColor(background); web.setBackgroundColor(background);
        getWindow().setStatusBarColor(background); getWindow().setNavigationBarColor(background);
        int flags = Build.VERSION.SDK_INT < 30 ? View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN : 0;
        if (!dark) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(flags);
        if (Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController() != null) {
            int mask = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            getWindow().getInsetsController().setSystemBarsAppearance(dark ? 0 : mask, mask);
        }
    }

    private String state() {
        try {
            JSONObject state = new JSONObject();
            JSONObject schedule = ScheduleRepository.load(this);
            JSONArray lessons = schedule.getJSONArray("lessons");
            for (int i = 0; i < lessons.length(); i++) {
                JSONObject lesson = lessons.getJSONObject(i);
                String date = lesson.getString("date"); int slot = lesson.getInt("slot");
                String[] times = TimeRules.times(date, slot);
                lesson.put("start", times[0]).put("end", times[1]);
                lesson.put("startMillis", TimeRules.millis(date, slot, false));
                lesson.put("endMillis", TimeRules.millis(date, slot, true));
            }
            state.put("schedule", schedule);
            state.put("enabled", ScheduleRepository.prefs(this).getBoolean("enabled", true));
            state.put("minutes", ScheduleRepository.prefs(this).getInt("minutes", 15));
            state.put("eveningEnabled", ScheduleRepository.prefs(this).getBoolean("eveningEnabled",true));
            state.put("eveningTime", ScheduleRepository.prefs(this).getString("eveningTime","20:00"));
            state.put("travelMinutes", ScheduleRepository.prefs(this).getInt("travelMinutes",-1));
            state.put("preparations", PreparationRepository.load(this));
            state.put("packingDefaults", PreparationRepository.defaults(this));
            state.put("theme", ScheduleRepository.prefs(this).getString("theme", "system"));
            state.put("systemDark", (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
            state.put("notificationsAllowed", ReminderScheduler.notificationsAllowed(this));
            state.put("lessonChannelAllowed", ReminderScheduler.channelAllowed(this,ReminderScheduler.CHANNEL));
            state.put("eveningChannelAllowed", ReminderScheduler.channelAllowed(this,ReminderScheduler.EVENING_CHANNEL));
            state.put("exactAllowed", ReminderScheduler.exactAllowed(this));
            state.put("scheduledCount", ScheduleRepository.prefs(this).getStringSet("scheduled", java.util.Collections.emptySet()).size());
            state.put("schedulerError", ScheduleRepository.prefs(this).getString("schedulerError", ""));
            state.put("today", LocalDate.now(java.time.ZoneId.of(TimeRules.ZONE)).toString());
            state.put("now", System.currentTimeMillis());
            state.put("initialDate", getIntent().getStringExtra("date"));
            state.put("initialLessonId", getIntent().getStringExtra("lessonId"));
            state.put("initialScreen", getIntent().getStringExtra("screen"));
            state.put("navigationToken", getIntent().getStringExtra("navigationToken"));
            state.put("platform", "android");
            return state.toString();
        } catch (Exception exception) {
            return "{\"error\":\"Не удалось загрузить расписание. Попробуйте восстановить исходное в настройках.\"}";
        }
    }

    private void pushState() {
        if (web != null) runOnUiThread(() -> web.evaluateJavascript(
            "window.onNativeStateChanged && window.onNativeStateChanged(" + JSONObject.quote(state()) + ");", null));
    }

    private String success() {
        try { return new JSONObject().put("ok", true).put("state", new JSONObject(state())).toString(); }
        catch (Exception e) { return "{\"ok\":false,\"error\":\"Ошибка обновления\"}"; }
    }

    private String failure(Exception exception) {
        try { return new JSONObject().put("ok", false).put("error", exception.getMessage()).toString(); }
        catch (Exception e) { return "{\"ok\":false,\"error\":\"Не удалось сохранить\"}"; }
    }

    private final class Bridge {
        @JavascriptInterface public String getState() { return state(); }
        @JavascriptInterface public String saveLesson(String json) {
            try {
                ScheduleRepository.saveLesson(MainActivity.this, new JSONObject(json));
                ReminderScheduler.reschedule(MainActivity.this); return success();
            } catch (Exception e) { return failure(e); }
        }
        @JavascriptInterface public String deleteLesson(String id) {
            try {
                ScheduleRepository.deleteLesson(MainActivity.this, id);
                ReminderScheduler.reschedule(MainActivity.this); return success();
            } catch (Exception e) { return failure(e); }
        }
        @JavascriptInterface public String setPreferences(String json) {
            try {
                JSONObject options = new JSONObject(json);
                android.content.SharedPreferences.Editor editor = ScheduleRepository.prefs(MainActivity.this).edit();
                if (options.has("enabled")) editor.putBoolean("enabled", options.getBoolean("enabled"));
                if (options.has("eveningEnabled")) editor.putBoolean("eveningEnabled", options.getBoolean("eveningEnabled"));
                if (options.has("eveningTime")) editor.putString("eveningTime",TimeRules.checkEveningTime(options.getString("eveningTime")));
                if (options.has("travelMinutes")) {
                    int travel=options.getInt("travelMinutes");
                    if (travel < -1 || travel > 240) throw new IllegalArgumentException("Время на дорогу: от 0 до 240 минут");
                    editor.putInt("travelMinutes",travel);
                }
                if (options.has("minutes")) {
                    int minutes = options.getInt("minutes");
                    if (minutes < 0 || minutes > 180) throw new IllegalArgumentException("Интервал: от 0 до 180 минут");
                    editor.putInt("minutes", minutes);
                }
                if (options.has("theme")) {
                    String theme = options.getString("theme");
                    if (!theme.equals("system") && !theme.equals("light") && !theme.equals("dark"))
                        throw new IllegalArgumentException("Неизвестная тема");
                    editor.putString("theme", theme);
                }
                if (!editor.commit()) throw new IllegalStateException("Настройки не сохранились");
                ReminderScheduler.reschedule(MainActivity.this);
                runOnUiThread(() -> updateColors()); return success();
            } catch (Exception e) { return failure(e); }
        }
        @JavascriptInterface public void requestNotifications() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    boolean asked = ScheduleRepository.prefs(MainActivity.this).getBoolean("notificationPermissionAsked", false);
                    if (asked && !shouldShowRequestPermissionRationale("android.permission.POST_NOTIFICATIONS")) {
                        startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
                    } else {
                        ScheduleRepository.prefs(MainActivity.this).edit().putBoolean("notificationPermissionAsked", true).apply();
                        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, NOTIFICATION_PERMISSION);
                    }
                } else if (!ReminderScheduler.notificationsAllowed(MainActivity.this)) {
                    Intent settings = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    startActivity(settings);
                } else { ReminderScheduler.reschedule(MainActivity.this); pushState(); }
            });
        }
        @JavascriptInterface public void requestExactAlarms() {
            runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT >= 31 && !ReminderScheduler.exactAllowed(MainActivity.this))
                        startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                    else pushState();
                } catch (Exception e) { Toast.makeText(MainActivity.this, "Откройте настройки Android → Приложения → Специальный доступ → Будильники и напоминания", Toast.LENGTH_LONG).show(); }
            });
        }
        @JavascriptInterface public void testNotification() {
            runOnUiThread(() -> {
                if (!ReminderScheduler.notificationsAllowed(MainActivity.this)) {
                    Toast.makeText(MainActivity.this, "Сначала разрешите уведомления", Toast.LENGTH_LONG).show(); return;
                }
                ReminderScheduler.scheduleTest(MainActivity.this,false);
                Toast.makeText(MainActivity.this, ReminderScheduler.exactAllowed(MainActivity.this) ? "Уведомление через 10 секунд. Можно закрыть приложение." : "Проверка запланирована. Для точного времени разрешите будильники и напоминания.", Toast.LENGTH_LONG).show();
            });
        }
        @JavascriptInterface public void openNotificationSettings() {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID, ReminderScheduler.CHANNEL)));
        }
        @JavascriptInterface public String savePreparation(String json) {
            try { PreparationRepository.save(MainActivity.this,new JSONObject(json)); return success(); }
            catch (Exception e) { return failure(e); }
        }
        @JavascriptInterface public String resetPreparation(String date) {
            try { PreparationRepository.reset(MainActivity.this,date); return success(); }
            catch (Exception e) { return failure(e); }
        }
        @JavascriptInterface public void testEveningNotification() {
            runOnUiThread(() -> {
                if (!ReminderScheduler.channelAllowed(MainActivity.this,ReminderScheduler.EVENING_CHANNEL)) {
                    Toast.makeText(MainActivity.this,"Сначала разреши вечерние уведомления",Toast.LENGTH_LONG).show(); return;
                }
                ReminderScheduler.scheduleTest(MainActivity.this,true);
                Toast.makeText(MainActivity.this,"Проверка через 10 секунд. Нажми на уведомление, чтобы открыть список вещей.",Toast.LENGTH_LONG).show();
            });
        }
        @JavascriptInterface public void openEveningNotificationSettings() {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID,ReminderScheduler.EVENING_CHANNEL)));
        }
        @JavascriptInterface public void importSchedule() {
            runOnUiThread(() -> startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"}), IMPORT));
        }
        @JavascriptInterface public void exportSchedule() {
            runOnUiThread(() -> startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/json").putExtra(Intent.EXTRA_TITLE, "rgatu-schedule.json"), EXPORT));
        }
        @JavascriptInterface public String restoreOriginal() {
            ScheduleRepository.prefs(MainActivity.this).edit().remove("schedule").commit();
            ReminderScheduler.reschedule(MainActivity.this); return success();
        }
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == NOTIFICATION_PERMISSION) { ReminderScheduler.reschedule(this); pushState(); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null || data.getData() == null) return;
        try {
            if (request == EXPORT) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new IllegalStateException("Не удалось открыть файл");
                    out.write(ScheduleRepository.load(this).toString(2).getBytes(StandardCharsets.UTF_8));
                }
                Toast.makeText(this, "Расписание сохранено", Toast.LENGTH_SHORT).show();
            } else if (request == IMPORT) {
                final JSONObject incoming;
                try (InputStream in = getContentResolver().openInputStream(data.getData())) {
                    if (in == null) throw new IllegalStateException("Не удалось открыть файл");
                    incoming = ScheduleRepository.normalize(new JSONObject(ScheduleRepository.readText(in)));
                }
                new AlertDialog.Builder(this).setTitle("Заменить расписание?")
                    .setMessage("В файле " + incoming.getJSONArray("lessons").length() + " занятий. Текущие правки будут заменены. Сначала можно сохранить копию в настройках.")
                    .setNegativeButton("Отмена", null).setPositiveButton("Заменить", (dialog, which) -> {
                        try { ScheduleRepository.store(this, incoming); ReminderScheduler.reschedule(this); pushState(); }
                        catch (Exception e) { Toast.makeText(this, "Не удалось сохранить расписание", Toast.LENGTH_LONG).show(); }
                    }).show();
            }
        } catch (Exception e) {
            new AlertDialog.Builder(this).setTitle("Не удалось открыть файл").setMessage(e.getMessage()).setPositiveButton("Понятно", null).show();
        }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false", result -> {
            if (!"true".equals(result)) finish();
        });
    }

    @Override protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("Native"); web.destroy(); }
        super.onDestroy();
    }
}

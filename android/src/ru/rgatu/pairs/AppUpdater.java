package ru.rgatu.pairs;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Checks in the background and prepares an update; Android always confirms installation. */
public final class AppUpdater {
    private static final String ORIGIN="https://rgatu-lite.ivan-s-2001.workers.dev/";
    private static final int MAX_APK_BYTES=10*1024*1024;
    private static final long CHECK_INTERVAL=6*60*60*1000L;
    private final MainActivity activity;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final SharedPreferences preferences;
    private volatile boolean checking=false;
    private volatile boolean downloading=false;
    private volatile boolean manual=false;
    private volatile boolean closed=false;
    private volatile boolean waitingForPermission=false;
    private volatile Metadata ready=null;

    private static final class Metadata {
        final int code;
        final int bytes;
        final String version;
        final String hash;
        Metadata(JSONObject value) throws Exception {
            code=value.getInt("versionCode");bytes=value.getInt("bytes");version=value.getString("version");hash=value.getString("sha256").toLowerCase(java.util.Locale.ROOT);
            if(code<1 || bytes<1 || bytes>MAX_APK_BYTES || !version.matches("[0-9]+\\.[0-9]+\\.[0-9]+") || !hash.matches("[a-f0-9]{64}")) throw new Exception("Invalid update metadata");
        }
    }
    AppUpdater(MainActivity owner) {activity=owner;preferences=activity.getSharedPreferences("updates",0);}
    @JavascriptInterface public void checkUpdates() {activity.runOnUiThread(()->check(true));}

    void check(boolean userInitiated) {
        if(closed) return;
        if(ready!=null) { if(userInitiated) offerInstall();return; }
        if(userInitiated) manual=true;
        if(checking || downloading) {if(userInitiated) message(downloading?"Скачиваем обновление…":"Проверяем обновления…");return;}
        if(!userInitiated && System.currentTimeMillis()-preferences.getLong("lastCheck",0)<CHECK_INTERVAL) return;
        checking=true;
        if(userInitiated) message("Проверяем обновления…");
        worker.execute(()->{
            try {
                Metadata update=new Metadata(new JSONObject(new String(readSmall(ORIGIN+"install/version.json"),StandardCharsets.UTF_8)));
                preferences.edit().putLong("lastCheck",System.currentTimeMillis()).apply();
                if(update.code<=installedCode()) {if(manual) message("У тебя последняя версия.");return;}
                File apk=new File(activity.getCacheDir(),"rgatu-update.apk");
                if(!verified(apk,update)) {
                    downloading=true;
                    if(manual) message("Скачиваем обновление…");
                    download(update,apk);
                }
                ready=update;
                // A deferred automatic offer reappears the next day; a manual check always offers it.
                if(manual || preferences.getInt("dismissedCode",0)!=update.code || System.currentTimeMillis()-preferences.getLong("dismissedAt",0)>24*60*60*1000L) activity.runOnUiThread(this::offerInstall);
            } catch(Exception exception) {
                if(manual) message("Не удалось проверить обновления. Попробуй позже.");
            } finally {checking=false;downloading=false;manual=false;}
        });
    }
    private int installedCode() throws Exception {return activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionCode;}
    private HttpURLConnection connect(String address) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(address).openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(8000);connection.setReadTimeout(15000);
        connection.setRequestProperty("Accept-Encoding","identity");connection.setRequestProperty("Cache-Control","no-cache");
        connection.connect();
        if(connection.getResponseCode()!=200) {connection.disconnect();throw new Exception("Update unavailable");}
        return connection;
    }
    private byte[] readSmall(String address) throws Exception {
        HttpURLConnection connection=connect(address);
        try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[4096];int size;
            while((size=input.read(buffer))!=-1) {if(output.size()+size>65536) throw new Exception("Metadata too large");output.write(buffer,0,size);}
            return output.toByteArray();
        } finally {connection.disconnect();}
    }
    private void download(Metadata update,File apk) throws Exception {
        File partial=new File(activity.getCacheDir(),"rgatu-update.part.apk");
        HttpURLConnection connection=connect(ORIGIN+"download/android");
        try(InputStream input=connection.getInputStream();FileOutputStream output=new FileOutputStream(partial)) {
            byte[] buffer=new byte[16384];int size;long total=0;
            while((size=input.read(buffer))!=-1) {
                total+=size;
                if(closed || Thread.currentThread().isInterrupted() || total>update.bytes || total>MAX_APK_BYTES) throw new Exception("Invalid update download");
                output.write(buffer,0,size);
            }
            if(total!=update.bytes) throw new Exception("Incomplete update download");
        } catch(Exception exception) {partial.delete();throw exception;}
        finally {connection.disconnect();}
        if(!verified(partial,update)) {partial.delete();throw new Exception("Update verification failed");}
        if(apk.exists() && !apk.delete() || !partial.renameTo(apk)) {partial.delete();throw new Exception("Cannot prepare update");}
    }
    private boolean verified(File apk,Metadata update) {
        try {
            if(!apk.isFile() || apk.length()!=update.bytes) return false;
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            try(InputStream input=new java.io.FileInputStream(apk)) {byte[] buffer=new byte[16384];int size;while((size=input.read(buffer))!=-1)digest.update(buffer,0,size);}
            StringBuilder hash=new StringBuilder();for(byte value:digest.digest())hash.append(String.format(java.util.Locale.ROOT,"%02x",value&255));
            if(!update.hash.equals(hash.toString())) return false;
            int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
            PackageManager manager=activity.getPackageManager();
            PackageInfo archive=manager.getPackageArchiveInfo(apk.getAbsolutePath(),flags);
            PackageInfo installed=manager.getPackageInfo(activity.getPackageName(),flags);
            if(archive==null || !activity.getPackageName().equals(archive.packageName) || archive.versionCode!=update.code || archive.versionCode<=installed.versionCode) return false;
            Signature[] actual=Build.VERSION.SDK_INT>=28?archive.signingInfo.getApkContentsSigners():archive.signatures;
            Signature[] expected=Build.VERSION.SDK_INT>=28?installed.signingInfo.getApkContentsSigners():installed.signatures;
            if(actual==null || expected==null || actual.length!=expected.length) return false;
            for(Signature signature:expected)if(!Arrays.asList(actual).contains(signature))return false;
            return true;
        } catch(Exception exception) {return false;}
    }
    private void offerInstall() {
        if(closed || activity.isFinishing() || ready==null) return;
        new AlertDialog.Builder(activity).setTitle("Обновление готово")
            .setMessage("Новая версия "+ready.version+" уже скачана. Твоя группа сохранится.")
            .setPositiveButton("Обновить",(dialog,which)->install())
            .setNegativeButton("Позже",(dialog,which)->preferences.edit().putInt("dismissedCode",ready.code).putLong("dismissedAt",System.currentTimeMillis()).apply())
            .show();
    }
    private void install() {
        if(ready==null) return;
        if(!activity.getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(activity).setTitle("Разреши обновления")
                .setMessage("Android попросит один раз разрешить установку из «РГАТУ Пары». После этого вернись сюда.")
                .setPositiveButton("Продолжить",(dialog,which)->{
                    try {waitingForPermission=true;activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())));}
                    catch(Exception exception) {waitingForPermission=false;message("Не удалось открыть разрешение. Попробуй позже.");}
                }).setNegativeButton("Позже",null).show();
            return;
        }
        // Recheck immediately before granting the installer access to the private APK.
        if(!verified(new File(activity.getCacheDir(),"rgatu-update.apk"),ready)) {ready=null;message("Обновление нужно скачать заново.");check(true);return;}
        try {
            Uri uri=Uri.parse("content://ru.rgatu.pairs.updates/apk");
            Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent);
        } catch(Exception exception) {message("Не удалось открыть установку. Попробуй позже.");}
    }
    void onResume() {
        if(waitingForPermission) {
            waitingForPermission=false;
            if(activity.getPackageManager().canRequestPackageInstalls()) install();else message("Обновить можно позже в «Моей группе».");
        } else check(false);
    }
    private void message(String text) {activity.runOnUiThread(()->{if(!closed && !activity.isFinishing())Toast.makeText(activity,text,Toast.LENGTH_LONG).show();});}
    void close() {closed=true;worker.shutdownNow();}
}

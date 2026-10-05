package ru.rgatu.pairs;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final String APP_URL = "https://rgatu-lite.ivan-s-2001.workers.dev/";
    private WebView web;
    private AppUpdater updater;

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        int background = Color.parseColor("#eef1f4");\n        int header = Color.parseColor("#1f274b");
        getWindow().setStatusBarColor(header);
        getWindow().setNavigationBarColor(background);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(background);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            container.setOnApplyWindowInsetsListener((view,insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left,bars.top,bars.right,bars.bottom);
                return insets;
            });
        }
        web = new WebView(this);
        web.setBackgroundColor(background);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString() + " RgatuLiteAndroid/1.2.0");
        updater = new AppUpdater(this);
        web.addJavascriptInterface(updater,"RgatuApp");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"GET".equals(request.getMethod()) || !Uri.parse(APP_URL).getHost().equals(uri.getHost())) return null;
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..") || path.startsWith("/api/") || path.startsWith("/download/")) return null;
                if (!path.matches("/(index\\.html|app\\.css|app\\.js|timetable\\.js|schedule\\.(js|json)|consultations\\.js|manifest\\.webmanifest|icons/[a-z0-9.-]+)")) return null;
                try {
                    String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "application/javascript" : path.endsWith(".json") ? "application/json" : path.endsWith(".webmanifest") ? "application/manifest+json" : path.endsWith(".svg") ? "image/svg+xml" : "image/png";
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Cache-Control","no-store");
                    headers.put("X-Content-Type-Options","nosniff");
                    return new WebResourceResponse(mime,path.endsWith(".png") ? null : "UTF-8",200,"OK",headers,getAssets().open("web" + path));
                } catch (IOException exception) { return null; }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (!"https".equals(scheme) && !"http".equals(scheme)) return true;
                if (Uri.parse(APP_URL).getHost().equals(uri.getHost()) && ("/".equals(uri.getPath()) || "/index.html".equals(uri.getPath()))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); }
                catch (Exception exception) { Toast.makeText(MainActivity.this,"Не удалось открыть ссылку",Toast.LENGTH_SHORT).show(); }
                return true;
            }
        });
        web.setDownloadListener((url,agent,disposition,mime,length) -> {
            if (url.startsWith("https://")) {
                try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url))); }
                catch (Exception exception) { Toast.makeText(this,"Не удалось открыть ссылку",Toast.LENGTH_SHORT).show(); }
            }
        });
        container.addView(web,new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(container);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0,this::handleBack);
        if (savedState == null || web.restoreState(savedState) == null) web.loadUrl(APP_URL);
    }

    private void handleBack() {
        web.evaluateJavascript("(() => {if (['#calendar','#search','#group','#bells','#session','#consultations','#profile'].includes(location.hash)) {location.hash='#day';return true;}return false;})()", result -> {
            if (!"true".equals(result)) finish();
        });
    }

    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state);super.onSaveInstanceState(state); }
    @Override protected void onResume() {super.onResume();if(updater!=null)updater.onResume();}
    @Override protected void onDestroy() { if(updater!=null)updater.close(); if (web != null) {web.stopLoading();web.destroy();}super.onDestroy(); }
}

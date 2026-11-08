package io.github.univerclient;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.URLUtil;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Official SSC forms in an isolated WebView, without the Capacitor JavaScript bridge. */
public class ServicePortalActivity extends AppCompatActivity {
    private WebView web;
    private ProgressBar progress;
    private TextView error;
    private ValueCallback<Uri[]> fileCallback;
    private String lang;
    private boolean downloading;

    private final ActivityResultLauncher<Intent> chooser = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(), result -> {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData()));
                fileCallback = null;
            }
        });

    private String tr(String ru, String kz, String en) {
        return "kz".equals(lang) ? kz : "en".equals(lang) ? en : ru;
    }

    static boolean isUniversityUrl(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equals(uri.getScheme()) && "univer.kaznu.kz".equals(uri.getHost())
            && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    static boolean isServiceUrl(String url) {
        if (!isUniversityUrl(url)) return false;
        Uri uri = Uri.parse(url);
        String path = uri.getPath();
        return ("/ssc/StatementPage".equals(path) && "1".equals(uri.getQueryParameter("stepId"))
            && uri.getQueryParameter("serviceId") != null && uri.getQueryParameter("serviceId").matches("[0-9]+"))
            || ("/ssc/StatementPage".equals(path) && uri.getQueryParameter("statementId") != null
                && uri.getQueryParameter("statementId").matches("[0-9]+"))
            || ("/ssc/StatementList".equals(path) && uri.getQuery() == null)
            || (("/student/fail/".equals(path) || "/student/payinfo/".equals(path)) && uri.getQuery() == null);
    }

    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        String url = getIntent().getStringExtra("url");
        lang = getIntent().getStringExtra("lang");
        if (!isServiceUrl(url)) { finish(); return; }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        Button close = new Button(this);
        close.setText(tr("Закрыть", "Жабу", "Close"));
        close.setMinHeight(dp(48));
        close.setOnClickListener(v -> closePortal());
        TextView title = new TextView(this);
        title.setText(getIntent().getStringExtra("title"));
        title.setTextSize(17);
        title.setMaxLines(2);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        toolbar.addView(close);
        toolbar.setPadding(dp(16), dp(4), dp(8), dp(4));
        root.addView(toolbar);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        error = new TextView(this);
        error.setPadding(dp(16), dp(12), dp(16), dp(12));
        error.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        error.setVisibility(View.GONE);
        root.addView(error);
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        CookieManager.getInstance().flush();
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isUniversityUrl(request.getUrl().toString())) return false;
                Toast.makeText(ServicePortalActivity.this, tr("Переход за пределы Univer недоступен", "Univer-ден тыс өту қолжетімсіз", "This page is outside Univer"), Toast.LENGTH_SHORT).show();
                return true;
            }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError sslError) {
                handler.cancel();
                showError();
            }
            @Override public void onPageStarted(WebView v, String u, android.graphics.Bitmap icon) {
                error.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError e) {
                if (req.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView v, WebResourceRequest req, WebResourceResponse response) {
                if (req.isForMainFrame()) showError();
            }
            @Override public void onFormResubmission(WebView view, android.os.Message dontResend, android.os.Message resend) {
                // Never replay a submitted application automatically after a connection failure.
                dontResend.sendToTarget(); showError();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int value) {
                progress.setProgress(value); progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try { chooser.launch(params.createIntent()); }
                catch (Exception e) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
            @Override public boolean onJsAlert(WebView v, String u, String message, JsResult result) {
                new AlertDialog.Builder(ServicePortalActivity.this).setMessage(message).setPositiveButton(android.R.string.ok, (d, w) -> result.confirm()).setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String u, String message, JsResult result) {
                new AlertDialog.Builder(ServicePortalActivity.this).setMessage(message).setPositiveButton(android.R.string.ok, (d, w) -> result.confirm()).setNegativeButton(android.R.string.cancel, (d, w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
        });
        web.setDownloadListener((href, agent, disposition, mime, size) -> downloadDocument(href, agent, disposition, mime));
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { if (web.canGoBack()) web.goBack(); else closePortal(); }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(url);
    }

    // Use this app's domain-scoped TLS configuration and cookies, including on older Android.
    private void downloadDocument(String href, String agent, String disposition, String mime) {
        if (!isUniversityUrl(href) || downloading) return;
        downloading = true;
        String cookies = CookieManager.getInstance().getCookie(href);
        Toast.makeText(this, tr("Файл скачивается", "Файл жүктелуде", "Downloading file"), Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            java.io.File file = null;
            javax.net.ssl.HttpsURLConnection connection = null;
            try {
                String target = href;
                for (int hop = 0; hop < 6; hop++) {
                    if (!isUniversityUrl(target)) throw new java.io.IOException("Outside Univer");
                    connection = (javax.net.ssl.HttpsURLConnection)new java.net.URL(target).openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(20000); connection.setReadTimeout(60000);
                    connection.setRequestProperty("User-Agent", agent);
                    if (cookies != null) connection.setRequestProperty("Cookie", cookies);
                    int code = connection.getResponseCode();
                    if (code >= 300 && code < 400) {
                        String location = connection.getHeaderField("Location");
                        if (location == null) throw new java.io.IOException("Missing redirect");
                        target = new java.net.URL(new java.net.URL(target), location).toString();
                        connection.disconnect(); connection = null;
                        continue;
                    }
                    if (code != 200) throw new java.io.IOException("Download failed");
                    break;
                }
                if (connection == null) throw new java.io.IOException("Too many redirects");
                String type = connection.getContentType();
                if (type == null) type = mime == null ? "application/octet-stream" : mime;
                type = type.split(";")[0];
                // A redirect to the login page is not an issued document. HTML certificates are valid files.
                if (Uri.parse(target).getPath().startsWith("/user/login")) throw new java.io.IOException("Login expired");
                String name = URLUtil.guessFileName(target, connection.getHeaderField("Content-Disposition") == null ? disposition : connection.getHeaderField("Content-Disposition"), type);
                name = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
                if (name.length() > 150) name = name.substring(name.length() - 150);
                java.io.File directory = new java.io.File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "ssc-" + System.currentTimeMillis());
                if (!directory.mkdirs()) throw new java.io.IOException("Cannot create download directory");
                file = new java.io.File(directory, name);
                try (java.io.InputStream input = connection.getInputStream(); java.io.OutputStream output = new java.io.FileOutputStream(file)) {
                    byte[] buffer = new byte[16384]; int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                }
                Uri uri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
                String finalType = type;
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    Intent open = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, finalType).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try { startActivity(open); }
                    catch (android.content.ActivityNotFoundException e) {
                        Intent share = new Intent(Intent.ACTION_SEND).setType(finalType).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(share, tr("Сохранить документ", "Құжатты сақтау", "Save document")));
                    }
                });
            } catch (Exception e) {
                if (file != null) file.delete();
                runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) showError(); });
            } finally {
                if (connection != null) connection.disconnect();
                runOnUiThread(() -> downloading = false);
            }
        }, "ssc-document").start();
    }

    private void showError() {
        error.setText(tr("Не удалось загрузить страницу. Если вы уже нажали «Отправить», проверьте список заявок перед повторной отправкой.", "Бет жүктелмеді. Егер «Жіберу» басылса, қайта жібермес бұрын өтінімдер тізімін тексеріңіз.", "Page could not be loaded. If you already submitted, check your applications before sending again."));
        error.setVisibility(View.VISIBLE);
    }

    private void closePortal() {
        new AlertDialog.Builder(this).setMessage(tr("Закрыть форму? Незавершённые изменения могут не сохраниться.", "Пішінді жабу керек пе? Аяқталмаған өзгерістер сақталмауы мүмкін.", "Close the form? Unfinished changes may not be saved."))
            .setPositiveButton(tr("Закрыть", "Жабу", "Close"), (d,w) -> finish())
            .setNegativeButton(android.R.string.cancel, null).show();
    }

    @Override protected void onSaveInstanceState(Bundle state) { if (web != null) web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onDestroy() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (web != null) { if (web.getParent() instanceof ViewGroup) ((ViewGroup)web.getParent()).removeView(web); web.destroy(); }
        super.onDestroy();
    }
}

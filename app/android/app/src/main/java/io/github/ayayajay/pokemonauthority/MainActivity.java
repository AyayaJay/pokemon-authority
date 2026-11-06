package io.github.ayayajay.pokemonauthority;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Pokémon Authority — Android app.
 * Opens the game website in a full-screen WebView. Sprites / sounds / music are served from the app's files
 * folder (Android/data/io.github.ayayajay.pokemonauthority/files) when they are there; otherwise they are
 * downloaded and saved there. The game itself is kept in private storage so it also opens without internet.
 */
public class MainActivity extends Activity {
    static final String GAME_URL = "https://ayayajay.github.io/pokemon-authority/";
    static final String SITE_HOST = "ayayajay.github.io";
    static final String SITE_BASE = "/pokemon-authority/";
    static final String PR = "https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/";
    static final String[][] MAP = {   // same table as the PC app
            {"https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/", "pokemon/"},
            {"https://play.pokemonshowdown.com/sprites/", "pokemon-showdown/"},
            {"https://play.pokemonshowdown.com/fx/", "showdown-fx/"},
    };

    WebView web;
    File files, site;
    SharedPreferences prefs;
    ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("pa", MODE_PRIVATE);
        files = getExternalFilesDir(null);
        if (files == null) files = new File(getFilesDir(), "game-files");
        files.mkdirs();
        site = new File(getFilesDir(), "site");
        writeReadme();

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setBackgroundColor(0xFF151726);
        web.addJavascriptInterface(new Bridge(), "PAApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                fileCallback = cb;
                try { startActivityForResult(p.createIntent(), 7); } catch (Exception e) { fileCallback = null; return false; }
                return true;
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(GAME_URL);
        hideBars();
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) hideBars(); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); hideBars(); }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == 7 && fileCallback != null) { fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); fileCallback = null; return; }
        super.onActivityResult(req, res, data);
    }

    // Back button = Esc in the game (closes windows / pauses). Nothing to close -> leave the app in the background.
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){var o=[].slice.call(document.querySelectorAll('.overlay')).filter(function(x){return x._esc});"
                + "if(o.length){o[o.length-1]._esc();return 'closed'}"
                + "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));"
                + "return (window.battle&&!battle.over&&document.body.classList.contains('inbattle'))||(window.OW&&OW.active)?'esc':'none'})()",
                r -> { if (r != null && r.contains("none")) moveTaskToBack(true); });
    }

    void hideBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    // ---------- files ----------
    File localPath(String url) {
        String rel = null;
        for (String[] m : MAP) if (url.startsWith(m[0])) { rel = m[1] + url.substring(m[0].length()); break; }
        if (rel == null && url.startsWith(PR)) {
            String rest = url.substring(PR.length());
            int i = rest.indexOf('/'); rest = i >= 0 ? rest.substring(i + 1) : rest;
            if (rest.startsWith("audio/bgm/")) rel = "music/" + rest.substring(10);
            else if (rest.startsWith("audio/")) rel = "sounds/" + rest.substring(6);
            else if (rest.startsWith("images/")) rel = "move-animations/" + rest.substring(7);
            else rel = "pokerogue/" + rest;
        }
        if (rel == null) return null;
        int q = rel.indexOf('?'); if (q >= 0) rel = rel.substring(0, q);
        q = rel.indexOf('#'); if (q >= 0) rel = rel.substring(0, q);
        try { rel = URLDecoder.decode(rel.replace("+", "%2B"), "UTF-8"); } catch (Exception e) { return null; }
        if (rel.contains("..")) return null;
        return new File(files, rel);
    }

    static String mime(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".gif")) return "image/gif";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".m4a")) return "audio/mp4";
        if (n.endsWith(".wav")) return "audio/wav";
        if (n.endsWith(".ogg")) return "audio/ogg";
        if (n.endsWith(".xml")) return "text/xml";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".html") || n.endsWith("/")) return "text/html";
        if (n.endsWith(".js")) return "text/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    static Map<String, String> cors() { Map<String, String> h = new HashMap<>(); h.put("Access-Control-Allow-Origin", "*"); h.put("Cache-Control", "no-cache"); return h; }

    static WebResourceResponse resp(String mime, InputStream in, int code, String reason) {
        String enc = mime.startsWith("text/") || mime.endsWith("json") ? "utf-8" : null;
        return new WebResourceResponse(mime, enc, code, reason, cors(), in);
    }

    static byte[] download(String url, int[] status) throws Exception { return download(url, status, null); }

    /** etagFile: if given, ask the server "has it changed?" and only download when it has (status 304 = not changed). */
    static byte[] download(String url, int[] status, File etagFile) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(etagFile != null || url.contains(SITE_HOST) ? 4000 : 8000); c.setReadTimeout(30000); c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "PokemonAuthorityApp");
        c.setUseCaches(false);
        if (etagFile != null && etagFile.exists()) {
            try { byte[] e = readAll(new FileInputStream(etagFile)); c.setRequestProperty("If-None-Match", new String(e, "UTF-8").trim()); } catch (Exception e) { }
        }
        try {
            status[0] = c.getResponseCode();
            if (status[0] != 200) return null;
            String tag = c.getHeaderField("ETag");
            if (etagFile != null && tag != null) writeFile(etagFile, tag.getBytes("UTF-8"));
            InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n); in.close();
            return out.toByteArray();
        } finally { c.disconnect(); }
    }

    static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n); in.close(); return out.toByteArray();
    }

    static void writeFile(File f, byte[] data) {
        try { f.getParentFile().mkdirs(); File tmp = new File(f.getPath() + ".part"); FileOutputStream o = new FileOutputStream(tmp); o.write(data); o.close(); tmp.renameTo(f); } catch (Exception e) { }
    }

    class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            if (!"GET".equalsIgnoreCase(r.getMethod())) return null;
            String url = r.getUrl().toString();
            String host = r.getUrl().getHost();
            if (host == null) return null;
            // the game website: newest from the internet, saved copy when offline
            if (host.equals(SITE_HOST)) {
                String p = r.getUrl().getPath(); if (p == null) p = "/";
                p = p.startsWith(SITE_BASE) ? p.substring(SITE_BASE.length()) : p.substring(1);
                if (p.isEmpty() || p.endsWith("/")) p = p + "index.html";
                if (p.contains("..")) return null;
                File lf = new File(site, p), tag = new File(site, p + ".etag");
                int[] st = {0};
                try {
                    String clean = url; int q = clean.indexOf('?'); if (q >= 0 && !lf.exists()) tag.delete();
                    byte[] d = download(url, st, lf.exists() ? tag : null);
                    if (d != null) { writeFile(lf, d); return resp(mime(p), new ByteArrayInputStream(d), 200, "OK"); }
                } catch (Exception e) { }
                try { if (lf.exists()) return resp(mime(p), new FileInputStream(lf), 200, "OK"); } catch (Exception e) { }
                try { return resp(mime(p), getAssets().open("site/" + p), 200, "OK"); } catch (Exception e) { }   // copy that came inside the APK
                return st[0] != 0 ? resp("text/plain", new ByteArrayInputStream(new byte[0]), st[0], "Error") : null;
            }
            // sprites / sounds / music: the file in the folder first, otherwise download (and save)
            if (host.equals("raw.githubusercontent.com") || host.equals("play.pokemonshowdown.com")) {
                File lf = localPath(url);
                if (lf == null) return null;
                try { if (lf.exists()) return resp(mime(lf.getName()), new FileInputStream(lf), 200, "OK"); } catch (Exception e) { }
                int[] st = {0};
                try {
                    String clean = url; int q = clean.indexOf('?'); if (q >= 0) clean = clean.substring(0, q);
                    byte[] d = download(clean, st);
                    if (d != null) {
                        if (prefs.getBoolean("saving", true)) writeFile(lf, d);
                        return resp(mime(lf.getName()), new ByteArrayInputStream(d), 200, "OK");
                    }
                } catch (Exception e) { st[0] = 503; }
                int code = st[0] == 0 ? 503 : st[0];
                return resp("text/plain", new ByteArrayInputStream(new byte[0]), code, code == 404 ? "Not Found" : "Unavailable");
            }
            return null;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            String host = r.getUrl().getHost();
            if (host != null && host.equals(SITE_HOST)) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception e) { }
            return true;
        }
    }

    // ---------- window.PAApp for the game ----------
    class Bridge {
        @JavascriptInterface public String platform() { return "android"; }
        @JavascriptInterface public String folder() { return files.getAbsolutePath(); }
        @JavascriptInterface public boolean getSaving() { return prefs.getBoolean("saving", true); }
        @JavascriptInterface public boolean setSaving(boolean v) { prefs.edit().putBoolean("saving", v).apply(); return true; }
        @JavascriptInterface public double filesBytes() { return size(files); }
        @JavascriptInterface public boolean clearFiles() {
            File[] l = files.listFiles(); if (l != null) for (File f : l) if (!f.getName().equals("saves") && !f.getName().equals("README.txt")) delete(f);
            return true;
        }
        @JavascriptInterface public String saveFile(String name, String text) {
            File d = new File(files, "saves"); d.mkdirs();
            File f = new File(d, new File(name).getName());
            try { writeFile(f, text.getBytes("UTF-8")); } catch (Exception e) { return null; }
            return f.getAbsolutePath();
        }
        @JavascriptInterface public boolean openFolder() { return false; }
    }

    static long size(File f) { if (f.isFile()) return f.length(); long n = 0; File[] l = f.listFiles(); if (l != null) for (File c : l) n += size(c); return n; }
    static void delete(File f) { File[] l = f.listFiles(); if (l != null) for (File c : l) delete(c); f.delete(); }

    void writeReadme() {
        File r = new File(files, "README.txt");
        if (r.exists()) return;
        String t = "Pokémon Authority game files\n\npokemon/  - Pokémon sprites and portraits\nmusic/    - background music (MP3)\nsounds/   - sound effects and cries\nmove-animations/ - move effect pictures\n\n"
                + "To use your own sprite or music, replace a file with one of the SAME name and type.\n"
                + "Delete a file (or use \"Delete downloaded files\" in the game) to get the original back.\nSaves you export are written to saves/.\n";
        try { writeFile(r, t.getBytes("UTF-8")); } catch (Exception e) { }
    }
}

package io.github.univerclient;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // фоновый сервис включает/выключает backend.js через этот плагин (настройка «Уведомления»)
        registerPlugin(KeepAlivePlugin.class);
        registerPlugin(ServicePortalPlugin.class);
        registerPlugin(TactilePlugin.class); // тактильный отклик интерфейса
        registerPlugin(BiometricPlugin.class); // вход по отпечатку или лицу
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        // не даём WebView останавливать таймеры JS в фоне
        if (bridge != null && bridge.getWebView() != null) bridge.getWebView().resumeTimers();
    }
}

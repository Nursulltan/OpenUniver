package io.github.univerclient;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ServicePortal")
public class ServicePortalPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "");
        if (!ServicePortalActivity.isServiceUrl(url)) {
            call.reject("Недопустимый адрес услуги");
            return;
        }
        Intent intent = new Intent(getActivity(), ServicePortalActivity.class);
        intent.putExtra("url", url);
        intent.putExtra("title", call.getString("title", "e-услуги"));
        intent.putExtra("lang", call.getString("lang", "ru"));
        startActivityForResult(call, intent, "portalClosed");
    }

    @ActivityCallback
    private void portalClosed(PluginCall call, ActivityResult result) {
        // Closing is not evidence of a successful submission; the caller reloads server statuses.
        if (call != null) call.resolve();
    }
}

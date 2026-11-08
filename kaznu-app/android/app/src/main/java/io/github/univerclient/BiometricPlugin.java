package io.github.univerclient;

import android.view.WindowManager;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Вход в приложение по отпечатку пальца или лицу — через системное окно Android (BiometricPrompt).
// Сами отпечатки и лицо приложение не видит: система лишь сообщает «да» или «нет».
// BIOMETRIC_WEAK включает и разблокировку лицом, которая на многих телефонах относится к «слабым» датчикам.
@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {
    private static final int AUTH = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void available(PluginCall call) {
        int r = BiometricManager.from(getContext()).canAuthenticate(AUTH);
        JSObject o = new JSObject();
        o.put("available", r == BiometricManager.BIOMETRIC_SUCCESS);
        // нет ни одного отпечатка/лица в настройках телефона
        o.put("enrolled", r != BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED);
        o.put("hardware", r != BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE && r != BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE);
        call.resolve(o);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Open Univer");
        String subtitle = call.getString("subtitle", "");
        String cancel = call.getString("cancel", "Cancel");
        FragmentActivity act = getActivity();
        act.runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(act, ContextCompat.getMainExecutor(act), new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    call.resolve();
                }
                @Override
                public void onAuthenticationError(int code, @NonNull CharSequence msg) {
                    // отмена, «ввести код», слишком много попыток — интерфейс просто покажет ввод кода
                    call.reject(msg.toString(), String.valueOf(code));
                }
                // onAuthenticationFailed (палец не тот) — окно само просит попробовать ещё раз
            });
            BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setNegativeButtonText(cancel)
                .setAllowedAuthenticators(AUTH)
                .setConfirmationRequired(false); // лицо: входить сразу, без лишнего нажатия
            if (!subtitle.isEmpty()) info.setSubtitle(subtitle);
            try {
                prompt.authenticate(info.build());
            } catch (Exception e) {
                call.reject(e.getMessage(), "start");
            }
        });
    }

    // скрывать содержимое приложения в списке недавних и на снимках экрана (когда включена защита)
    @PluginMethod
    public void setSecure(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}

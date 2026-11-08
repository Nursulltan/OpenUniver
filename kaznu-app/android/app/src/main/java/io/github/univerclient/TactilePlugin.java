package io.github.univerclient;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Тактильный отклик интерфейса. Вместо длинного «бз-з» обычного вибромотора используем короткие
// системные примитивы Android (щелчок, тик, мягкий тик, удар) — те же, что у клавиатуры и системных
// переключателей. У каждого действия свой рисунок и своя сила; общая сила умножается на настройку.
@CapacitorPlugin(name = "Tactile")
public class TactilePlugin extends Plugin {
    // шаг рисунка: примитив, сила 0..1, пауза перед ним (мс)
    private static final class Step {
        final int prim; final float scale; final int delay;
        Step(int prim, float scale, int delay) { this.prim = prim; this.scale = scale; this.delay = delay; }
    }
    // условные примитивы (сопоставляются с системными ниже)
    private static final int TICK = 1, LOW_TICK = 2, CLICK = 3, THUD = 4, QUICK_FALL = 5;

    private static Step[] pattern(String kind) {
        switch (kind) {
            case "page":    return new Step[] { new Step(LOW_TICK, 0.55f, 0) };            // перелистнул день/месяц/вкладку оценок
            case "nav":     return new Step[] { new Step(TICK, 0.30f, 0) };                 // нижнее меню
            case "back":    return new Step[] { new Step(LOW_TICK, 0.45f, 0) };             // свайп «назад» сработал
            case "edge":    return new Step[] { new Step(TICK, 0.60f, 0) };                 // дотянул до порога (обновление)
            case "select":  return new Step[] { new Step(CLICK, 0.30f, 0) };                // отметил/снял файл
            case "toggle":  return new Step[] { new Step(TICK, 0.40f, 0) };                 // переключатель, выбор в настройках
            case "hold":    return new Step[] { new Step(CLICK, 0.75f, 0) };                // долгое нажатие
            case "success": return new Step[] { new Step(CLICK, 0.35f, 0), new Step(CLICK, 0.70f, 70) };
            case "delete":  return new Step[] { new Step(QUICK_FALL, 0.60f, 0), new Step(LOW_TICK, 0.50f, 40) };
            case "error":   return new Step[] { new Step(THUD, 0.75f, 0), new Step(THUD, 0.75f, 110) };
            default:        return new Step[] { new Step(TICK, 0.40f, 0) };
        }
    }

    private Vibrator vibrator() {
        Context c = getContext();
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) c.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        }
        return (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
    }

    private static int sysPrim(int p) {
        if (Build.VERSION.SDK_INT >= 31) {
            if (p == LOW_TICK) return VibrationEffect.Composition.PRIMITIVE_LOW_TICK;
            if (p == THUD) return VibrationEffect.Composition.PRIMITIVE_THUD;
            if (p == QUICK_FALL) return VibrationEffect.Composition.PRIMITIVE_QUICK_FALL;
        }
        if (p == CLICK || p == THUD) return VibrationEffect.Composition.PRIMITIVE_CLICK;
        return VibrationEffect.Composition.PRIMITIVE_TICK;
    }

    @PluginMethod
    public void play(PluginCall call) {
        String kind = call.getString("kind", "toggle");
        float level = call.getFloat("level", 0.75f); // 0 — выкл, 0.45 слабая, 0.75 обычная, 1.15 сильная
        call.resolve();
        if (level <= 0) return;
        getActivity().runOnUiThread(() -> {
            try { perform(pattern(kind), level); } catch (Exception ignored) { }
        });
    }

    @PluginMethod
    public void info(PluginCall call) {
        Vibrator v = vibrator();
        JSObject r = new JSObject();
        r.put("hasVibrator", v != null && v.hasVibrator());
        r.put("primitives", Build.VERSION.SDK_INT >= 30 && v != null && v.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK, VibrationEffect.Composition.PRIMITIVE_TICK));
        call.resolve(r);
    }

    private void perform(Step[] steps, float level) {
        Vibrator v = vibrator();
        if (v == null || !v.hasVibrator()) { fallbackView(steps); return; }
        // 1) Android 11+: композиция системных примитивов — короткие чёткие щелчки с регулируемой силой
        if (Build.VERSION.SDK_INT >= 30) {
            int[] prims = new int[steps.length];
            for (int i = 0; i < steps.length; i++) prims[i] = sysPrim(steps[i].prim);
            if (v.areAllPrimitivesSupported(prims)) {
                VibrationEffect.Composition comp = VibrationEffect.startComposition();
                for (int i = 0; i < steps.length; i++) comp.addPrimitive(prims[i], Math.max(0.05f, Math.min(1f, steps[i].scale * level)), steps[i].delay);
                v.vibrate(comp.compose());
                return;
            }
        }
        // 2) Android 8+ с регулировкой силы мотора: очень короткие импульсы малой амплитуды
        if (Build.VERSION.SDK_INT >= 26 && v.hasAmplitudeControl()) {
            int n = steps.length * 2;
            long[] timings = new long[n]; int[] amps = new int[n];
            for (int i = 0; i < steps.length; i++) {
                Step s = steps[i];
                timings[i * 2] = s.delay; amps[i * 2] = 0;
                timings[i * 2 + 1] = s.prim == TICK || s.prim == LOW_TICK ? 7 : s.prim == CLICK ? 11 : 16;
                amps[i * 2 + 1] = Math.max(1, Math.min(255, Math.round(255 * s.scale * level)));
            }
            v.vibrate(VibrationEffect.createWaveform(timings, amps, -1));
            return;
        }
        // 3) Android 10: готовые системные эффекты
        if (Build.VERSION.SDK_INT >= 29) {
            Step s = steps[steps.length - 1];
            int eff = steps.length > 1 ? VibrationEffect.EFFECT_DOUBLE_CLICK
                : s.prim == TICK || s.prim == LOW_TICK || level < 0.5f ? VibrationEffect.EFFECT_TICK
                : s.prim == THUD ? VibrationEffect.EFFECT_HEAVY_CLICK : VibrationEffect.EFFECT_CLICK;
            v.vibrate(VibrationEffect.createPredefined(eff));
            return;
        }
        // 4) старые телефоны: системный отклик экрана
        fallbackView(steps);
    }

    private void fallbackView(Step[] steps) {
        View view = getBridge().getWebView();
        if (view == null) return;
        Step s = steps[steps.length - 1];
        int c = s.prim == CLICK || s.prim == THUD ? HapticFeedbackConstants.KEYBOARD_TAP : HapticFeedbackConstants.CLOCK_TICK;
        view.performHapticFeedback(c, HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING);
    }
}

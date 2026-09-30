package com.lopesleo.guardiao;

import android.os.SystemClock;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Relógio que o jogador NÃO consegue mexer: tempo desde que o aparelho ligou
// (conta também o tempo dormindo) + quantas vezes o aparelho já ligou.
// O jogo (src/systems/Clock.js) usa para saber quanto tempo passou DE VERDADE
// entre uma sessão e outra, mesmo sem internet e mesmo com a hora alterada.
@CapacitorPlugin(name = "ElapsedClock")
public class ElapsedClockPlugin extends Plugin {
    @PluginMethod
    public void now(PluginCall call) {
        JSObject r = new JSObject();
        r.put("elapsed", SystemClock.elapsedRealtime());
        int boot = -1;
        try {
            boot = Settings.Global.getInt(getContext().getContentResolver(), Settings.Global.BOOT_COUNT);
        } catch (Exception ignored) {
        }
        r.put("boot", boot);
        call.resolve(r);
    }
}

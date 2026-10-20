package com.lopesleo.guardiao;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Abre a tela de notificações do jogo nas configurações do Android (com "channel": só a daquele canal). O jogo
// (src/systems/NotifyAccess.js) usa quando o Android não mostra mais o pedido de permissão (o jogador recusou
// duas vezes) ou quando o canal foi desligado no sistema: ligar a chave em Opções leva direto para lá.
@CapacitorPlugin(name = "NotificationSettings")
public class NotificationSettingsPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String pkg = getContext().getPackageName();
        String channel = call.getString("channel");
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(channel != null ? Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS : Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
            if (channel != null) i.putExtra(Settings.EXTRA_CHANNEL_ID, channel);
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", pkg, null));
        }
        try {
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("sem_tela", e);
        }
    }
}

package com.lopesleo.guardiao;

import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

import java.nio.charset.StandardCharsets;

// Progresso na nuvem pelo Google Play Games (Saved Games, API v2).
// O save fica na conta Google do jogador (pasta oculta do app no Drive dele), e
// volta ao reinstalar ou trocar de celular. A DECISÃO de qual save vale (nuvem ou
// aparelho) é do jogo (src/systems/CloudSave.js); aqui só lemos e gravamos.
//
// Sem o ID do projeto do Play Games (res/values/games-ids.xml, vem da Play Console)
// o plugin fica DESLIGADO: não inicializa o SDK e responde configured=false.
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {
    // Conflitos do próprio Play Games (dois aparelhos gravando sem internet): fica o
    // de maior progresso declarado (setProgressValue = partidas jogadas)
    private static final int POLICY = SnapshotsClient.RESOLUTION_POLICY_HIGHEST_PROGRESS;
    private static final int MAX_RESOLVE = 5;
    private boolean configured = false;

    @Override
    public void load() {
        int id = getContext().getResources().getIdentifier("game_services_project_id", "string", getContext().getPackageName());
        String value = id != 0 ? getContext().getString(id).trim() : "";
        configured = !TextUtils.isEmpty(value) && TextUtils.isDigitsOnly(value);
        if (configured) PlayGamesSdk.initialize(getContext());
    }

    // { configured, authenticated } — o Play Games tenta entrar sozinho ao abrir o app
    @PluginMethod
    public void status(PluginCall call) {
        if (!configured) {
            resolveAuth(call, false);
            return;
        }
        PlayGames.getGamesSignInClient(getActivity()).isAuthenticated()
            .addOnCompleteListener(t -> resolveAuth(call, t.isSuccessful() && t.getResult().isAuthenticated()));
    }

    // Entrada manual (botão em Opções), quando a automática não aconteceu
    @PluginMethod
    public void signIn(PluginCall call) {
        if (!configured) {
            resolveAuth(call, false);
            return;
        }
        PlayGames.getGamesSignInClient(getActivity()).signIn()
            .addOnCompleteListener(t -> resolveAuth(call, t.isSuccessful() && t.getResult().isAuthenticated()));
    }

    // { data: texto do save ou null se o espaço ainda está vazio, modified: ms }
    @PluginMethod
    public void read(PluginCall call) {
        String slot = call.getString("slot");
        if (!ready(call, slot)) return;
        SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
        open(client, slot)
            .addOnSuccessListener(snap -> {
                try {
                    byte[] bytes = snap.getSnapshotContents().readFully();
                    JSObject r = new JSObject();
                    r.put("data", bytes == null || bytes.length == 0 ? JSObject.NULL : new String(bytes, StandardCharsets.UTF_8));
                    r.put("modified", snap.getMetadata().getLastModifiedTimestamp());
                    client.discardAndClose(snap);
                    call.resolve(r);
                } catch (Exception e) {
                    client.discardAndClose(snap);
                    call.reject("read_failed", e);
                }
            })
            .addOnFailureListener(e -> call.reject("open_failed", e));
    }

    // Grava { slot, data, description, progress } por cima do que estiver na nuvem
    @PluginMethod
    public void write(PluginCall call) {
        String slot = call.getString("slot");
        String data = call.getString("data");
        if (!ready(call, slot)) return;
        if (data == null) {
            call.reject("no_data");
            return;
        }
        SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
        SnapshotMetadataChange.Builder meta = new SnapshotMetadataChange.Builder()
            .setDescription(call.getString("description", ""));
        Long progress = call.getLong("progress");
        if (progress != null) meta.setProgressValue(progress);
        open(client, slot)
            .continueWithTask(t -> {
                Snapshot snap = t.getResult();
                snap.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
                return client.commitAndClose(snap, meta.build());
            })
            .addOnSuccessListener(m -> {
                JSObject r = new JSObject();
                r.put("modified", m.getLastModifiedTimestamp());
                call.resolve(r);
            })
            .addOnFailureListener(e -> call.reject("save_failed", e));
    }

    private boolean ready(PluginCall call, String slot) {
        if (!configured) {
            call.reject("not_configured");
            return false;
        }
        if (TextUtils.isEmpty(slot)) {
            call.reject("no_slot");
            return false;
        }
        return true;
    }

    // Abre (ou cria) o espaço do save, resolvendo conflitos do Play Games pela política
    private Task<Snapshot> open(SnapshotsClient client, String slot) {
        return client.open(slot, true, POLICY).continueWithTask(t -> resolve(client, t.getResult(), 0));
    }

    private Task<Snapshot> resolve(SnapshotsClient client, SnapshotsClient.DataOrConflict<Snapshot> r, int tries) {
        if (!r.isConflict()) return Tasks.forResult(r.getData());
        if (tries >= MAX_RESOLVE) return Tasks.forException(new Exception("conflict_unresolved"));
        SnapshotsClient.SnapshotConflict c = r.getConflict();
        Snapshot a = c.getSnapshot(), b = c.getConflictingSnapshot();
        Snapshot keep = b.getMetadata().getProgressValue() > a.getMetadata().getProgressValue() ? b : a;
        return client.resolveConflict(c.getConflictId(), keep).continueWithTask(t -> resolve(client, t.getResult(), tries + 1));
    }

    private void resolveAuth(PluginCall call, boolean authenticated) {
        JSObject r = new JSObject();
        r.put("configured", configured);
        r.put("authenticated", authenticated);
        call.resolve(r);
    }
}

package com.lopesleo.guardiao;

import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.games.LeaderboardsClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.leaderboard.LeaderboardScore;
import com.google.android.gms.games.leaderboard.LeaderboardScoreBuffer;
import com.google.android.gms.games.leaderboard.LeaderboardVariant;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

import java.nio.charset.StandardCharsets;

// Progresso na nuvem pelo Google Play Games (Saved Games, API v2) e os rankings (Leaderboards).
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

    // Entrada manual (Opções, ranking ou o pedido da 1ª abertura), quando a automática não aconteceu.
    // error=true: a entrada falhou (rede, credencial ainda ativando), não foi o jogador que recusou
    @PluginMethod
    public void signIn(PluginCall call) {
        if (!configured) {
            resolveAuth(call, false);
            return;
        }
        PlayGames.getGamesSignInClient(getActivity()).signIn()
            .addOnCompleteListener(t -> {
                JSObject r = new JSObject();
                r.put("configured", true);
                r.put("authenticated", t.isSuccessful() && t.getResult().isAuthenticated());
                r.put("error", !t.isSuccessful());
                call.resolve(r);
            });
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

    // ---- Rankings (Leaderboards, API v2; o jogo decide o que e quando enviar: src/systems/Leaderboards.js) ----

    // Envia { leaderboardId, score } e espera o Play Games confirmar. Sem internet ou sem login falha, e o jogo
    // guarda na fila. O Play Games fica só com o melhor de cada jogador em cada período (dia, semana, sempre).
    @PluginMethod
    public void submitScore(PluginCall call) {
        String id = call.getString("leaderboardId");
        Long score = call.getLong("score");
        if (!ready(call, id)) return;
        if (score == null || score < 0) {
            call.reject("no_score");
            return;
        }
        PlayGames.getLeaderboardsClient(getActivity()).submitScoreImmediate(id, score)
            .addOnSuccessListener(r -> call.resolve())
            .addOnFailureListener(e -> call.reject("submit_failed", code(e), e));
    }

    // Os primeiros { leaderboardId, span: "week" | "all", max } do ranking público. Volta { scores: [{ rank,
    // name, score, me }], player: { rank, score } | null (a posição do jogador no período, mesmo fora da lista;
    // rank -1 quando o Play Games não diz), total }. Sempre do servidor: a cópia guardada no aparelho não vê a
    // partida que acabou de subir (quem guarda por 1 min é o jogo)
    @PluginMethod
    public void loadScores(PluginCall call) {
        String id = call.getString("leaderboardId");
        if (!ready(call, id)) return;
        int span = "all".equals(call.getString("span")) ? LeaderboardVariant.TIME_SPAN_ALL_TIME : LeaderboardVariant.TIME_SPAN_WEEKLY;
        int max = Math.max(1, Math.min(25, call.getInt("max", 10)));
        LeaderboardsClient client = PlayGames.getLeaderboardsClient(getActivity());
        String[] me = { null };
        PlayGames.getPlayersClient(getActivity()).getCurrentPlayerId()
            .continueWithTask(t -> {
                me[0] = t.isSuccessful() ? t.getResult() : null;
                return client.loadTopScores(id, span, LeaderboardVariant.COLLECTION_PUBLIC, max, true);
            })
            .addOnSuccessListener(data -> {
                LeaderboardsClient.LeaderboardScores res = data.get();
                JSObject r = new JSObject();
                boolean[] hasPlayer = { false };
                try {
                    JSArray list = new JSArray();
                    LeaderboardScoreBuffer buf = res.getScores();
                    for (int i = 0; i < buf.getCount(); i++) {
                        LeaderboardScore s = buf.get(i);
                        JSObject o = new JSObject();
                        o.put("rank", s.getRank());
                        o.put("name", s.getScoreHolderDisplayName());
                        o.put("score", s.getRawScore());
                        o.put("me", me[0] != null && s.getScoreHolder() != null && me[0].equals(s.getScoreHolder().getPlayerId()));
                        list.put(o);
                    }
                    r.put("scores", list);
                    r.put("player", JSObject.NULL);
                    r.put("total", -1);
                    for (LeaderboardVariant v : res.getLeaderboard().getVariants()) {
                        if (v.getTimeSpan() != span || v.getCollection() != LeaderboardVariant.COLLECTION_PUBLIC) continue;
                        r.put("total", v.getNumScores());
                        if (v.hasPlayerInfo() && v.getPlayerRank() != LeaderboardVariant.PLAYER_RANK_UNKNOWN) {
                            JSObject p = new JSObject();
                            p.put("rank", v.getPlayerRank());
                            p.put("score", v.getRawPlayerScore());
                            r.put("player", p);
                            hasPlayer[0] = true;
                        }
                    }
                } finally {
                    res.release();
                }
                if (hasPlayer[0]) {
                    call.resolve(r);
                    return;
                }
                // A lista não trouxe o jogador (fora dela sem posição, ou o perfil dele não aparece no ranking
                // público): pergunta a pontuação dele direto, para a janela mostrar a linha "Você"
                client.loadCurrentPlayerLeaderboardScore(id, span, LeaderboardVariant.COLLECTION_PUBLIC)
                    .addOnCompleteListener(t -> {
                        LeaderboardScore s = t.isSuccessful() && t.getResult() != null ? t.getResult().get() : null;
                        if (s != null) {
                            JSObject p = new JSObject();
                            p.put("rank", s.getRank());
                            p.put("score", s.getRawScore());
                            r.put("player", p);
                        }
                        call.resolve(r);
                    });
            })
            .addOnFailureListener(e -> call.reject("load_failed", code(e), e));
    }

    // O código do Play Games (ApiException) num erro, para o jogo mostrar e o Analytics contar; null se não tiver
    private static String code(Exception e) {
        Throwable c = e;
        while (c != null && !(c instanceof ApiException)) c = c.getCause();
        return c != null ? String.valueOf(((ApiException) c).getStatusCode()) : null;
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

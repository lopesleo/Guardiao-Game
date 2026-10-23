package com.lopesleo.guardiao;

import android.os.Bundle;
import android.view.WindowManager;

import androidx.activity.EdgeToEdge;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

// Jogo em tela cheia imersiva (sem barra de status/navegação) e com a tela
// sempre ligada enquanto o app está aberto. De ponta a ponta em todas as versões do
// Android (o 15+ obriga; EdgeToEdge.enable faz o mesmo nas anteriores): o cenário vai
// até a borda, por baixo do furo da câmera, e a interface já fica longe das bordas.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local: relógio desde que o aparelho ligou (anti-trapaça de hora)
        registerPlugin(ElapsedClockPlugin.class);
        // Plugin local: progresso na nuvem pelo Play Games
        registerPlugin(PlayGamesPlugin.class);
        // Plugin local: abrir as configurações de notificação do jogo no Android
        registerPlugin(NotificationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}

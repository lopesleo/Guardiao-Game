# Smoke Test Manual — Checklist do Dia 4

Executar antes de gerar o `.zip`. ~30 minutos. Marca tudo verde antes de declarar pronto.

> Mínimo aceitável: 14 de 15 itens passando (1 falha tolerada se não-crítica).

## 1. Boot & Pipeline
- [ ] Abrir <http://localhost:8000> → splash some, MenuScene aparece em < 5s
- [ ] Botão `JOGAR` leva ao gameplay
- [ ] Botão `CRÉDITOS` mostra a tela; voltar funciona

## 2. Gameplay desktop
- [ ] WASD movimenta o player em 8 direções
- [ ] Auto-attack dispara contra o inimigo mais próximo
- [ ] Tomar dano reduz HP visível no HUD
- [ ] Coletar gema XP enche a barra; level-up abre cartas
- [ ] Escolher uma carta retoma o jogo

## 3. Reações elementais (DIFERENCIAL)
- [ ] Aplicar Fogo + Gelo no mesmo inimigo → texto "VAPOR!" aparece
- [ ] Aplicar Gelo + Raio → texto "CRISTAL!" + anel visual
- [ ] Aplicar Fogo + Raio → texto "SOBRECARGA!" + corrente entre inimigos
- [ ] Reações **somem** após acionar (não disparam continuamente)

## 4. Boss
- [ ] Aos 7 minutos o boss spawna com aviso visual
- [ ] Boss tem 2 fases distinguíveis
- [ ] Derrotar boss → tela de vitória com moedas bônus

## 5. Meta-progressão
- [ ] Moedas persistem entre runs (recarregar página, valor mantém)
- [ ] Desbloquear arma → próxima run oferece nas cartas
- [ ] Modo privado: toast avisa "progresso não será salvo"

## 6. Mobile
- [ ] Em portrait: overlay "gire o dispositivo" cobre tudo
- [ ] Em landscape: joystick virtual responde no canto inferior esquerdo
- [ ] Touch funciona suave (sem lag perceptível)
- [ ] Áudio toca após primeiro toque

## 7. Performance
- [ ] Em wave 10+ (densidade alta) o jogo mantém ≥ 45 fps em desktop comum
- [ ] Sem leaks: rodar 10 min e checar que não há crescimento descontrolado de objetos

## 8. Recuperação
- [ ] Recarregar a página durante a run não quebra nada
- [ ] Fechar/reabrir aba mantém desbloqueios

---

## Bugs encontrados (preencher durante o teste)

| # | Severidade | Descrição | Status |
|---|---|---|---|
|   |   |   |   |

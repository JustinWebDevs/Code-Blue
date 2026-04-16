# Code Blue — Documento de Concepto

## Concepto base
Un doctor usa un desfibrilador para mantener el ritmo cardíaco de un paciente 
sincronizado con un beat. La pantalla principal es un monitor cardíaco estilo 
ECG/EKG hospitalario.

---

## Visual principal
- Fondo negro con línea de ECG verde fosforescente (estilo monitor hospitalario retro)
- La línea se desplaza de derecha a izquierda continuamente
- Estado base: línea plana en el centro
- La línea tiene física con inercia: sube/baja suavemente y vuelve al centro 
  por gravedad cuando no hay input

---

## Controles
- [A] → La línea sube (deflexión positiva)
- [D] → La línea baja (deflexión negativa)
- [Espacio] → Congela la línea en su posición actual momentáneamente
- Sin input → la línea vuelve al centro lentamente

---

## Mecánica de ritmo
- Un beat define una secuencia de pulsos objetivo (definidos en un beatmap JSON)
- Cada pulso tiene un momento exacto y una zona objetivo: ARRIBA, CENTRO o ABAJO
- Una línea guía translúcida con un indicador de acercamiento muestra DÓNDE debe 
  estar la línea y CUÁNDO llega el beat
- Al llegar el beat se evalúa la precisión:
    - PERFECT (±40ms, zona correcta) → beep satisfactorio, +300 pts
    - GOOD    (±90ms, zona correcta) → beep leve,         +100 pts
    - MISS    (fuera de ventana)     → sin beep, acumula caos

---

## Sistema de caos progresivo (mecánica clave)
- Cada fallo acumula "inestabilidad cardíaca" (0–100):
  - STABLE   (0–19%)  : línea normal
  - UNEASY  (20–49%)  : línea tiembla levemente (±2px de ruido)
  - DANGER  (50–74%)  : interferencia visual, glitches horizontales (±5px)
  - CRITICAL(75–99%)  : fibrilación severa (±12px), pantalla con tinte rojo, 
                         aberración cromática
  - FLATLINE (100%)   : línea plana, alarma continua, pantalla roja parpadeante
- FLATLINE → Game Over con certificado clínico:
    "TIME OF DEATH: HH:MM:SS"
    "PATIENT: [nombre]"
    "CAUSE: CARDIAC ARREST"
- Los aciertos reducen el caos gradualmente

---

## Sistema de audio / beatmaps
- La música se importa como MP3 o similar
- El beatmap es un archivo JSON paralelo que define los beats con tiempo absoluto (ms):
  ```json
  {
    "version": "1.0.0",
    "meta": { "title": "...", "bpm": 128, "offset": 250, "audioFile": "track.mp3" },
    "beats": [
      { "id": "b01", "timeMs": 1000, "zone": "UP", "intensity": 1.0, "holdMs": 0 }
    ],
    "events": []
  }
  ```
- El timing se obtiene SIEMPRE de la posición de audio (Howler.js), nunca de Date.now()
- Futuro: generación automática de beatmaps desde análisis de audio (Meyda.js)

---

## Estética
- UI estilo monitor hospitalario: verde #00ff88 sobre negro, tipografía monospace
- HUD: BPM parpadeante al ritmo, nombre del paciente, barra de estabilidad verde→rojo,
  combo, score, indicador de nivel de caos
- Línea ECG con efecto triple-glow (fosforescente)
- Sonidos procedurales via Web Audio API: beeps de monitor, alarmas, flatline
- Game Over: certificado clínico con estadísticas completas

---

## Stack tecnológico
- **Vite** — bundler y dev server (HMR)
- **Phaser 3** — motor de juego 2D (escenas, loop, input, rendering)
- **Howler.js** — audio con timing preciso para ritmo
- **Futuro**: Meyda.js para análisis automático de audio

---

## Escalabilidad planificada
| Feature futura          | Cómo está preparado                                          |
|-------------------------|--------------------------------------------------------------|
| Auto-beatmap (Meyda)    | BeatmapSystem acepta cualquier array de beats con el schema |
| Biblioteca online       | BeatmapRepository tiene interfaz Local/Remote intercambiable|
| BPM variable            | timing.segments[] ya soporta cambios de BPM por tramo       |
| Notas sostenidas (hold) | Campo holdMs ya está en el schema                           |
| Multijugador            | InputSystem emite eventos → NetworkAdapter los reenvía       |
| Nuevos escenarios       | La estética es una skin — el sistema es agnóstico al tema    |

---

## Arquitectura de archivos (MVP)
```
src/
  main.js
  config/Constants.js       ← todos los valores tuneables
  config/GameConfig.js
  scenes/BootScene.js
  scenes/MenuScene.js
  scenes/GameScene.js       ← orquestador principal
  scenes/GameOverScene.js   ← certificado de defunción
  systems/ECGPhysics.js     ← física spring/damper
  systems/InputSystem.js
  systems/BeatmapSystem.js
  systems/BeatEvaluator.js  ← ventanas PERFECT/GOOD/MISS
  systems/ChaosSystem.js    ← 0-100, 5 niveles
  audio/AudioManager.js     ← Howler + SFX sintetizados
  audio/BeatClock.js        ← fuente única de timing
  ui/ECGRenderer.js         ← buffer circular + triple glow
  ui/GhostLine.js           ← indicador de zona objetivo
  ui/HUD.js
  ui/ChaosEffects.js
  data/BeatmapValidator.js
public/assets/
  audio/sfx/
  audio/music/
  beatmaps/
```

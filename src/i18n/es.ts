// src/i18n/es.ts — Spanish translations

import type { Translations } from "./types";

const es: Translations = {
  // Autopilot
  "autopilot.clickToStop": "Piloto automático ACTIVADO — clic para detener",
  "autopilot.ariaCancel": "Piloto automático activo — clic para cancelar",

  // Audio
  "audio.mute": "Silenciar",
  "audio.unmute": "Activar sonido",

  // Toolbar
  "toolbar.restart": "Reiniciar",
  "toolbar.screenshot": "Captura de pantalla",
  "toolbar.showSolve": "Mostrar cómo resolver esta pregunta",
  "toolbar.share": "Compartir",
  "toolbar.comments": "Comentarios",
  "toolbar.addComment": "+ Añadir comentario",

  // Level buttons
  "level.completePrev": "Completa el Nivel {n} primero",

  // Session report modal
  "report.shareReport": "Compartir informe",
  "report.creating": "Creando...",
  "report.nextLevel": "Siguiente nivel",
  "report.playAgain": "Jugar de nuevo",
  "report.emailAria": "Enviar informe por correo",
  "report.sendTitle": "Enviar el informe por correo electrónico",
  "report.enterEmail": "Introduce una dirección de correo",
  "report.emailPlaceholder": "parent@example.com",
  "report.subheading": "¡Ronda monstruo superada!",
  "report.score": "Puntuación",
  "report.accuracy": "Precisión",
  "report.eggs": "Huevos",
  "report.sendSuccess": "Informe enviado a {email}",
  "report.sendFail": "Error al enviar el informe.",

  // Game
  "game.correct": "¡Correcto! 🎉",
  "game.wrongAnswer": "La respuesta era {answer}",
  "game.tryOnYourOwn": "Inténtalo tú mismo",
  "game.tapAnywhere": "Toca en cualquier lugar para comenzar",
  "game.dragDino": "Arrastra el dinosaurio por el sendero",
  "game.enterDistance": "Introduce la distancia",
  "game.monsterRoundStart": "¡Ronda Monstruo!",
  "game.monsterRoundHint": "Sin odómetro — ¡calcula mentalmente!",
  "game.howMuchFarther": "¿Cuánto más lejos?",
  "game.tryAgain": "¡Inténtalo de nuevo!",
  "game.typeNumber": "¡Escribe un número!",
  "game.enterNumber": "¡Introduce un número!",
  "game.collectGoldenEggs": "Recoge {count} Huevos Dorados ✨",
  "game.youDidIt": "¡Lo lograste!",
  "game.allMastered": "Los 3 niveles dominados",
  "game.everyMonsterRound": "¡Incluyendo cada Ronda Monstruo!",
  "game.levelClear": "¡Nivel {level} superado!",
  "game.allEggsCollected": "¡{count} huevos recogidos!",
  "game.monsterCrushed": "¡Ronda Monstruo aplastada!",

  // Rotate
  "rotate.heading": "Gira tu dispositivo",
  "rotate.subtext": "Este juego funciona mejor en modo horizontal",

  // Social
  "social.shareTitle": "¡Juega Distance Calculator — un juego de matemáticas gratis!",
  "social.commentsTitle": "Comentarios",

  // PDF
  "pdf.title": "Distance Calculator",
  "pdf.sessionReport": "Informe de sesión del Nivel {n}",
  "pdf.gameDescription": "Sobre este juego",
  "pdf.objectiveLabel": "Objetivo:",
  "pdf.objectiveLevel1": "Arrastra el dinosaurio y suma las distancias para hallar el recorrido total.",
  "pdf.objectiveLevel2": "Se da el total. Encuentra la distancia faltante restando.",
  "pdf.objectiveLevel3": "Compara dos distancias desde un punto común y halla la diferencia.",
  "pdf.scoreLabel": "Puntuación",
  "pdf.accuracyLabel": "Precisión",
  "pdf.timeLabel": "Tiempo total",
  "pdf.questionLabel": "P{n}",
  "pdf.correct": "CORRECTO",
  "pdf.wrong": "INCORRECTO",
  "pdf.givenAnswer": "Tu respuesta: {value}",
  "pdf.correctAnswer": "Respuesta correcta: {value}",
  "pdf.encourage90": "¡Trabajo excepcional! 🌟",
  "pdf.encourage70": "¡Gran esfuerzo! ¡Sigue así! 🎉",
  "pdf.encourage50": "¡Buen intento! ¡La práctica hace al maestro! 💪",
  "pdf.encourageBelow": "¡Sigue adelante — estás aprendiendo! 🌱",
  "pdf.tip": "Consejo: Vuelve y prueba las preguntas que fallaste.",
  "pdf.footer": "Generado por SeeMaths",
  "pdf.footerUrl": "www.seemaths.com",

  // Email
  "email.subject": "Informe de {gameName}",
  "email.greeting": "Hola,",
  "email.bodyIntro": "Un jugador jugó {game} a las {time} el {date} durante {duration}. Puntuación: {score}, Precisión: {accuracy}.",
  "email.curriculumIntro": "Este juego cubre {stageLabel}: {curriculumCode} — {curriculumDescription}.",
  "email.regards": "Saludos,",
  "email.invalidEmail": "Introduce una dirección de correo válida.",
  "email.missingPdf": "Falta el archivo adjunto del informe.",
  "email.notConfigured": "El servicio de correo no está configurado.",
  "email.sendFailed": "Error al enviar el informe.",

  // Language switcher
  "lang.label": "Idioma",
  "lang.en": "English",
  "lang.zh": "中文",
  "lang.es": "Español",
  "lang.ru": "Русский",
  "lang.hi": "हिन्दी",
  "lang.other": "Otro...",
  "lang.translating": "Traduciendo...",
  "lang.translateFail": "Error en la traducción. Inténtalo de nuevo.",
  "lang.promptTitle": "Traducir a otro idioma",
  "lang.promptPlaceholder": "p.ej. Francés, Árabe, Hindi...",
  "lang.translate": "Traducir",
  "lang.cancel": "Cancelar",
};

export default es;

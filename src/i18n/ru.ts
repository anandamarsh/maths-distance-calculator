// src/i18n/ru.ts — Russian translations

import type { Translations } from "./types";

const ru: Translations = {
  // Autopilot
  "autopilot.clickToStop": "Автопилот ВКЛЮЧЁН — нажмите, чтобы остановить",
  "autopilot.ariaCancel": "Автопилот активен — нажмите, чтобы отменить",

  // Audio
  "audio.mute": "Без звука",
  "audio.unmute": "Включить звук",

  // Toolbar
  "toolbar.restart": "Начать заново",
  "toolbar.screenshot": "Снимок экрана",
  "toolbar.showSolve": "Показать решение этого вопроса",
  "toolbar.share": "Поделиться",
  "toolbar.comments": "Комментарии",
  "toolbar.addComment": "+ Добавить комментарий",

  // Level buttons
  "level.completePrev": "Сначала пройдите уровень {n}",

  // Session report modal
  "report.shareReport": "Поделиться отчётом",
  "report.creating": "Создание...",
  "report.nextLevel": "Следующий уровень",
  "report.playAgain": "Играть снова",
  "report.emailAria": "Отправить отчёт по email",
  "report.sendTitle": "Отправить отчёт по электронной почте",
  "report.enterEmail": "Введите адрес электронной почты",
  "report.emailPlaceholder": "parent@example.com",
  "report.subheading": "Монстр-раунд пройден!",
  "report.score": "Счёт",
  "report.accuracy": "Точность",
  "report.eggs": "Яйца",
  "report.sendSuccess": "Отчёт отправлен на {email}",
  "report.sendFail": "Не удалось отправить отчёт.",

  // Game
  "game.correct": "Правильно! 🎉",
  "game.wrongAnswer": "Правильный ответ: {answer}",
  "game.tryOnYourOwn": "Попробуйте сами",
  "game.tapAnywhere": "Нажмите в любом месте, чтобы начать",
  "game.dragDino": "Перетащите динозавра по маршруту",
  "game.enterDistance": "Введите расстояние",
  "game.monsterRoundStart": "Монстр-раунд!",
  "game.monsterRoundHint": "Одометр скрыт — считайте в уме!",
  "game.howMuchFarther": "Насколько дальше?",
  "game.tryAgain": "Попробуйте ещё раз!",
  "game.typeNumber": "Введите число!",
  "game.enterNumber": "Введите число!",
  "game.collectGoldenEggs": "Собери {count} золотых яиц ✨",
  "game.youDidIt": "Вы сделали это!",
  "game.allMastered": "Все 3 уровня пройдены",
  "game.everyMonsterRound": "Включая каждый монстр-раунд!",
  "game.levelClear": "Уровень {level} пройден!",
  "game.allEggsCollected": "Все {count} яиц собраны!",
  "game.monsterCrushed": "Монстр-раунд покорён!",

  // Rotate
  "rotate.heading": "Поверните устройство",
  "rotate.subtext": "Эта игра лучше работает в альбомном режиме",

  // Social
  "social.shareTitle": "Играйте в Distance Calculator — бесплатную математическую игру!",
  "social.commentsTitle": "Комментарии",

  // PDF
  "pdf.title": "Distance Calculator",
  "pdf.sessionReport": "Отчёт о сессии уровня {n}",
  "pdf.gameDescription": "Об этой игре",
  "pdf.objectiveLabel": "Цель:",
  "pdf.objectiveLevel1": "Перетащите динозавра и сложите расстояния, чтобы найти общий путь.",
  "pdf.objectiveLevel2": "Общее расстояние дано. Найдите недостающий отрезок путём вычитания.",
  "pdf.objectiveLevel3": "Сравните два расстояния от общей точки и найдите разницу.",
  "pdf.scoreLabel": "Счёт",
  "pdf.accuracyLabel": "Точность",
  "pdf.timeLabel": "Общее время",
  "pdf.questionLabel": "В{n}",
  "pdf.correct": "ПРАВИЛЬНО",
  "pdf.wrong": "НЕПРАВИЛЬНО",
  "pdf.givenAnswer": "Ваш ответ: {value}",
  "pdf.correctAnswer": "Правильный ответ: {value}",
  "pdf.encourage90": "Выдающаяся работа! 🌟",
  "pdf.encourage70": "Отличное усилие! Продолжайте! 🎉",
  "pdf.encourage50": "Хорошая попытка! Практика ведёт к совершенству! 💪",
  "pdf.encourageBelow": "Не останавливайтесь — вы учитесь! 🌱",
  "pdf.tip": "Совет: Вернитесь и попробуйте вопросы, на которые ответили неверно.",
  "pdf.footer": "Создано SeeMaths",
  "pdf.footerUrl": "www.seemaths.com",
  "pdf.nswCurriculum": "Учебная программа по математике NSW",
  "pdf.basicRound": "Базовый раунд:",
  "pdf.basicRoundDesc": "Зарабатывайте 10 яиц, отвечая на вопросы о расстояниях. Новая карта на каждый вопрос.",
  "pdf.monsterRoundLabel": "Монстр-раунд:",
  "pdf.monsterRoundDesc": "Защитите 10 яиц от сложных вопросов. Неверный ответ — минус одно яйцо.",
  "pdf.monsterBadge": "МОНСТР",
  "pdf.answered": "ответ: {value}",
  "pdf.correctIn": "(правильно: {value})",
  "pdf.tipAreas": "Совет: Потренируйтесь в следующий раз на {areas}!",
  "pdf.areaAddingDistances": "сложение расстояний",
  "pdf.areaFindingMissing": "поиск недостающего расстояния",
  "pdf.areaComparingDistances": "сравнение расстояний",

  // Question prompt templates
  "game.prompt.l1TwoStop": "{dino} хочет доехать из {from} в {to}. Какое расстояние должен преодолеть {dino}?",
  "game.prompt.l1MultiStop": "{dino} едет через {stops}. Какое общее расстояние должен преодолеть {dino}?",
  "game.prompt.l2MissingLeg": "Общее расстояние от {from} до {to} равно {total} {unit}. Найдите недостающее расстояние от {hidFrom} до {hidTo}.",
  "game.prompt.l3HowMuchFarther": "Из {hub}, насколько дальше до {far}, чем до {near}?",
  "game.prompt.l3SubFromTo": "Какое расстояние от {from} до {to}?",
  "game.stopSeparator": " → ",

  // Email
  "email.subject": "Отчёт {gameName}",
  "email.greeting": "Здравствуйте,",
  "email.bodyIntro": "Игрок играл в {game} в {time} {date} в течение {duration}. Счёт: {score}, Точность: {accuracy}.",
  "email.curriculumIntro": "Эта игра охватывает {stageLabel}: {curriculumCode} — {curriculumDescription}.",
  "email.regards": "С уважением,",
  "email.invalidEmail": "Введите корректный адрес электронной почты.",
  "email.missingPdf": "Вложение с отчётом отсутствует.",
  "email.notConfigured": "Почтовый сервис не настроен.",
  "email.sendFailed": "Не удалось отправить отчёт.",

  // Language switcher
  "lang.label": "Язык",
  "lang.en": "English",
  "lang.zh": "中文",
  "lang.es": "Español",
  "lang.ru": "Русский",
  "lang.hi": "हिन्दी",
  "lang.other": "Другой...",
  "lang.translating": "Перевод...",
  "lang.translateFail": "Ошибка перевода. Попробуйте снова.",
  "lang.promptTitle": "Перевести на другой язык",
  "lang.promptPlaceholder": "напр. Французский, Хинди, Арабский...",
  "lang.translate": "Перевести",
  "lang.cancel": "Отмена",
};

export default ru;

// src/i18n/hi.ts — Hindi translations

import type { Translations } from "./types";

const hi: Translations = {
  // Autopilot
  "autopilot.clickToStop": "ऑटोपायलट चालू है — रोकने के लिए क्लिक करें",
  "autopilot.ariaCancel": "ऑटोपायलट सक्रिय है — रद्द करने के लिए क्लिक करें",

  // Audio
  "audio.mute": "म्यूट करें",
  "audio.unmute": "अनम्यूट करें",

  // Toolbar
  "toolbar.restart": "फिर से शुरू करें",
  "toolbar.screenshot": "स्क्रीनशॉट",
  "toolbar.showSolve": "यह सवाल कैसे हल करें, दिखाएं",
  "toolbar.share": "शेयर करें",
  "toolbar.comments": "टिप्पणियाँ",
  "toolbar.addComment": "+ टिप्पणी जोड़ें",

  // Level buttons
  "level.completePrev": "पहले स्तर {n} पूरा करें",

  // Session report modal
  "report.shareReport": "रिपोर्ट शेयर करें",
  "report.creating": "बन रही है...",
  "report.nextLevel": "अगला स्तर",
  "report.playAgain": "फिर खेलें",
  "report.emailAria": "ईमेल रिपोर्ट",
  "report.sendTitle": "ईमेल द्वारा रिपोर्ट भेजें",
  "report.enterEmail": "ईमेल पता दर्ज करें",
  "report.emailPlaceholder": "parent@example.com",
  "report.namePlaceholder": "आपका नाम",
  "report.subheading": "मॉन्स्टर राउंड जीत लिया!",
  "report.score": "स्कोर",
  "report.accuracy": "सटीकता",
  "report.eggs": "अंडे",
  "report.sendSuccess": "रिपोर्ट {email} पर भेज दी गई",
  "report.sendFail": "रिपोर्ट भेजने में विफल।",

  // Game
  "game.correct": "सही! 🎉",
  "game.wrongAnswer": "सही उत्तर था {answer}",
  "game.tryOnYourOwn": "खुद कोशिश करें",
  "game.tapAnywhere": "शुरू करने के लिए कहीं भी टैप करें",
  "game.dragDino": "डायनासोर को रास्ते पर खींचें",
  "game.enterDistance": "दूरी दर्ज करें",
  "game.monsterRoundStart": "मॉन्स्टर राउंड!",
  "game.monsterRoundHint": "ओडोमीटर छुपा है — दिमाग से हल करें!",
  "game.howMuchFarther": "कितना और दूर?",
  "game.tryAgain": "फिर कोशिश करें!",
  "game.typeNumber": "एक संख्या टाइप करें!",
  "game.enterNumber": "एक संख्या दर्ज करें!",
  "game.touchAndDrag": "छूकर खींचें",
  "game.clickAndDrag": "क्लिक करके खींचें",
  "game.enterValue": "मान दर्ज करें",
  "game.collectGoldenEggs": "{count} सोने के अंडे इकट्ठा करें ✨",
  "game.youDidIt": "आपने कर दिखाया!",
  "game.allMastered": "सभी 3 स्तर पूरे किए",
  "game.everyMonsterRound": "हर मॉन्स्टर राउंड सहित!",
  "game.levelClear": "स्तर {level} पूरा!",
  "game.allEggsCollected": "सभी {count} अंडे इकट्ठा किए!",
  "game.monsterCrushed": "मॉन्स्टर राउंड जीत लिया!",

  // Rotate
  "rotate.heading": "डिवाइस घुमाएं",
  "rotate.subtext": "यह गेम लैंडस्केप मोड में सबसे अच्छा खेला जाता है",

  // Social
  "social.shareTitle": "Distance Calculator खेलें — एक मुफ़्त गणित का खेल!",
  "social.commentsTitle": "टिप्पणियाँ",

  // PDF
  "pdf.title": "Distance Calculator",
  "pdf.sessionReport": "स्तर {n} सत्र रिपोर्ट",
  "pdf.gameDescription": "इस गेम के बारे में",
  "pdf.objectiveLabel": "उद्देश्य:",
  "pdf.objectiveLevel1": "डायनासोर को खींचें और कुल यात्रा दूरी जोड़ें।",
  "pdf.objectiveLevel2": "कुल दिया गया है। घटाकर लुप्त दूरी ज्ञात करें।",
  "pdf.objectiveLevel3": "एक साझा केंद्र से दो दूरियों की तुलना करें और अंतर ज्ञात करें।",
  "pdf.scoreLabel": "स्कोर",
  "pdf.accuracyLabel": "सटीकता",
  "pdf.timeLabel": "कुल समय",
  "pdf.questionLabel": "प्र{n}",
  "pdf.correct": "सही",
  "pdf.wrong": "गलत",
  "pdf.givenAnswer": "आपका उत्तर: {value}",
  "pdf.correctAnswer": "सही उत्तर: {value}",
  "pdf.encourage90": "शानदार काम! 🌟",
  "pdf.encourage70": "बहुत अच्छा! जारी रखें! 🎉",
  "pdf.encourage50": "अच्छी कोशिश! अभ्यास से सफलता मिलती है! 💪",
  "pdf.encourageBelow": "हिम्मत रखें — आप सीख रहे हैं! 🌱",
  "pdf.tip": "सुझाव: वापस जाएं और जो प्रश्न छूट गए उन्हें हल करें।",
  "pdf.footer": "SeeMaths द्वारा बनाया गया",
  "pdf.footerUrl": "www.seemaths.com",
  "pdf.durationMin": "मि",
  "pdf.durationSec": "से",
  "pdf.nswCurriculum": "NSW गणित पाठ्यक्रम",
  "pdf.basicRound": "बेसिक राउंड:",
  "pdf.basicRoundDesc": "रास्ते की दूरियों के सवाल हल करके 10 अंडे जीतें। हर सवाल के लिए नया नक्शा।",
  "pdf.monsterRoundLabel": "मॉन्स्टर राउंड:",
  "pdf.monsterRoundDesc": "कठिन सवालों से 10 अंडे बचाएं। गलत जवाब देने पर एक अंडा चला जाएगा।",
  "pdf.monsterBadge": "मॉन्स्टर",
  "pdf.answered": "उत्तर: {value}",
  "pdf.correctIn": "(सही: {value})",
  "pdf.tipAreas": "सुझाव: अगली बार {areas} का अभ्यास करें!",
  "pdf.areaAddingDistances": "दूरियाँ जोड़ना",
  "pdf.areaFindingMissing": "लुप्त दूरी ढूंढना",
  "pdf.areaComparingDistances": "दूरियों की तुलना करना",

  // Question prompt templates
  "game.prompt.l1TwoStop": "{dino} को {from} से {to} तक जाना है। {dino} को कितनी दूरी तय करनी चाहिए?",
  "game.prompt.l1MultiStop": "{dino} {stops} से होकर जाता है। {dino} को कुल कितनी दूरी तय करनी चाहिए?",
  "game.prompt.l2MissingLeg": "{from} से {to} तक की कुल दूरी {total} {unit} है। {hidFrom} से {hidTo} तक की लुप्त दूरी क्या है?",
  "game.prompt.l3HowMuchFarther": "{hub} से {far} तक की दूरी, {near} की तुलना में कितनी अधिक है?",
  "game.prompt.l3SubFromTo": "{from} से {to} तक की दूरी कितनी है?",
  "game.stopSeparator": " → ",

  // Email
  "email.subject": "{gameName} रिपोर्ट",
  "email.greeting": "नमस्ते,",
  "email.bodyIntro": "{playerName} ने {date} को {time} पर {game} खेला, {duration} के लिए। स्कोर: {score}, सटीकता: {accuracy}।",
  "email.curriculumIntro": "यह गेम {stageLabel} को कवर करता है:",
  "email.regards": "सादर,",
  "email.invalidEmail": "कृपया एक वैध ईमेल पता दर्ज करें।",
  "email.missingPdf": "रिपोर्ट अनुलग्नक गायब है।",
  "email.notConfigured": "ईमेल सेवा कॉन्फ़िगर नहीं है।",
  "email.sendFailed": "रिपोर्ट भेजने में विफल।",

  // Curriculum
  "curriculum.stageLabel": "चरण 3 (5-6 वर्ष)",
  "curriculum.descL1L2": "भिन्न, दशमलव और प्रतिशत के साथ तुलना, क्रम और गणना करता है।",
  "curriculum.descL3": "लंबाई और दूरी मापने के लिए उचित इकाई का चयन, परिमाप की गणना, और लंबाई की इकाइयों के बीच रूपांतरण।",

  // Language switcher
  "lang.label": "भाषा",
  "lang.en": "English",
  "lang.zh": "中文",
  "lang.hi": "हिन्दी",
  "lang.other": "अन्य...",
  "lang.translating": "अनुवाद हो रहा है...",
  "lang.translateFail": "अनुवाद विफल। कृपया पुनः प्रयास करें।",
  "lang.promptTitle": "किसी अन्य भाषा में अनुवाद करें",
  "lang.promptPlaceholder": "जैसे फ्रेंच, अरबी, जापानी...",
  "lang.translate": "अनुवाद करें",
  "lang.cancel": "रद्द करें",
};

export default hi;

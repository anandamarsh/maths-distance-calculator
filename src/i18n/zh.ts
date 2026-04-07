// src/i18n/zh.ts — Simplified Chinese translations

import type { Translations } from "./types";

const zh: Translations = {
  // Autopilot
  "autopilot.clickToStop": "自动驾驶已开启 — 点击停止",
  "autopilot.ariaCancel": "自动驾驶已激活 — 点击取消",

  // Audio
  "audio.mute": "静音",
  "audio.unmute": "取消静音",

  // Toolbar
  "toolbar.restart": "重新开始",
  "toolbar.screenshot": "截图",
  "toolbar.showSolve": "展示如何解答此题",
  "toolbar.share": "分享",
  "toolbar.comments": "评论",
  "toolbar.addComment": "+ 添加评论",

  // Level buttons
  "level.completePrev": "请先完成第 {n} 关",

  // Session report modal
  "report.shareReport": "分享报告",
  "report.creating": "生成中...",
  "report.nextLevel": "下一关",
  "report.playAgain": "再玩一次",
  "report.emailAria": "通过邮件发送报告",
  "report.sendTitle": "通过邮件发送报告",
  "report.enterEmail": "请输入邮箱地址",
  "report.emailPlaceholder": "parent@example.com",
  "report.subheading": "怪兽关卡已通过！",
  "report.score": "得分",
  "report.accuracy": "正确率",
  "report.eggs": "彩蛋",
  "report.sendSuccess": "报告已发送至 {email}",
  "report.sendFail": "发送报告失败。",

  // Game
  "game.correct": "正确！🎉",
  "game.wrongAnswer": "正确答案是 {answer}",
  "game.tryOnYourOwn": "自己试一试",
  "game.tapAnywhere": "点击任意位置开始",
  "game.dragDino": "拖动恐龙沿路线前进",
  "game.enterDistance": "输入距离",
  "game.monsterRoundStart": "怪兽关卡！",
  "game.monsterRoundHint": "里程表已隐藏 — 用脑子算！",
  "game.howMuchFarther": "还差多远？",
  "game.tryAgain": "再试一次！",
  "game.typeNumber": "请输入一个数字！",
  "game.enterNumber": "请输入一个数字！",
  "game.collectGoldenEggs": "收集 {count} 个金蛋 ✨",
  "game.youDidIt": "你做到了！",
  "game.allMastered": "全部 3 关通关",
  "game.everyMonsterRound": "包括每个怪兽关卡！",
  "game.levelClear": "第 {level} 关通关！",
  "game.allEggsCollected": "全部 {count} 个蛋已收集！",
  "game.monsterCrushed": "怪兽关卡已攻克！",

  // Rotate
  "rotate.heading": "请旋转设备",
  "rotate.subtext": "横屏模式下游戏体验更佳",

  // Social
  "social.shareTitle": "来玩 Distance Calculator — 免费数学游戏！",
  "social.commentsTitle": "评论",

  // PDF
  "pdf.title": "Distance Calculator",
  "pdf.sessionReport": "第 {n} 关学习报告",
  "pdf.gameDescription": "游戏介绍",
  "pdf.objectiveLabel": "目标：",
  "pdf.objectiveLevel1": "拖动恐龙，将各段距离相加求总路程。",
  "pdf.objectiveLevel2": "已知总距离，用减法求缺失的一段距离。",
  "pdf.objectiveLevel3": "比较从共同起点出发的两段距离，求差值。",
  "pdf.scoreLabel": "得分",
  "pdf.accuracyLabel": "正确率",
  "pdf.timeLabel": "总用时",
  "pdf.questionLabel": "第{n}题",
  "pdf.correct": "正确",
  "pdf.wrong": "错误",
  "pdf.givenAnswer": "你的答案：{value}",
  "pdf.correctAnswer": "正确答案：{value}",
  "pdf.encourage90": "出色的工作！🌟",
  "pdf.encourage70": "很好！继续加油！🎉",
  "pdf.encourage50": "不错的尝试！熟能生巧！💪",
  "pdf.encourageBelow": "继续努力 — 你在进步！🌱",
  "pdf.tip": "提示：回去再试试那些答错的题目。",
  "pdf.footer": "由 SeeMaths 生成",
  "pdf.footerUrl": "www.seemaths.com",

  // Email
  "email.subject": "{gameName} 报告",
  "email.greeting": "您好，",
  "email.bodyIntro": "一位玩家于 {date} {time} 玩了 {game}，时长 {duration}。得分：{score}，正确率：{accuracy}。",
  "email.curriculumIntro": "此游戏涵盖 {stageLabel}：{curriculumCode} — {curriculumDescription}。",
  "email.regards": "此致，",
  "email.invalidEmail": "请输入有效的邮箱地址。",
  "email.missingPdf": "缺少报告附件。",
  "email.notConfigured": "邮件服务未配置。",
  "email.sendFailed": "发送报告失败。",

  // Language switcher
  "lang.label": "语言",
  "lang.en": "English",
  "lang.zh": "中文",
  "lang.es": "Español",
  "lang.ru": "Русский",
  "lang.hi": "हिन्दी",
  "lang.other": "其他...",
  "lang.translating": "翻译中...",
  "lang.translateFail": "翻译失败，请重试。",
  "lang.promptTitle": "翻译为其他语言",
  "lang.promptPlaceholder": "例如：法语、阿拉伯语、日语...",
  "lang.translate": "翻译",
  "lang.cancel": "取消",
};

export default zh;

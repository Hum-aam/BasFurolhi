require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Your Game short name from BotFather
const GAME_SHORT_NAME = "BasFurolhi";

// Your Web App URL hosted on Vercel
const GAME_URL = "https://game-sbey.vercel.app/"; // Replace this!

// Map to store the inline message ID per user for updating scores
const userScores = new Map();

// 🟢 /start sends the game link
bot.start((ctx) => {
  ctx.replyWithGame(GAME_SHORT_NAME);
});

// 🟢 Handle auto-generated "Play" button from Telegram
bot.on("callback_query", async (ctx) => {
  const callbackQuery = ctx.callbackQuery;
  const userId = ctx.from.id;

  if (callbackQuery.game_short_name === GAME_SHORT_NAME) {
    const inlineMessageId = callbackQuery.inline_message_id;

    // Save inlineMessageId so we can update score later
    if (inlineMessageId) {
      userScores.set(userId, inlineMessageId);
    }

    // Intercept the button and send a proper Web App button instead
    await ctx.answerCbQuery(); // Acknowledge the button

    await ctx.reply("🎮 Click below to play BasFurolhi:", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.webApp("Play BasFurolhi", GAME_URL)]
      ])
    });

    return;
  }

  await ctx.answerCbQuery("Unknown game.");
});

// 🟢 Handle score submission from the web app
bot.on("message", async (ctx) => {
  if (ctx.webAppData) {
    try {
      const userId = ctx.from.id;
      const data = JSON.parse(ctx.webAppData.data);
      const score = data.score;

      const inlineMessageId = userScores.get(userId);
      if (!inlineMessageId) {
        return ctx.reply("❌ Could not find your game session.");
      }

      await ctx.telegram.setGameScore(userId, score, {
        inline_message_id: inlineMessageId,
        force: true
      });

      ctx.reply(`✅ Your score of ${score} has been saved!`);
    } catch (error) {
      console.error("Score error:", error);
      ctx.reply("❌ Failed to update score.");
    }
  }
});

// 🟢 Optional command to directly send the Web App button
bot.command("playwebapp", (ctx) => {
  ctx.reply("🎮 Click below to play BasFurolhi:", {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.webApp("Play BasFurolhi", GAME_URL)]
    ])
  });
});

// ✅ Start the bot
bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

require("dotenv").config();
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Replace this with the short name you registered in BotFather
const GAME_SHORT_NAME = "BasFurolhi";

// Map to store the inline message ID per user for updating scores
const userScores = new Map();

// 🟢 Send the game when user starts the bot
bot.start((ctx) => {
  ctx.replyWithGame(GAME_SHORT_NAME);
});

// 🟢 Handle the button press when someone taps the Play button
bot.on("callback_query", async (ctx) => {
  const callbackQuery = ctx.callbackQuery;
  const userId = ctx.from.id;

  if (callbackQuery.game_short_name === GAME_SHORT_NAME) {
    const inlineMessageId = callbackQuery.inline_message_id;

    // Store inline message ID for that user to update the score later
    userScores.set(userId, inlineMessageId);

    // No need to answer callback if it's a game launch
    return;
  }

  await ctx.answerCbQuery();
});

// 🟢 Receive data from the Web App (score)
bot.on("message", async (ctx) => {
  if (ctx.webAppData) {
    try {
      const userId = ctx.from.id;
      const data = JSON.parse(ctx.webAppData.data);
      const score = data.score;

      const inlineMessageId = userScores.get(userId);
      if (!inlineMessageId) {
        return ctx.reply("Could not find your game session.");
      }

      // Update score
      await ctx.telegram.setGameScore(userId, score, {
        inline_message_id: inlineMessageId,
        force: true,
      });

      ctx.reply(`✅ Your score of ${score} has been saved!`);
    } catch (error) {
      console.error("Error setting score:", error);
      ctx.reply("❌ Failed to update score.");
    }
  }
});

// Start the bot
bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));


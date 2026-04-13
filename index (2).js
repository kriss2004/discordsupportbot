const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Partials,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

// ================= CONFIG =================
const TOKEN = "MTQ5MzI2NTUwNTY5NDM4NDE5MA.GNqjf2.ZKgP52KE7HWVgd7IQWP6RS7UHqb2SMS8-xb3gM";
const PANEL_CHANNEL_ID = "1491210896603615322";
const ADMIN_CHANNEL_ID = "1493261409419530260";

// ================= DATA =================
const activeTickets = new Map();
const closedTickets = new Set();

// ================= FUNCTION =================
function isClosed(userId) {
  return closedTickets.has(userId);
}

// ================= READY =================
client.once("ready", async () => {
  console.log("BOT ONLINE:", client.user.tag);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("SA-MP.lv Ticket System")
    .setDescription("Spied pogu lai atvērtu biļeti")
    .setColor(0x2b2d31);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("Atvērt biļeti")
      .setStyle(ButtonStyle.Primary)
  );

  const msgs = await channel.messages.fetch({ limit: 10 });
  const exists = msgs.find(m => m.author.id === client.user.id);

  if (!exists) {
    await channel.send({ embeds: [embed], components: [row] });
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  // OPEN
  if (interaction.isButton() && interaction.customId === "open_ticket") {

    const modal = new ModalBuilder()
      .setCustomId("ticket_modal")
      .setTitle("Ticket");

    const input = new TextInputBuilder()
      .setCustomId("problem")
      .setLabel("Apraksti problēmu")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // CREATE
  if (interaction.isModalSubmit() && interaction.customId === "ticket_modal") {

    const problem = interaction.fields.getTextInputValue("problem");

    activeTickets.set(interaction.user.id, {
      problem: problem,
      tag: interaction.user.tag
    });

    const embed = new EmbedBuilder()
      .setTitle("Jauns Ticket")
      .setColor(0xff0000)
      .addFields(
        { name: "Lietotājs", value: interaction.user.tag },
        { name: "Problēma", value: problem }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reply_${interaction.user.id}`)
        .setLabel("Atbildēt")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`close_${interaction.user.id}`)
        .setLabel("Aizvērt")
        .setStyle(ButtonStyle.Danger)
    );

    const channel = await client.channels.fetch(ADMIN_CHANNEL_ID);
    await channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({ content: "Ticket nosūtīts!", ephemeral: true });
  }

  // ================= REPLY =================
  if (interaction.isButton() && interaction.customId.startsWith("reply_")) {

    const userId = interaction.customId.split("_")[1];

    if (isClosed(userId)) {
      return interaction.reply({
        content: "❌ Ticket jau ir aizvērts un nav aktuāls.",
        ephemeral: true
      });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Nav atļaujas!", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`reply_modal_${userId}`)
      .setTitle("Atbilde");

    const input = new TextInputBuilder()
      .setCustomId("msg")
      .setLabel("Ziņa")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // ================= SEND REPLY =================
  if (interaction.isModalSubmit() && interaction.customId.startsWith("reply_modal_")) {

    const userId = interaction.customId.split("_")[2];

    if (isClosed(userId)) {
      return interaction.reply({
        content: "❌ Ticket jau ir aizvērts un nav aktuāls.",
        ephemeral: true
      });
    }

    const msg = interaction.fields.getTextInputValue("msg");
    const user = await client.users.fetch(userId);

    const embed = new EmbedBuilder()
      .setTitle("Discord Administratora atbilde")
      .setDescription(msg)
      .setColor(0x00ff99);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`notfixed_${userId}`)
        .setLabel("Nav atrisināts")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(`close_${userId}`)
        .setLabel("Aizvērt ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await user.send({ embeds: [embed], components: [row] });

    return interaction.reply({ content: "Nosūtīts!", ephemeral: true });
  }

  // ================= CLOSE =================
  if (interaction.isButton() && interaction.customId.startsWith("close_")) {

    const userId = interaction.customId.split("_")[1];

    if (isClosed(userId)) {
      return interaction.reply({
        content: "❌ Ticket jau ir aizvērts un nav aktuāls.",
        ephemeral: true
      });
    }

    if (
      interaction.user.id !== userId &&
      (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
    ) {
      return interaction.reply({ content: "Nav atļaujas!", ephemeral: true });
    }

    activeTickets.delete(userId);
    closedTickets.add(userId);

    try {
      const user = await client.users.fetch(userId);
      await user.send("✔ Ticket aizvērts.");
    } catch {}

    return interaction.reply({ content: "Aizvērts", ephemeral: true });
  }

  // ================= NOT FIXED =================
  if (interaction.isButton() && interaction.customId.startsWith("notfixed_")) {

    const userId = interaction.customId.split("_")[1];

    if (isClosed(userId)) {
      return interaction.reply({
        content: "❌ Ticket jau ir aizvērts un nav aktuāls.",
        ephemeral: true
      });
    }

    const data = activeTickets.get(userId);
    const lastProblem = data?.problem || "Nav datu";
    const userTag = data?.tag || userId;

    const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID);

    const logEmbed = new EmbedBuilder()
      .setTitle("⚠ Ticket NAV atrisināts")
      .setColor(0xffcc00)
      .addFields(
        { name: "Lietotājs", value: userTag },
        { name: "Problēma", value: lastProblem }
      );

    await adminChannel.send({ embeds: [logEmbed] });

    const user = await client.users.fetch(userId);

    await user.send("Discord Administratori tika informēti lūdzu gaidi atbildi!");

    const adminMsg = new EmbedBuilder()
      .setTitle("🔁 Nepieciešama atkārtota atbilde")
      .setColor(0xff0000)
      .addFields({ name: "Lietotājs", value: userTag });

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reply_${userId}`)
        .setLabel("Atbildēt vēlreiz")
        .setStyle(ButtonStyle.Success)
    );

    await adminChannel.send({ embeds: [adminMsg], components: [row2] });

    return interaction.reply({ content: "Discord Administratori tika informēti lūdzu gaidi atbildi!", ephemeral: true });
  }

});

// ================= LOGIN =================
client.login(TOKEN);
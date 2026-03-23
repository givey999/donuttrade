import { TextChannel, AttachmentBuilder, Message } from 'discord.js';

/**
 * Fetch all messages from a channel and format as a text transcript.
 */
export async function generateTranscript(channel: TextChannel): Promise<AttachmentBuilder> {
  const allMessages: Message[] = [];
  let lastId: string | undefined;

  // Fetch all messages (100 at a time)
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before: lastId });
    if (batch.size === 0) break;

    for (const msg of batch.values()) {
      allMessages.push(msg);
    }

    lastId = batch.last()?.id;
    if (batch.size < 100) break;
  }

  // Sort all messages chronologically (oldest first)
  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = allMessages.map((msg) => {
    const time = msg.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const author = msg.author.bot ? `[BOT] ${msg.author.username}` : msg.author.username;
    const content = msg.content || (msg.embeds.length > 0 ? '[embed]' : '[no content]');
    return `[${time}] ${author}: ${content}`;
  });

  const transcript = lines.join('\n') || '(empty conversation)';
  const fileName = `${channel.name}-transcript.txt`;

  return new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: fileName });
}

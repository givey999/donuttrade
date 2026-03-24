import { TextChannel, AttachmentBuilder, Message } from 'discord.js';

/**
 * Fetch all messages from a channel and return them sorted chronologically,
 * plus a formatted text transcript.
 */
export async function generateTranscript(channel: TextChannel): Promise<{
  transcript: AttachmentBuilder;
  allMessages: Message[];
}> {
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

    const parts: string[] = [];
    if (msg.content) parts.push(msg.content);
    if (msg.embeds.length > 0) parts.push('[embed]');
    for (const att of msg.attachments.values()) {
      parts.push(`[attachment: ${att.name}]`);
    }
    const content = parts.join(' ') || '[no content]';

    return `[${time}] ${author}: ${content}`;
  });

  const text = lines.join('\n') || '(empty conversation)';
  const fileName = `${channel.name}-transcript.txt`;

  return {
    transcript: new AttachmentBuilder(Buffer.from(text, 'utf-8'), { name: fileName }),
    allMessages,
  };
}

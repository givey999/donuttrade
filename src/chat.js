const EventEmitter = require('events');

class ChatHandler extends EventEmitter {
  constructor(bot) {
    super();
    this.bot = bot;
    this.commandPrefix = '!';
    this.commandHandlers = new Map();
    this.messageFilters = [];

    this._setupListeners();
  }

  _setupListeners() {
    this.bot.on('chat', (username, message) => {
      this._processMessage(username, message, 'chat');
    });

    this.bot.on('whisper', (username, message) => {
      this._processMessage(username, message, 'whisper');
    });

    this.bot.on('rawMessage', (text, position) => {
      this.emit('raw', text, position);
    });
  }

  _processMessage(username, message, type) {
    // Apply filters
    for (const filter of this.messageFilters) {
      if (!filter(username, message, type)) {
        return; // Message filtered out
      }
    }

    // Check for commands
    if (message.startsWith(this.commandPrefix)) {
      const [command, ...args] = message.slice(this.commandPrefix.length).split(' ');
      const handler = this.commandHandlers.get(command.toLowerCase());

      if (handler) {
        try {
          handler(username, args, type);
        } catch (err) {
          console.error(`[Chat] Command error: ${err.message}`);
          this.emit('commandError', command, err);
        }
        return;
      }
    }

    // Emit the message
    this.emit('message', {
      username,
      message,
      type,
      timestamp: new Date()
    });
  }

  setCommandPrefix(prefix) {
    this.commandPrefix = prefix;
  }

  registerCommand(name, handler) {
    this.commandHandlers.set(name.toLowerCase(), handler);
    console.log(`[Chat] Registered command: ${this.commandPrefix}${name}`);
  }

  unregisterCommand(name) {
    this.commandHandlers.delete(name.toLowerCase());
  }

  addFilter(filterFn) {
    this.messageFilters.push(filterFn);
  }

  clearFilters() {
    this.messageFilters = [];
  }

  send(message) {
    return this.bot.sendChat(message);
  }

  whisper(username, message) {
    return this.bot.sendChat(`/tell ${username} ${message}`);
  }

  command(cmd) {
    return this.bot.sendCommand(cmd);
  }
}

module.exports = ChatHandler;

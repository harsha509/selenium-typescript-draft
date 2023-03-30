
class Level {
  private name_: string;
  private value_: number;

  constructor(name: string, level: number) {
    if (level < 0) {
      throw new TypeError('Level must be >= 0');
    }

    this.name_ = name;
    this.value_ = level;
  }

  get name(): string {
    return this.name_;
  }

  get value(): number {
    return this.value_;
  }

  toString(): string {
    return this.name;
  }

  static OFF = new Level('OFF', Infinity);
  static SEVERE = new Level('SEVERE', 1000);
  static WARNING = new Level('WARNING', 900);
  static INFO = new Level('INFO', 800);
  static DEBUG = new Level('DEBUG', 700);
  static FINE = new Level('FINE', 500);
  static FINER = new Level('FINER', 400);
  static FINEST = new Level('FINEST', 300);
  static ALL = new Level('ALL', 0);
}

const ALL_LEVELS: Set<Level> = new Set([
  Level.OFF,
  Level.SEVERE,
  Level.WARNING,
  Level.INFO,
  Level.DEBUG,
  Level.FINE,
  Level.FINER,
  Level.FINEST,
  Level.ALL,
]);

const LEVELS_BY_NAME: Map<string, Level> = new Map([
  [Level.OFF.name, Level.OFF],
  [Level.SEVERE.name, Level.SEVERE],
  [Level.WARNING.name, Level.WARNING],
  [Level.INFO.name, Level.INFO],
  [Level.DEBUG.name, Level.DEBUG],
  [Level.FINE.name, Level.FINE],
  [Level.FINER.name, Level.FINER],
  [Level.FINEST.name, Level.FINEST],
  [Level.ALL.name, Level.ALL],
]);


function getLevel(nameOrValue: string | number): Level {
  if (typeof nameOrValue === 'string') {
    return LEVELS_BY_NAME.get(nameOrValue) || Level.ALL;
  }
  if (typeof nameOrValue !== 'number') {
    throw new TypeError('not a string or number');
  }
  for (let level of ALL_LEVELS) {
    if (nameOrValue >= level.value) {
      return level;
    }
  }
  return Level.ALL;
}


class Entry {
  level: Level;
  readonly message: string;
  readonly timestamp: number;
  private readonly type: string;

  constructor(level: Level | string | number, message: string, opt_timestamp?: number, opt_type?: string) {
    this.level = (level instanceof Level) ? level : getLevel(level);
    this.message = message;
    this.timestamp = (typeof opt_timestamp === 'number') ? opt_timestamp : Date.now();
    this.type = opt_type || '';
  }

  toJSON(): { level: string, message: string, timestamp: number, type: string } {
    return {
      level: this.level.name,
      message: this.message,
      timestamp: this.timestamp,
      type: this.type,
    };
  }
}

class Logger {
  name_: string;
  level_: Level | null;
  parent_: Logger | null;
  handlers_: Set<(entry: Entry) => void> | null;

  constructor(name: string, opt_level?: Level) {
    this.name_ = name;
    this.level_ = opt_level || null;
    this.parent_ = null;
    this.handlers_ = null;
  }

  getName(): string {
    return this.name_;
  }

  setLevel(level: Level) {
    this.level_ = level;
  }

  getLevel(): Level | null {
    return this.level_;
  }

  getEffectiveLevel(): Level {
    let logger = this;
    let level: Level | null;
    do {
      level = logger.level_;
      // @ts-ignore
      logger = logger.parent_;
    } while (logger && !level);
    return level || Level.OFF;
  }

  isLoggable(level: Level): boolean {
    return (level.value !== Level.OFF.value && level.value >= this.getEffectiveLevel().value);
  }

  addHandler(handler: (entry: Entry) => void) {
    if (!this.handlers_) {
      this.handlers_ = new Set();
    }
    this.handlers_.add(handler);
  }

  removeHandler(handler: (entry: Entry) => void): boolean {
    if (!this.handlers_) {
      return false;
    }
    return this.handlers_.delete(handler);
  }
}

class LogManager {
  private loggers_ = new Map<string, Logger>();
  root_ = new Logger('', Level.OFF);

  constructor() {}

  public getLogger(name: string): Logger {
    if (!name) {
      return this.root_;
    }
    let parent = this.root_;
    for (let i = name.indexOf('.'); i != -1; i = name.indexOf('.', i + 1)) {
      const parentName = name.substr(0, i);
      parent = this.createLogger_(parentName, parent);
    }
    return this.createLogger_(name, parent);
  }

  private createLogger_(name: string, parent: Logger): Logger {
    if (this.loggers_.has(name)) {
      return this.loggers_.get(name) as Logger;
    }
    const logger = new Logger(name, null);
    logger.parent_ = parent;
    this.loggers_.set(name, logger);
    return logger;
  }
}

const logManager = new LogManager();


function getLogger(name: string): Logger {
  return logManager.getLogger(name)
}

/**
 * Pads a number to ensure it has a minimum of two digits.
 *
 * @param {number} n the number to be padded.
 * @return {string} the padded number.
 */
function pad(n: number): string {
  if (n >= 10) {
    return '' + n
  } else {
    return '0' + n
  }
}


function consoleHandler(entry: Entry): void {
  if (typeof console === 'undefined' || !console) {
    return
  }

  const timestamp = new Date(entry.timestamp)
  const msg =
      '[' +
      timestamp.getUTCFullYear() +
      '-' +
      pad(timestamp.getUTCMonth() + 1) +
      '-' +
      pad(timestamp.getUTCDate()) +
      'T' +
      pad(timestamp.getUTCHours()) +
      ':' +
      pad(timestamp.getUTCMinutes()) +
      ':' +
      pad(timestamp.getUTCSeconds()) +
      'Z] ' +
      '[' +
      entry.level.name +
      '] ' +
      entry.message

  const level = entry.level.value
  if (level >= Level.SEVERE.value) {
    console.error(msg)
  } else if (level >= Level.WARNING.value) {
    console.warn(msg)
  } else {
    console.log(msg)
  }
}

const Type = {
  BROWSER: "browser",
  CLIENT: "client",
  DRIVER: "driver",
  PERFORMANCE: "performance",
  SERVER: "server",
};

function addConsoleHandler(opt_logger?: Logger) {
  let logger = opt_logger || logManager.root_;
  logger.addHandler(consoleHandler);
}

function removeConsoleHandler(opt_logger?: Logger) {
  let logger = opt_logger || logManager.root_;
  logger.removeHandler(consoleHandler);
}

function installConsoleHandler() {
  addConsoleHandler(logManager.root_);
}


class Preferences {
  private prefs_ = new Map<string, Level>();

  setLevel(type: string, level: Level | string | number) {
    if (typeof type !== 'string') {
      throw new TypeError(`specified log type is not a string: ${typeof type}`);
    }
    this.prefs_.set(type, level instanceof Level ? level : getLevel(level));
  }

  toJSON(): { [key: string]: string } {
    let json: { [key: string]: string } = {};
    for (let key of this.prefs_.keys()) {
      json[key] = this.prefs_.get(key).name;
    }
    return json;
  }
}


export {
  Entry,
  Level,
  LogManager,
  Logger,
  Preferences,
  Type,
  addConsoleHandler,
  getLevel,
  getLogger,
  installConsoleHandler,
  removeConsoleHandler,
};



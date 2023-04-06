'use strict';

const Realm = require("realm");
const { ObjectId } = require('bson');

// For performance purposes, we don't save each and every entry, but batch them in memory
// Too low, and we add a lot of traffic, too high and we risk losing too many entries if app crashes
const entryBatch = 5; 
const LogEntrySchema = {
  name: 'LogEntry',
  asymmetric: true,
  properties: {
    _id: 'objectId',
    appId: 'string',
    logLevel: 'int',
    logSessionId: 'objectId',
    message: 'string',
    timestamp: 'date',
    userId: 'string?',
  },
  primaryKey: '_id',
};

class RemoteLogger {
  constructor(logAppId, APIKey) {
    this.logAppId = logAppId;
    this.APIKey = APIKey;
    this.logApp = new Realm.App({ id: logAppId });
    this.entries = [];

    Realm.App.Sync.setLogLevel(this.logApp, "off");
  }

  async openRealm(user) {
    const config = {
      schema: [LogEntrySchema],
      sync: {
        user: user,
        flexible: true,
        clientReset: {  mode: Realm.ClientResetMode.RecoverUnsyncedChanges }
      },
    };
  
    return Realm.open(config);
  }
  
  flushEntries() {
    this.realm.write(() => {
      this.entries.forEach(element => {
        this.realm.create("LogEntry", element);
      });
    });

    this.entries = [];
  }

  addLogEntry(level, message) {
    let user = this.hostApp.currentUser.id;
    let logEntry = {
      _id: new ObjectId(),
      appId: this.hostApp.id,
      logLevel: level,
      logSessionId: this.logSessionId,
      message: message,
      timestamp: new Date(),
    };

    if (user && user.isLoggedIn) {
      logEntry.userId = user.id;
    }

    this.entries.push(logEntry);

    if (this.entries.length >= entryBatch) {
      this.flushEntries();
    }
  }

  async startLogging(app) {
    let user = this.logApp.currentUser;

    if (!user || !user.isLoggedIn) {
      user = await this.logApp.logIn(Realm.Credentials.apiKey(this.APIKey))
    }

    if (!user) {
      throw "Remote Logger User unavailable";
    }

    this.logSessionId = new ObjectId();

    this.hostApp = app;
    this.realm = await this.openRealm(user);

    Realm.App.Sync.setLogger(app, (level, message) => this.addLogEntry(level, message));
  }

  async stopLogging() {
    this.flushEntries();

    await this.realm.syncSession.uploadAllLocalChanges();

    this.realm.close();
  }
}

exports.RemoteLogger = RemoteLogger;

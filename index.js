#!/usr/bin/env node

const packageDetails = require('./package');
const fs = require("fs");
const ora = require('ora');
const Realm = require("realm");
const constants = require('./constants');
const minimist = require('minimist');
const { EJSON } = require('bson');
// const { logToFile, closeLog } = require('./logger');
const { RemoteLogger } = require('./RemoteLogger');

let app = null;

let realm;
let args = {};
let spinner = ora("Working…");
let remoteLogger = new RemoteLogger('remotelogging-ofhwn', 'IfnFnXI7oWSdbL0cbnd1i7aNAf72o2HtcHXs3nL1O5XDuf6R58GGjpLZP5hQISyA');

function fileExistsSync(file) {
  try {
    fs.accessSync(file, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function logWithDate(message) {
  let date = new Date();

  console.log(`[${date.toISOString()}] - ${message}`)
}

// General error handler: this will handle manual client reset,
// but is also needed if breaking changes are applied, as "discardLocal" won't be enough
function errorSync(session, error) {
  if (realm != undefined) {
    switch (error.name) {
      case 'ClientReset':
        const realmPath = realm.path;

        realm.close();

        logWithDate(`Error ${error.message}, need to reset ${realmPath}…`);
        Realm.App.Sync.initiateClientReset(app, realmPath);
        logWithDate(`Creating backup from ${error.config.path}…`);

        // Move backup file to a known location for a restore
        fs.renameSync(error.config.path, realmPath + '~');

        // Realm isn't valid anymore, notify user to exit
        realm = null;
        break;
      // TODO: Handle other cases…
      default:
        logWithDate(`Received error "${error.name}": ${error.message}`);
    }
  }
}

function compactOnLaunch(totalBytes, usedBytes) {
  let tenMB = 10485760;

  spinner.text = `Storage Realm: ${usedBytes} / ${totalBytes}`;

  if ((totalBytes > tenMB) && ((totalBytes - usedBytes) > tenMB)) {
    spinner.text = `Compacting Realm…`;

    return true;
  }

  return false;
}

function transferProgress(transferred, transferables) {
  if (transferables > 0) {
    if (transferred < transferables) {
      spinner.text = `Transferred ${transferred} of ${transferables}`;
    } else {
      logWithDate(`Transfer finished :  ${transferred} -> ${transferables}`);
    }
  }
}

async function restoreRealm() {
  if (!realm) { return; }

  let backupPath = realm.path + '~';

  if (fileExistsSync(backupPath) && constants.schemaName && constants.schemaName.length > 0) {
    let backupRealm = await Realm.open({ path: backupPath, readOnly: true });
    // This is highly dependent on the structure of the data to recover
    let backupObjects = backupRealm.objects(constants.schemaName);

    logWithDate(`Found ${backupObjects.length} ${constants.schemaName} objects in ${backupPath}, proceeding to merge…`);

    realm.beginTransaction();
    backupObjects.forEach(element => {
      realm.create(constants.schemaName, element, 'modified');
    });
    realm.commitTransaction();

    logWithDate(`Merge completed, deleting ${backupPath}…`);
    fs.unlinkSync(backupPath);
  }
}

async function openRealm(user) {
  try {
    const clientResetMode = constants.manualClientReset ?
      { mode: "manual" } :
      {
        mode: "discardLocal",
        // These callbacks do nothing here, but can be used to react to a Client Reset when in .discardLocal mode
        onBefore: (before) => {
          logWithDate(`Before a Client Reset for ${before.path})`);
        },
        onAfter: (before, after) => {
          logWithDate(`After a Client Reset for ${before.path} => ${after.path})`);
        }
      };
    const config = {
      shouldCompact: compactOnLaunch,
      sync: {
        user: user,
        partitionValue: constants.partitionValue,
        clientReset: clientResetMode,
        newRealmFileBehavior: { type: 'downloadBeforeOpen', timeOutBehavior: 'throwException' },
        existingRealmFileBehavior: { type: 'openImmediately', timeOutBehavior: 'openLocalRealm' },
        onError: errorSync
      }
    };

    if (constants.schemaClasses.length > 0) {
      config.schema = constants.schemaClasses;
    }

    if (args.clean) {
      Realm.deleteFile(config);
      logWithDate(`Cleaned realm ${constants.partitionValue}`);
    }

    logWithDate(`Opening realm with "${clientResetMode.mode}" Client Reset`);

    spinner.text = `Opening ${constants.partitionValue}…`;
    spinner.start();

    realm = await Realm.open(config);

    spinner.succeed(`Opened realm ${constants.partitionValue}`);

    // Add a progress function
    realm.syncSession.addProgressNotification('download', 'reportIndefinitely', transferProgress);

    // If a backup file exists, restore to the current realm, and delete file afterwards
    await restoreRealm();
  } catch (e) {
    spinner.fail(`${EJSON.stringify(e, null, 2)}`);
  }
}

function queryClasses(realm) {
  const realm_schema = realm.schema;

  var classes = [];

  for (const objSchema of realm_schema.sort((a, b) => a['name'] < b['name'])) {
    classes.push(objSchema);
  }

  return classes;
}

function trackClass(className) {
  let objects = realm.objects(className);

  logWithDate(`Got ${objects.length} ${className} objects`)

  /* Optional: add change listener
  function listener(objects, changes) {
    logWithDate(`Received ${changes.deletions.length} deleted, ${changes.insertions.length} inserted, ${changes.newModifications.length} updates on ${className}`);
  }

  objects.addListener(listener);
  */
}

function parseCLIParameters() {
  args = minimist(process.argv.slice(2));

  if (args.appId) {
    constants.appConfig.id = args.appId;
  } else {
    throw "App ID is undefined - please pass it in the command line '--appId=xxxx-yyyy'"
  }

  if (args.partition) {
    constants.partitionValue = args.partition.startsWith('{') ? EJSON.parse(args.partition) : args.partition;
  } else {
    throw "Partition value is undefined - please pass it in the command line '--partition=value'"
  }

  if (args.logLevel) {
    constants.logLevel = args.logLevel;
  }

  if (args.user) {
    constants.username = args.user;
  }

  if (args.password) {
    constants.password = args.password;
  }

  if (args.apiKey) {
    constants.userAPIKey = args.apiKey;
  }

  if (args.jwt) {
    constants.customJWT = args.jwt;
  }

  if (args.custom) {
    constants.customUser = args.custom;
  }
}

async function run() {
  try {
    parseCLIParameters();

    app = new Realm.App(constants.appConfig);
    // app = Realm.App.getApp(constants.appConfig.id);

    let user = app.currentUser;

    Realm.App.Sync.setLogLevel(app, constants.logLevel);
    // Realm.App.Sync.setLogger(app, (level, message) => logToFile(`(${level}) ${message}`));
    await remoteLogger.startLogging(app);

    if (args.clean && user && user.isLoggedIn) {
      await user.logOut();
    }

    if (!user || !user.isLoggedIn) {
      let credentials;

      if (constants.username.length > 0) {
        credentials = Realm.Credentials.emailPassword(constants.username, constants.password);
      } else if (constants.userAPIKey.length > 0) {
        credentials = Realm.Credentials.apiKey(constants.userAPIKey);
      } else if (constants.customJWT.length > 0) {
        credentials = Realm.Credentials.jwt(constants.customJWT);
      } else if (constants.customUser.length > 0) {
        credentials = Realm.Credentials.function({ name: constants.customUser });
      } else {
        credentials = Realm.Credentials.anonymous();
      }

      user = await app.logIn(credentials);

      logWithDate(`Logged in with the user: ${user.id}`);
    } else {
      logWithDate(`Skipped login with the user: ${user.id}`);
    }

    await openRealm(user);

    if (realm) {
      if (constants.schemaName && constants.schemaName.length > 0) {
        trackClass(constants.schemaName);
      } else {
        let synchedClasses = queryClasses(realm);

        for (const objSchema of synchedClasses) {
          if (!objSchema['embedded']) {
            trackClass(objSchema['name']);
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
    // user.logOut().then(() => console.error(error));
  } finally {
    setTimeout(async () => {
      if (realm) {
        realm.syncSession.removeProgressNotification(transferProgress);
        realm.close();
      }

      logWithDate("Done");

      // closeLog();
      await remoteLogger.stopLogging();

      process.exit(0);
    }, 5000);
  }
}

run().catch(console.dir);

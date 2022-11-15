## Realm for Node.js: best practices

This sample code illustrates some of the best practices suggested for the MongoDB Realm Node.js SDK with a Partition-based setup.

These include (but are not limited to):

- Use of `newRealmFileBehavior`  and `existingRealmFileBehavior` recommended policies
- Progress listener
- Handling of a client reset error, with code to recover objects added and/or updated client-side when Sync wasn't available
- An agnostic codebase: app ID, (optional) credentials and partition value are passed in as arguments, so in principle any Realm DB can be examined


## Usage

The general usage is
```
noderealmpractice [<parameters>]
```

### Parameters

#### --appId='\<appId>'

Sets the App ID (usually in the form _\<name>-abcde_) to connect to - **required**.

#### --partition='\<query or value>'

Partition **_value_** filter for the local DB, accepts an expression (for example `{"$oid": "61b19aa00787xxxxx00000xx"}`) that returns a **single** partition - **required**.

#### --user='\<username>'

Username to connect to the Realm app with (Email/Password authentication).

#### --password='\<password>'

Password related to the _user_ specified above.

#### --apiKey='\<API Key>'

Authenticates with API Key provider.

#### --jwt='\<JWT>'

Authenticates with Custom JWT Provider.

#### --custom='\<username>'

Authenticates with a Custom Function, passing this parameter as username.

#### --clean

Deletes a pre-existing local DB, logs out the current user, if any, and ensures a fresh copy is downloaded.

#### --logLevel='\<Log level>'

Sets the Log Level (i.e. 'info', 'debug', 'trace', …). The SDK log is collected in a separate file within the project folder.

## Install

As with every Node.js script, after checkout fetch the external modules:

```
cd <script folder>
npm install
```

To install the utility so that it can be invoked from the command line in a terminal:

```sh
cd <script folder>
# makes index.js executable
chmod ugo+x index.js
npm install -g
```

#### Disclaimer

The source code provided here is published in good faith and for general information purpose only. The author(s) and MongoDB Technical Support don't make any warranties about the completeness, reliability and accuracy of this information. Any action you take upon the provided code, and its use in conjunction with other code and libraries, is strictly at your own risk. The author(s) and MongoDB Technical Support will not be liable for any losses and/or damages in connection with the use of this code.

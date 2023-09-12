/* (C) 2023, stwissel, Apache-2.0 license */
'use strict';

const fs = require('fs');
const SSHConfig = require('ssh-config');
const ssh2 = require('ssh2');

let sshCfg;

/**
 * Reads synchronous the content of a text file
 * into a string
 * @param {string} source File name to read
 * @returns {string}
 */
const getStringFromFile = (source) => {
  try {
    const data = fs.readFileSync(source, {
      encoding: 'utf8',
      flag: 'r'
    });
    return data;
  } catch (e) {
    console.error(e);
  }
  return '';
};

/**
 * Extracts an SSH configuration from `~/.ssh/config`
 *
 * @returns {ssh configuration}
 */
const getSshCfg = () => {
  if (!sshCfg) {
    let fileName = process.env.HOME + '/.ssh/config';
    let cfgJson = getStringFromFile(fileName);
    sshCfg = SSHConfig.parse(cfgJson);
  }
  return sshCfg;
};

/**
 * Get the list of all Hosts configured
 * in the local SSH configuration
 *
 * @returns {Array<string>}
 */
const extractHosts = () => {
  let cfg = getSshCfg();
  let result = [];
  for (let entry of cfg) {
    if (entry.param == 'Host') {
      let valyes = entry.value;
      if (Array.isArray(valyes)) {
        for (let c of valyes) {
          result.push(c);
        }
      } else {
        result.push(valyes);
      }
    }
  }
  return result;
};

/**
 * Get the ssh configuration either from the manual
 * configuration or the .ssh/config file
 *
 * @param {NodeRED config object} config
 * @param {NodeRED message} msg
 * @param {string} password
 * @returns {ssh2 config object}
 */
const createConnectCfg = (node, config, msg, password) => {
  let host = msg.sshhost ? msg.sshhost : config.sshconfig;

  if (host == '-manual-') {
    node.debug('Using manual configuration');
    return {
      host: config.host,
      port: config.port,
      keepaliveInterval: 5000,
      username: config.username,
      password: password
    };
  }

  let cfg = getSshCfg();
  let hostCfg = cfg.compute(host);
  let fileName = hostCfg.IdentityFile[0]
    ? hostCfg.IdentityFile[0].replace('~', process.env.HOME)
    : undefined;
  node.debug(`Using ssh config file ${fileName}`);
  const ssh_config = {
    host: hostCfg.Hostname,
    port: hostCfg.Port ?? 22,
    keepaliveInterval: 5000,
    username: hostCfg.User
  };

  if (fileName) {
    try {
      ssh_config.privateKey = fs.readFileSync(fileName);
    } catch (e) {
      console.error(e);
    }
  }

  // Add password for user/pass or passphrase for key auth
  if (password) {
    if (fileName) {
      ssh_config.passphrase = password;
    } else {
      ssh_config.password = password;
    }
  }
  return ssh_config;
};

/**
 * Creates an SSH client with listeners
 * for all events including incoming data stream
 *
 * @param {NodeRED node} node
 * @param {sshState} state
 * @returns {sshClient}
 */
const createClient = (node, state) => {
  let host = state.ssh_config.host;
  let Client = ssh2.Client;
  let conn = new Client();

  conn
    .on('error', (e) => {
      errorStatus(node, host, e);
      conn.end();
      state.connection = undefined;
      node.stream = undefined;
    })
    .on('ready', () => {
      connectStatus(node, host);
      state.connected = true;

      conn.shell(function (err, stream) {
        if (err) {
          node.error('ERRSHELL', { errMsg: err });
          conn.end();
          state.connection = undefined;
          return;
        }

        node.debug('Shell opened');

        node.stream = stream;

        stream
          .on('close', function () {
            closeStatus(node, host, 'close');
            state.connection = undefined;
            node.stream = undefined;
          })
          .on('error', function (error) {
            errorStatus(node, host, error);
          })
          .on('data', function (data) {
            connectStatus(node, host);
            node.send({ host: host, payload: data });
          })
          .stderr.on('data', function (data) {
            connectStatus(node, host);
            node.send({ host: host, payload: data, stderr: true });
          });

        while (state.queue.length > 0) {
          let d = state.queue.shift();
          stream.write(d);
        }
      });
    })
    .on('close', function () {
      closeStatus(node, host, 'close');
      state.connection = undefined;
      node.stream = undefined;
    })
    .on('end', function () {
      closeStatus(node, host, 'end');
      state.connection = undefined;
      node.stream = undefined;
    })
    .connect(state.ssh_config);

  return conn;
};
/**
 * Processes an incoming messsage, establish the
 * connection to ssh host and sends data async
 *
 * @param {NodeRED node} node
 * @param {NodeRED config} config
 * @param {sshState} state
 * @param {NodeRED message} msg
 * @param {string} password
 * @returns
 */
const processMessage = (node, config, state, msg, passwordCandidate) => {
  const data = msg.payload;

  // Check if host was overwritten and needs reconnect
  const msghost = msg.sshhost;
  const password = msg.hasOwnProperty('sshpassword')
    ? msg.sshpassword
    : passwordCandidate;
  if (!state.ssh_config || (msghost && msghost != state.lastHost)) {
    state.ssh_config = createConnectCfg(node, config, msg, password);
    if (state.connection) {
      state.connection.end();
      state.connection = undefined;
    }
  }

  // (Re)build the client
  if (!state.connection) {
    node.debug('Create new client');
    state.queue.push(data);
    state.connection = createClient(node, state);
    return;
  }

  if (!node.stream) {
    node.debug('Queuing up data');
    state.queue.push(data);
    return;
  }

  try {
    if (node.stream.writable) {
      node.stream.write(data);
    } else {
      node.error('Stream not currently writable. Try again.', {
        errmsg: 'Stream not currently writable. Try again.'
      });
    }
  } catch (e) {
    node.error('Error writing to stream', { errmsg: e });
  }
};

/**
 * Shortcut to register an error
 * snd display a red dot
 *
 * @param {NodeRED node} node
 * @param {string} host
 * @param {Error} e
 */
const errorStatus = (node, host, e) => {
  node.error(`Connection error`, { errMsg: e, host: host });
  node.status({ fill: 'red', shape: 'ring', text: `error ${e}` });
};

/**
 * Shortcut show connected green dot
 *
 * @param {NodeRED node} node
 * @param {string} host
 */
const connectStatus = (node, host) => {
  node.log(`SSH Connected ${host}`);
  node.status({
    fill: 'green',
    shape: 'dot',
    text: `connected ${host}!`
  });
};

/**
 * Shortcut to show disconnected state
 *
 * @param {NodeRED node} node
 * @param {string} host
 * @param {string} reason
 */
const closeStatus = (node, host, reason) => {
  node.log(`${reason}: Socket was disconnected from ${host}`);
  node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
};

module.exports = {
  extractHosts: extractHosts,
  getSshCfg: getSshCfg,
  createConnectCfg: createConnectCfg,
  errorStatus: errorStatus,
  connectStatus: connectStatus,
  closeStatus: closeStatus,
  createClient: createClient,
  processMessage: processMessage
};

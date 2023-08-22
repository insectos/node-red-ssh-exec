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
  const data = fs.readFileSync(source, {
    encoding: 'utf8',
    flag: 'r'
  });
  return data;
};

const getSshCfg = () => {
  if (!sshCfg) {
    let fileName = process.env.HOME + '/.ssh/config';
    let cfgJson = getStringFromFile(fileName);
    sshCfg = SSHConfig.parse(cfgJson);
  }
  return sshCfg;
};

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

const createConnectCfg = (config, msg, password) => {
  let host = msg.sshhost ? msg.sshhost : config.sshconfig;

  if (host == '-manual-') {
    console.log('Using manual configuration');
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
  let fileName = hostCfg.IdentityFile[0].replace('~', process.env.HOME);
  console.log(`Using ssh config file ${fileName}`);
  const ssh_config = {
    host: hostCfg.Hostname,
    port: hostCfg.Port ?? 22,
    keepaliveInterval: 5000,
    username: hostCfg.User,
    privateKey: fs.readFileSync(fileName)
  };
  if (password) {
    ssh_config.passphrase = password;
  }
  return ssh_config;
};

// Create the client with event listeners
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

        console.log('Shell opened');

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

      // TODO: data
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

const processMessage = (node, config, state, msg, password) => {
  const data = msg.payload;

  // Check if host was overwritten and needs reconnect
  const msghost = msg.sshhost;
  if (!state.ssh_config || (msghost && msghost != state.lastHost)) {
    state.ssh_config = createConnectCfg(config, msg, password);
    if (state.connection) {
      state.connection.end();
      state.connection = undefined;
    }
  }

  // (Re)build the client
  if (!state.connection) {
    console.log('Create new client');
    state.queue.push(data);
    state.connection = createClient(node, state);
    return;
  }

  if (!node.stream) {
    console.log('Queuing up data');
    state.queue.push(data);
    return;
  }

  try {
    if (node.stream.writable) {
      node.stream.write(data);
    } else {
      console.log('Stream not currently writable. Try again.');
      node.error('Stream not currently writable. Try again.', {
        errmsg: 'Stream not currently writable. Try again.'
      });
    }
  } catch (e) {
    node.error('Error writing to stream', { errmsg: e });
  }
};

const errorStatus = (node, host, e) => {
  console.log(`Connection error: ${e.errno} ${e}`);
  node.error(`Connection error`, { errMsg: e, host: host });
  node.status({ fill: 'red', shape: 'ring', text: `error ${e}` });
};

const connectStatus = (node, host) => {
  console.log(`SSH Connected ${host}`);
  node.status({
    fill: 'green',
    shape: 'dot',
    text: `connected ${host}!`
  });
};

const closeStatus = (node, host, reason) => {
  console.log(`${reason}: Socket was disconnected from ${host}`);
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

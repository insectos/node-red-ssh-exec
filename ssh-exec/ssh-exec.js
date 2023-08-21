'use strict';

const utils = require('./utils');

const debug = true;
const minTimeout = 500;
const maxTimeout = 1000 * 60 * 20; // 20 minutes

// Create the client with event listeners
const createClient = (node, state) => {
  let host = state.ssh_config.host;
  let Client = require('ssh2').Client;
  let conn = new Client();

  conn
    .on('error', (e) => {
      utils.errorStatus(node, host, e);
      conn.end();
      state.connection = undefined;
      node.stream = undefined;
    })
    .on('ready', () => {
      utils.connectStatus(node, host);
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
            utils.closeStatus(node, host, 'close');
            state.connection = undefined;
            node.stream = undefined;
          })
          .on('error', function (error) {
            utils.errorStatus(node, host, error);
          })
          .on('data', function (data) {
            utils.connectStatus(node, host);
            node.send({ host: host, payload: data });
          })
          .stderr.on('data', function (data) {
            utils.connectStatus(node, host);
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
      utils.closeStatus(node, host, 'close');
      state.connection = undefined;
      node.stream = undefined;
    })
    .on('end', function () {
      utils.closeStatus(node, host, 'end');
      state.connection = undefined;
      node.stream = undefined;
    })
    .connect(state.ssh_config);

  return conn;
};

module.exports = function (RED) {
  /* ssh connection */
  function SshExec(config) {
    RED.nodes.createNode(this, config);
    let node = this;

    let state = {
      connection: undefined,
      lastHost: config.host,
      ssh_config: undefined,
      queue: []
    };

    node.on('input', function (msg) {
      const data = msg.payload;

      // Check if host was overwritten and needs reconnect
      const msghost = msg.sshhost;
      if (!state.ssh_config || (msghost && msghost != state.lastHost)) {
        state.ssh_config = utils.createConnectCfg(config, msg);
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
    });

    node.on('close', function (done) {
      state.connected = false;
      node.stream.removeAllListeners();
      node.stream.end('bye\r\n');
      conn.removeAllListeners();
      conn.end();
      node.status({});
      done();
    });
  }

  RED.nodes.registerType('ssh-exec', SshExec, {
    settings: {
      sshExecHosts: {
        value: utils.extractHosts(),
        exportable: true
      }
    }
  });
};

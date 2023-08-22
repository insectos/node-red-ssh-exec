/* (C) 2023, stwissel, Apache-2.0 license */
'use strict';

const utils = require('./utils');

module.exports = function (RED) {
  /* ssh connection */
  function SshExec(config) {
    RED.nodes.createNode(this, config);
    let password = this.credentials.pass;
    let node = this;

    let state = {
      connection: undefined,
      lastHost: config.host,
      ssh_config: undefined,
      queue: []
    };

    node.on('input', function (msg) {
      utils.processMessage(node, config, state, msg, password);
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
    credentials: {
      pass: { type: 'password' }
    },
    settings: {
      sshExecHosts: {
        value: utils.extractHosts(),
        exportable: true
      }
    }
  });
};

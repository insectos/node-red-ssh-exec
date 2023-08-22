/* (C) 2023, stwissel, Apache-2.0 license */
'use strict';

const utils = require('./utils');

module.exports = function (RED) {
  /* ssh connection */
  function SshExec(config) {
    RED.nodes.createNode(this, config);
    let password = this.credentials.pass;
    let node = this;

    /**
     * Tracking connection, last host,
     * configuration settings and command queue
     */
    let state = {
      connection: undefined,
      lastHost: config.host,
      ssh_config: undefined,
      queue: []
    };

    utils.closeStatus(node, config.host, 'restart');

    node.on('input', (msg) => {
      utils.processMessage(node, config, state, msg, password);
    });

    node.on('close', (done) => {
      if (node.stream) {
        node.stream.removeAllListeners();
        node.stream.end('bye\r\n');
      }
      if (state.connection) {
        state.connection.removeAllListeners();
        state.connection.end();
      }
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

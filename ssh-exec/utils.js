'use strict';

const fs = require('fs');
const SSHConfig = require('ssh-config');

let sshCfg;

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

const createConnectCfg = (config, msg) => {
  let host = msg.sshhost ? msg.sshhost : config.sshconfig;

  if (host == '-manual-') {
    console.log('Using manual configuration');
    return {
      host: config.host,
      port: config.port,
      keepaliveInterval: 5000,
      username: config.username,
      password: config.pass
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
  if (config.pass) {
    ssh_config.password = config.pass;
  }
  return ssh_config;
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
  closeStatus: closeStatus
};

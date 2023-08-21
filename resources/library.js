/* (C) 2023 @notessensei MIT license */
'use strict';

const getHostList = (RED) => {
  console.log('getHostList called');
  let hosts = RED.settings.sshExecHosts;
  let options = [];
  options.push({ value: '-manual-', label: 'manual Host confguration' });
  for (let h of hosts) {
    options.push({ value: h, label: h });
  }

  return {
    types: [
      {
        value: '-manual-',
        options: options
      }
    ]
  };
};

// Export the function to be accessible in other files
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    getHostList: getHostList
  };
}

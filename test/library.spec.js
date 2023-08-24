'use strict';

const chai = require('chai');
const expect = chai.expect;
const library = require('../resources/library');

describe('Library function', () => {
  it('should return host list', () => {
    let red = {
      settings: {
        sshExecHosts: ['red', 'blue', 'green']
      }
    };
    let hosts = library.getHostList(red);
    expect(hosts.types[0].options).to.have.length(4);
  });
});

'use strict';

const chai = require('chai');
const expect = chai.expect;
const library = require('../resources/library');

describe('Library function', function () {
  it('should return host list', function () {
    let red = {
      settings: {
        interactiveSshHosts: ['red', 'blue', 'green']
      }
    };
    let hosts = library.getHostList(red);
    expect(hosts.types[0].options).to.have.length(4);
  });
});

/* (C) 2023, stwissel, Apache-2.0 license */
'use strict';

const chai = require('chai');
const { MockNode } = require('./mockobjects');
const utils = require('../ssh-exec/utils');
const expect = chai.expect;

describe('Testing log and status', () => {
  let node;

  beforeEach(() => {
    node = new MockNode();
  });
  it('should log the close status message', () => {
    utils.closeStatus(node, 'horst', 'unittest');
    expect(node.calledEndpoints.log).to.equal(
      'unittest: Socket was disconnected from horst'
    );
  });

  it('should update the close status', () => {
    utils.closeStatus(node, 'horst', 'unittest');
    let status = node.calledEndpoints.status;
    expect(status.text).to.equal('disconnected');
    expect(status.fill).to.equal('red');
    expect(status.shape).to.equal('ring');
  });

  it('should update the connect status', () => {
    utils.connectStatus(node, 'horst', 'unittest');
    let status = node.calledEndpoints.status;
    expect(status.text).to.equal('connected horst!');
    expect(status.fill).to.equal('green');
    expect(status.shape).to.equal('dot');
    expect(node.calledEndpoints.log).to.equal('SSH Connected horst');
  });
});

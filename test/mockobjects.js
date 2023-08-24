/* (C) 2023, stwissel, Apache-2.0 license */
'use strict';

class MockNode {
  calledEndpoints;

  constructor() {
    this.calledEndpoints = {};
  }

  log(msg) {
    this.calledEndpoints.log = msg;
  }

  status(msg) {
    this.calledEndpoints.status = msg;
  }
}

module.exports = {
  MockNode: MockNode
};

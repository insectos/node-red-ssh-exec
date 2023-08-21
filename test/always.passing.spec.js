const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;

chai.use(chaiAsPromised);

describe('These tests', function () {
  it('should always pass', function () {
    expect(1).to.equal(1);
  });

  const p = new Promise((resolve) => {
    setTimeout(() => resolve(42), 100);
  });
  it('also the promise should always pass', function (done) {
    expect(p).to.eventually.be.eql(42).notify(done);
  });
});

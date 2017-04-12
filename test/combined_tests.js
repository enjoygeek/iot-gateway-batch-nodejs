
(function () {
    'use strict';
    require('mocha-jshint')({
        pretty: true
    });
    require('mocha-sinon');

    var sinonChai = require("sinon-chai");
    var sinon = require('sinon');
    var chai = require('chai');
    chai.use(sinonChai);

    var expect = chai.expect;

    var batcher = require('../batch');
    var shredder = require('../shred');

    describe('Piping data through the batcher and onto the shredder', function () {

        var messageBroker = { publish: sinon.spy() };

        before((done) => {
            sinon.spy(console, 'log');
            done();
        });

        beforeEach((done) => {
            batcher.create(messageBroker, { batchCount: 5 });
            shredder.create(messageBroker, null);
            done();
        });

        after((done) => {
            console.log.restore();
            done();
        });

        afterEach((done) => {
            console.log.reset();
            messageBroker.publish.reset();
            done();
        });

        it('should call messageBus.publish 6 times.', () => {
            const content = "this is some content";
            var message = { properties: { macAddress: "01:01:01:01:01" }, content: (new Uint8Array(Buffer.from(content))) };
            var messageArray = [];
            for (let i = 0; i < 5; i++) {
                // clone message
                messageArray.push(message);
            }
            //console.log(messageArray);
            messageArray.forEach((msg) => { batcher.receive(msg); });
            var batched = messageBroker.publish.args[0][0];
            shredder.receive(batched);
            expect(messageBroker.publish.callCount).to.eql(6);
            for (let i = 1; i < 6; i++) {
                expect(Buffer.from(messageBroker.publish.args[i][0].content).toString()).to.eql(content);
            }
        });
    });

}());

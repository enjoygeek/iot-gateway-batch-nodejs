
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

    var shredder = require('../shred');

    describe('calling shredder.destroy', function () {

        before(function (done) {
            sinon.spy(console, 'log');
            done();
        });

        after(function (done) {
            console.log.restore();
            done();
        });

        it('should log module destruction.', function (done) {
            shredder.destroy();
            expect(console.log.calledOnce).to.be.true;
            expect(console.log.calledWith('shredder.destroy')).to.be.true;
            done();
        });

    });

    describe('calling shredder.receive with un-batched data', () => {

        var messageBroker = { publish: sinon.spy() };
        var localContent = new Uint8Array(Buffer.from('{"prop":"value"}'));

        before((done) => {
            sinon.spy(console, 'log');
            done();
        });

        beforeEach((done) => {
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

        it('should post a content only message back to the bus.', () => {
            var msg = { content: localContent };
            shredder.receive(msg);
            var published = messageBroker.publish.args[0][0];
            expect(msg).to.equal(published);
        });

        it('should post a message without a batched property bact to the bus', () => {
            var msg = { properties: {}, content: localContent };
            shredder.receive(msg);
            var published = messageBroker.publish.args[0][0];
            expect(msg).to.equal(published);
        });

        it('should post a message without a batched property set to true bact to the bus', () => {
            var msg = { properties: { batched: false }, content: localContent };
            shredder.receive(msg);
            var published = messageBroker.publish.args[0][0];
            expect(msg).to.equal(published);
        });

        it('should post a message without a content property bact to the bus', () => {
            var msg = { properties: { batched: true } };
            shredder.receive(msg);
            var published = messageBroker.publish.args[0][0];
            expect(msg).to.equal(published);
        });

        it('should post a message with content not as an array bact to the bus', () => {
            var msg = { properties: { batched: true }, content: localContent };
            shredder.receive(msg);
            var published = messageBroker.publish.args[0][0];
            expect(msg).to.equal(published);
        });

        it('should thow when the content is not valid json', () => {
            var msg = { properties: { batched: true }, content: '{broken:"json"' };
            expect(() => { shredder.receive(msg); }).to.throw(SyntaxError, 'Unexpected token b in JSON at position 1');
        });

    });


    describe('calling shredder.receive with batched data', () => {

        var messageBroker = { publish: sinon.spy() };

        before((done) => {
            sinon.spy(console, 'log');
            done();
        });

        beforeEach((done) => {
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

        it('should call messageBus.publish once.', () => {

            var message = '[{"properties":{"macAddress":"1"},"content":"[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]"}}';
            shredder.receive(message);
            expect(messageBroker.publish.calledOnce).to.be.true;

        });

        it('should publish expected message to message bus', () => {

            // macAddress increments
            var expected = '[{"properties":{"macAddress":"1"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"2"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"3"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"4"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"5"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"6"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"7"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"8"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"9"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"1"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]}]';

            var message = { properties: { batched: true }, content: new Uint8Array(Buffer.from(expected)) };
            shredder.receive(message);
            expect(messageBroker.publish.callCount).to.eql(10);
            for (var i = 0; i < 5; i++) {
                expect(messageBroker.publish.args[i][0].properties.macAddress).to.equal((i + 1).toString());
            }

        });
    });

}());

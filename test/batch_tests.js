
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

    const content = "this is some content";

    let restoreBatcher = () => {
        batcher.messageBus = null;
        batcher.configuration = null;
        batcher.deviceMessageArray = null;
        batcher.excluded = null;
        batcher.batchCount = null;
        batcher.publishAsDevice = null;
    };

    describe('calling batcher.destroy', function () {

        var messageBroker = { publish: sinon.spy() };
        var buffer = new Uint8Array(Buffer.from(content));

        before((done) => {
            sinon.spy(console, 'log');
            done();
        });

        beforeEach((done) => {
            batcher.create(messageBroker, { batchCount: 10 });
            done();
        });

        after((done) => {
            restoreBatcher();
            console.log.restore();
            done();
        });

        afterEach((done) => {
            console.log.reset();
            messageBroker.publish.reset();
            done();
        });

        it('should log module destruction.', () => {
            batcher.destroy();
            expect(console.log.calledOnce).to.be.true;
            expect(console.log.calledWith('batcher.destroy')).to.be.true;
        });

        it('should drain all device message queues', () => {
            [{ properties: { macAddress: "01:01:01" }, content: [] },
            { properties: { deviceId: "demoDeviceId" }, content: [] }]
                .map(function (msg) { batcher.receive(msg); });
            batcher.destroy();
            expect(messageBroker.publish.calledTwice).to.be.true;
        });

        it('should drain all device message queues and ', () => {
            [{ properties: { macAddress: "01:01:01" }, content: [] },
            { properties: { deviceId: "demoDeviceId" }, content: [] }]
                .map(function (msg) { batcher.receive(msg); });
            batcher.destroy();
            expect(messageBroker.publish.calledTwice).to.be.true;
        });

        it('should publish a message with uint8Array content to message bus.', () => {

            var expected = '[{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]}]';

            [{ properties: { macAddress: "01:01:01" }, content: buffer }].forEach((msg) => batcher.receive(msg));
            batcher.destroy();
            expect(messageBroker.publish.calledOnce).to.be.true;
            var batched = messageBroker.publish.args[0][0];
            var batchedContent = Buffer.from(batched.content).toString();
            expect(batchedContent).to.eql(expected);

        });
    });

    describe('calling applyPublishAsProperties with a message', () => {

        var messageBroker = { publish: sinon.spy() };

        after((done) => {
            restoreBatcher();
            done();
        });

        it('should pass the message properties through when there is no publishAsDevice in the configuration', () => {
            batcher.create(messageBroker, { batchCount: 10 });
            var message = { properties: { randomProperties: "value" }, content: [] };
            var properties = batcher.applyPublishAsProperties(message);
            expect(properties.randomProperties).to.eq("value");
        });

        it('should not have a batched property set to true', () => {
            batcher.create(messageBroker, { batchCount: 10 });
            var message = { properties: { randomProperties: "value" }, content: [] };
            var properties = batcher.applyPublishAsProperties(message);
            expect(properties.batched).to.eq(true);
        });

        it('should assign just the macAddress property when the macAddress property is set in the publishAsDevice section of the configuration', () => {
            batcher.create(messageBroker, { batchCount: 10, publishAsDevice: { macAddress: "macAddress" } });
            var message = { properties: { randomProperties: "value" }, content: [] };
            var properties = batcher.applyPublishAsProperties(message);
            expect(properties.macAddress).to.eq("macAddress");
            expect(properties.randomProperties).to.eq("value");
        });

        it('should assign just the deviceKey and deviceId properties when the deviceKey and deviceId properties are set in the publishAsDevice section of the configuration', () => {
            batcher.create(messageBroker, { batchCount: 10, publishAsDevice: { deviceId: "deviceId", deviceKey: "deviceKey" } });
            var message = { properties: { randomProperties: "value" }, content: [] };
            var properties = batcher.applyPublishAsProperties(message);
            expect(properties.deviceId).to.eq("deviceId");
            expect(properties.deviceKey).to.eq("deviceKey");
            expect(properties.randomProperties).to.eq("value");
        });
    });

    describe('calling batcher.receive with a simple string', () => {

        var messageBroker = { publish: sinon.spy() };

        before((done) => {
            sinon.spy(console, 'log');
            done();
        });

        beforeEach((done) => {
            batcher.create(messageBroker, { batchCount: 10 });
            done();
        });

        after((done) => {
            console.log.restore();
            restoreBatcher();
            done();
        });

        afterEach((done) => {
            console.log.reset();
            messageBroker.publish.reset();
            done();
        });

        it('should not error.', () => {
            var message = { content: content };
            expect(batcher.receive(message)).to.not.throw;
        });

        it('should bypass batch processing and call messageBus.publish once.', () => {
            var message = { content: content };
            batcher.receive(message);
            expect(messageBroker.publish.calledOnce).to.be.true;
        });

    });

    describe('initializing the batcher', () => {

        var messageBroker = { publish: sinon.spy() };

        before((done) => {
            sinon.spy(console, 'log');
            done();
        });

        after((done) => {
            console.log.restore();
            restoreBatcher();
            done();
        });

        afterEach((done) => {
            console.log.reset();
            done();
        });

        it('should return false and log to console if the message bus is undefined.', () => {
            expect(batcher.create(null, { batchCount: 10 })).to.be.false;
            expect(console.log.calledWith(batcher.createModuleErrorMessage)).to.be.true;
        });

        it('should return false and log to console if the configuration is undefined.', () => {
            expect(batcher.create(messageBroker, null)).to.be.false;
            expect(console.log.calledWith(batcher.createModuleErrorMessage)).to.be.true;
        });

        it('should return false and log to console if the batchCount in the configuration file is undefined.', () => {
            expect(batcher.create(messageBroker, { someOtherSetting: 10 })).to.be.false;
            expect(console.log.calledWith(batcher.batchCountErrorMessage)).to.be.true;
        });

        it('should return false and log to console if the publishAs is missing internal components.', () => {
            expect(batcher.create(messageBroker, { batchCount: 1, publishAsDevice: 10 })).to.be.false;
            expect(console.log.calledWith(batcher.publishAsConfigurationError)).to.be.true;
        });

        it('should return true if the publishAs macAddress is set.', () => {
            expect(batcher.create(messageBroker, { batchCount: 1, publishAsDevice: { macAddress: "01:01:01" } })).to.be.true;
        });

        it('should return true if the publishAs deviceId & deviceKey is set.', () => {
            expect(batcher.create(messageBroker, { batchCount: 1, publishAsDevice: { deviceId: "deviceId", deviceKey: "deviceKey" } })).to.be.true;
        });

        it('should return false if the publishAs deviceKey is not set.', () => {
            expect(batcher.create(messageBroker, { batchCount: 1, publishAsDevice: { deviceId: "deviceId" } })).to.be.false;
            expect(console.log.calledWith(batcher.publishAsConfigurationError)).to.be.true;
        });

        it('should return false if the publishAs deviceId is not set.', () => {
            expect(batcher.create(messageBroker, { batchCount: 1, publishAsDevice: { deviceKey: "deviceKey" } })).to.be.false;
            expect(console.log.calledWith(batcher.publishAsConfigurationError)).to.be.true;
        });

        it('should return true if everything is configured correctly.', () => {
            expect(batcher.create(messageBroker, { batchCount: 10 })).to.be.true;
        });
    });

    describe('passing a list of messages to batcher.receive ', () => {

        var messageBroker = { publish: sinon.spy() };
        var buffer = new Uint8Array(Buffer.from(content));

        beforeEach(function (done) {
            batcher.create(messageBroker, { batchCount: 10 });
            done();
        });

        afterEach((done) => {
            messageBroker.publish.reset();
            done();
        });

        after((done) => {
            restoreBatcher();
            done();
        });

        it('should publish a message to message bus.', () => {

            var expected = '[{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},{"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]}]';

            var messages = [];
            for (var i = 0; i < 11; i++) {
                messages.push({ properties: { macAddress: "01:01:01" }, content: buffer });
            }

            messages.forEach((msg) => batcher.receive(msg));
            expect(messageBroker.publish.calledOnce).to.be.true;

            var batched = messageBroker.publish.args[0][0];
            var batchedContent = Buffer.from(batched.content).toString();
            expect(batchedContent).to.eql(expected);

        });

    });

    describe('passing a list of messages to batcher.stashMessage', () => {

        var buffer = Buffer.from(content);

        beforeEach(function (done) {
            done();
        });

        afterEach((done) => {
            done();
        });

        after((done) => {
            restoreBatcher();
            done();
        });

        it('should publish a message to message bus.', () => {

            var messages = [];
            var batchCount = 10;
            for (let i = 0; i < 10; i++) {
                messages.push({ properties: { macAddress: "01:01:01" }, content: buffer });
            }

            messages.map((msg) => {
                return batcher.stashMessage(msg, batchCount, []);

            }).forEach((msg, key) => {

                if (((key + 1) % batchCount) === 0) {
                    expect(msg.properties.batched).to.be.true;

                } else {
                    expect(msg).to.be.null;
                }
            });
        });

    });

    describe('when passing a message to the module.receive', () => {

        var messageBroker = { publish: sinon.spy() };

        beforeEach(function (done) {
            done();
        });

        afterEach((done) => {
            messageBroker.publish.reset();
            done();
        });

        after((done) => {
            restoreBatcher();
            done();
        });

        it('should pass through when the macAddress is in the exclude list.', () => {
            batcher.create(messageBroker, { batchCount: 10, excluded: ["01:01:01", "otherMac"] });
            [{ properties: { macAddress: "01:01:01" }, content: [] }]
                .map(function (msg) { batcher.receive(msg); });
            expect(messageBroker.publish.calledOnce).to.be.true;
        });

        it('should be queued when the macAddress is not in the exclude list.', () => {
            batcher.create(messageBroker, { batchCount: 10, excluded: ["otherMac"] });
            [{ properties: { macAddress: "01:01:01" }, content: [] }]
                .map(function (msg) { batcher.receive(msg); });
            expect(messageBroker.publish.notCalled).to.be.true;
        });

        it('should pass through when the deviceId is in the exclude list.', () => {
            batcher.create(messageBroker, { batchCount: 10, excluded: ["deviceID", "otherDeviceID"] });
            [{ properties: { deviceId: "deviceID" }, content: [] }]
                .map(function (msg) { batcher.receive(msg); });
            expect(messageBroker.publish.calledOnce).to.be.true;
        });

        it('should be queued when the deviceId is not in the exclude list.', () => {
            batcher.create(messageBroker, { batchCount: 10, excluded: ["otherDeviceId"] });
            [{ properties: { macAddress: "deviceID" }, content: [] }]
                .map(function (msg) { batcher.receive(msg); });
            expect(messageBroker.publish.notCalled).to.be.true;
        });
    });
}());

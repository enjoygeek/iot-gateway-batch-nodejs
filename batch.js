'use strict';

module.exports = {
    // associative array to hold messages per device.
    deviceMessageArray: null,

    // dependecies
    messageBus: null,
    configuration: null,
    batchCount: null,

    // list of devices to exclude from batch processing.
    excluded: null,
    // identifier to optionally re-publish batched messages as.
    publishAsDevice: null,

    // helper function to ensure that Uint8Arrays are handled properly
    // by JSON.stringify and don't produce an associative array.
    UInt8ArrayFormatter: function (key, value) {
        if (value instanceof Uint8Array) {
            return Array.from(value);
        }
        return value;
    },

    // publish the aggregated messages using the properties from the last
    // messages for this batch.  This should allow most IoT Hub routing
    // rules to continue to play nicely.
    applyPublishAsProperties: function (message) {

        var properties = message.properties;

        // add message property indicating that this message is batched.
        properties.batched = true;

        // if we are using a publish as identity replace the key elements.
        if (this.publishAsDevice) {
            if (this.publishAsDevice.macAddress) {
                properties.macAddress = this.publishAsDevice.macAddress;
            }
            else if (this.publishAsDevice.deviceKey && this.publishAsDevice.deviceId) {
                properties.deviceId = this.publishAsDevice.deviceId;
                properties.deviceKey = this.publishAsDevice.deviceKey;
            }
        }

        return properties;
    },


    stashMessage: function (message, batchCount, excluded) {

        // ensure existatnce of a message an batch count in the 
        // event that this module is used outside the context of 
        // the gateway. 
        if (!(message) || !(batchCount)) {
            throw new Error('message & batchCount must be supplied');
        }

        // ensure device message array is properly instanciated in the 
        // event that this module is used outside the context of 
        // the gateway.
        if (!(this.deviceMessageArray)) {
            this.deviceMessageArray = {};
        }

        // does the message have a macAddress or deviceID property?
        if (message.properties && (message.properties.macAddress || message.properties.deviceId)) {

            // establish a good identifier for the message. This is based 
            // on whether or not this module was placed before or after
            // the Identity Map module.
            var identifier = message.properties.macAddress ?
                message.properties.macAddress :
                message.properties.deviceId;

            // if the identifier is in our excluded list just return the message
            // for republishing onto the bus.
            if (excluded && excluded.indexOf(identifier) >= 0) {
                return message;
            }

            // map the available identifiers
            if (message.properties.macAddress in this.deviceMessageArray) {
                identifier = message.properties.macAddress;
            }
            else if (message.properties.deviceId in this.deviceMessageArray) {
                identifier = message.properties.macAddress;
            }
            else {
                // the identifier was not available in the device 
                // message array so add a new entry. 
                this.deviceMessageArray[identifier] = [];
            }

            // push message onto device message array
            this.deviceMessageArray[identifier].push(message);

            // if we are at the threshold, stringify the messages and push to the broker.
            if (this.deviceMessageArray[identifier].length >= batchCount) {

                // stringify the message and provide a custom handler to 
                // deal with Uint8Arrays.
                var batch = JSON.stringify(this.deviceMessageArray[identifier], this.UInt8ArrayFormatter);

                // apply the published as device settings (if enabled)
                var batchedMessageProperties = this.applyPublishAsProperties(message);

                var repackaged = {
                    properties: batchedMessageProperties,
                    content: new Uint8Array(Buffer.from(batch))
                };

                // reset buffer array to 0
                this.deviceMessageArray[identifier].length = 0;

                return repackaged;
            }
            // message has been batched. return null
            return null;
        }
        // else publish all messages with a macAddress or deviceId property back to the bus.
        else {
            return message;
        }
    },

    // establish default error messages for instantiation of the module.
    createModuleErrorMessage: "The `messageBus` and/or `configuration` parameters passed to `module.create` were undefined.",
    batchCountErrorMessage: "This module requires `batchCount` argument to be present in the module\'s configuration.",
    publishAsConfigurationError: "The `publish as device` configuration section must include either a `macAddress` value or, `deviceId` and `devicekey` values.",

    // this function is called for module creation in the context of 
    // the gateway.
    create: function (messageBus, configuration) {
        this.excluded = [];
        this.messageBus = messageBus;
        this.configuration = configuration;

        // validate that messageBus and configuration are not undefined.
        if (this.messageBus && this.configuration) {

            // only required element of config is batchCount
            if (this.configuration.batchCount) {

                this.deviceMessageArray = {};
                this.batchCount = this.configuration.batchCount;
                this.excluded = this.configuration.excluded;

                // validate publish as configuration if present.
                if (this.configuration.publishAsDevice && (this.configuration.publishAsDevice.macAddress || (this.configuration.publishAsDevice.deviceId && this.configuration.publishAsDevice.deviceKey))) {

                    this.publishAsDevice = this.configuration.publishAsDevice;

                } else if (this.configuration.publishAsDevice) {
                    // close publish as device check
                    console.log(this.publishAsConfigurationError);
                    return false;
                }
                // return true;

            } else {
                // close batch count check 
                console.log(this.batchCountErrorMessage);
                return false;
            }
            // return true;

        } else {
            // close message bus & configuration check
            console.log(this.createModuleErrorMessage);
            return false;
        }

        // module creation was successful
        return true;
    },

    // this function is for receiving messages from a message bus in the
    // context of the gateway.
    receive: function (message) {
        var msg = this.stashMessage(message, this.batchCount, this.excluded);
        if (msg) {
            this.messageBus.publish(msg);
        }
    },

    // this function is called by the gateway during shutdown.  It will 
    // drain any messages that are pending batching before allowing the 
    // gateway to teminate the module. 
    destroy: function () {

        if (this.deviceMessageArray) {
            // drain any pending messages from each of the device message arrays.
            Object.keys(this.deviceMessageArray).forEach(function (id) {

                var messageArray = this.deviceMessageArray[id];

                if (messageArray.length > 0) {

                    // stringify the array contents with special handling for 
                    // Uint8Arrays. 
                    var terminalBatch = JSON.stringify(messageArray, this.UInt8ArrayFormatter);

                    var batchedMessageProperties = this.applyPublishAsProperties(messageArray[messageArray.length - 1]);

                    var repackaged = {
                        properties: batchedMessageProperties,
                        content: new Uint8Array(Buffer.from(terminalBatch))
                    };

                    this.messageBus.publish(repackaged);

                    // mark the array as empty.
                    this.deviceMessageArray[id] = [];
                }
            }, this);
        }
        console.log('batcher.destroy');
    }
};
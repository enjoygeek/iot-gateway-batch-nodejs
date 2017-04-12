'use strict';

module.exports = {
    // dependencies 
    messageBus: null,
    configuration: null,

    shred: function (message) {
        if (message.properties &&
            message.properties.batched &&
            message.properties.batched === true &&
            message.content) {
            var messages = [];
            try {
                messages = JSON.parse(Buffer.from(message.content));
            } catch (e) {
                // ToDo: consider tracing here
                //console.log(e);
                throw e;
            }
            if (messages.constructor === Array) {

                return Array.from(messages);
            }
        }
        // simply pass message through if it is not of the 
        // correct type for processing.
        return message;
    },

    // this function is called for module creation in the context of 
    // the gateway.
    create: function (messageBus, configuration) {
        this.messageBus = messageBus;
        this.configuration = configuration;

        return true;
    },

    // this function is for receiving messages from a message bus in the
    // context of the gateway.
    receive: function (message) {

        var shreddedMessageArray = this.shred(message);

        if (shreddedMessageArray.constructor === Array) {
            shreddedMessageArray.forEach(function (msg) {
                this.messageBus.publish(msg);
            }, this);
            return;
        }

        // if the message content was not parseable as a Uint8Array
        // simply re-publish the message to the bus.
        this.messageBus.publish(message);
    },

    // this function is called by the gateway during shutdown.
    destroy: function () {
        console.log('shredder.destroy');
    }
};
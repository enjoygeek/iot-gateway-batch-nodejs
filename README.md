# iot-gateway-batch-nodejs
NodeJS Batch Module for Azure IoT Gateway

Using this module, developers can build [Azure IoT Gateway](https://github.com/Azure/azure-iot-gateway-sdk) solutions that batch and shred 
messages destined for Azure IoT Hub.  The batching module is deisgned to go either before or after the gateway's IdentityMap module as it batches by a messages `macAddress` or `deviceId` properties.  Additionally, this same module can be imported and leveraged on the cloud side, 
through services such as Azure Functions, to provide cloud-side processing functionality.  When using with the Gateway, batching and 
shredding modules come with the proper interface to read and re-publish messages to the gateway's message broker.

## Installation 

`npm install iot-gateway-batch-nodejs --save`

## Usage 

This module, coupled with a data compression module, can enhance IoT deployments in low/constrained bandwidth conditions or where connectivity can be intermittent.  Though the IoT Device SDK and Gateway both support batching modes, this module enables user defined batching and shredding functionality.

### Details

Messages are batched by either the `macAddress` message property when the module is placed before the IdentityMap module, or by the `deviceId` property when the module is placed after the IdentityMap module.  This grouping is dynamically based on the properties of the messages passing through the module.  All messages without a `macAddress` or `deviceId` property will simply pass through the module unchanged.  The module will also publish all remaining queued messages, batched by the aforementioned properties, at module shutdown.

The following is the output of a batched message content section when converted from the origional Uint8Arry to a string (when deploying the batching module before the Identity Map module:

```json
[
    {"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]},
    {"properties":{"macAddress":"01:01:01"},"content":[116,104,105,115,32,105,115,32,115,111,109,101,32,99,111,110,116,101,110,116]}
]
```

The value can be obtained by taking the batched content, converting it to a buffer and calling JSON.parse with a custom Uint8Array formatter:

```javascript
    function UInt8ArrayFormatter(key, value) {
        if (value instanceof Uint8Array) {
            return Array.from(value);
        }
        return value;
    };
    var shreddedMessageArray = JSON.stringify(Buffer.from(batched_message.content).toString(), UInt8ArrayFormatter);
```

The only required confiugration element for the batcher, is the `batchCount` property.  This property tells the module how many messages to batch at a time.  

The batching module also provides two(2) optional property settings that can be activated via the module configuration for gateway installations or set directly via code for other installations (e.g. Azure Functions):
- Excluded: 
    The `excluded` property is an array for holding either `macAddress`es or `deviceId`s that the module will exclude from batching.  This facilitates have select devices bypass this module.
- PublishAsDevice:
    The `publishAsDevice` property allows batched messages to be published as an alternate device registered with IoT Hub.  This feature is useful to indicate that the gateway was the source of the data rather than the field device.

Unlike the batching module, the shredding module will typically go before the IdentityMap module in a Cloud-to-Device workflow, as most cloud services will typically resolve only the cloud device identity, `deviceId`, for a given device.

*Note: schema for both of these settings can be found in the [Configuration Schema](#configuration-schema) section below.

### Gateway 

#### Batching

Add the following module to the `modules` section of your gateway JSON configuration file:

```javascript 
{
    "modules": [
        {
        "name": "batch",
            "loader": {
                "name": "node",
                "entrypoint": {
                    "main.path": ".\node_modules\iot-gateway-batch-nodejs\batch.js"
                }
            },
            "args": {
                "batchCount": 10,
                "excluded": ["01:01:01:01:01", "myDeviceId"],
                "publishAsDevice":{
                    "deviceId":"theGateway",
                    "deviceKey":"{gateway-device-key}"
                }
            }
        },
        ...
```

Then in the `links` section, patch the module into the message flow:

```javascript 
    ],
    "links": [
        {"source": "{reader_module}", "sink": "batch"},
        {"source": "batch", "sink": "{identity_map}"},
        ...
    ]
}
```

#### Shredding

Add the following module to the `modules` section of your gateway JSON configuration file:

```javascript 
{
    "modules": [
        {
        "name": "shred",
            "loader": {
                "name": "node",
                "entrypoint": {
                    "main.path": ".\node_modules\iot-gateway-batch-nodejs\shred.js"
                }
            },
            "args": {
            }
        },
        ...
```

Then in the `links` section, patch the module into the message flow:

```javascript 
    ],
    "links": [
        {"source": "{cloud2device_reader_module}", "sink": "shred"},
        {"source": "shred", "sink": "{identity_map}"},
        ...
    ]
}
```

### Azure Function



Add the package to your function, [instructions here](https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node#node-version--package-management) then import the module

```javascript 
var batcher = require('batch');
```

and  

```javascript
var result = batcher.stashMessage(message, batchCount, excluded);
if(result){
    // do something with the batched message
} else {
    // null was returned from the batcher indicating the 
    // message was stashed in the device message array.
}
```


### Configuration Schema
The module is configured via the `args` object with the following schema:

```javascript
{
    "$schema": "http://json-schema.org/draft-04/schema#",
    "additionalProperties": false,
    "definitions": {},
    "id": "http://example.com/example.json",
    "properties": {
        "args": {
            "additionalProperties": false,
            "id": "/properties/args",
            "properties": {
                "batchCount": {
                    "id": "/properties/args/properties/batchCount",
                    "type": "integer"
                },
                "excluded": {
                    "additionalItems": true,
                    "id": "/properties/args/properties/excluded",
                    "items": {
                        "id": "/properties/args/properties/excluded/items",
                        "type": "string"
                    },
                    "type": "array",
                    "uniqueItems": false
                },
                "publishAsDevice": {
                    "additionalProperties": false,
                    "id": "/properties/args/properties/publishAsDevice",
                    "properties": {
                        "deviceId": {
                            "id": "/properties/args/properties/publishAsDevice/properties/deviceId",
                            "type": "string"
                        },
                        "deviceKey": {
                            "id": "/properties/args/properties/publishAsDevice/properties/deviceKey",
                            "type": "string"
                        }
                    },
                    "required": [
                        "deviceKey",
                        "deviceId"
                    ],
                    "type": "object"
                }
            },
            "required": [
                "batchCount"
            ],
            "type": "object"
        }
    },
    "required": [
        "args"
    ],
    "type": "object"
}
```


### Tests

`npm test`

### License

This project is licensed under the [MIT License](LICENSE).

### Contributing

When contributing to this repository, please create a GitHub issue to discuss the change you would like to make.

Please note we have a [code of conduct](CONTRIBUTING.md), please follow it in all your interactions with the project.

## Release History

* 0.1.0 Initial release

## Maintainers

- [@williamberryiii](https://github.com/WilliamBerryiii)
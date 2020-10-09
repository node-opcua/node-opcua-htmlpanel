
OPC UA PubSub Example
=====================

This example for OPC UA 

This example was build on NodeJS
NodeOPCUA is a OPC UA stack fully written in TypeScript for NodeJS.

https://github.com/node-opcua/node-opcua

http://node-opcua.github.io/

This OPC UA PubSub demo is built over two distinct modules:

1) an OPC UA server simulating a PLC
2) a web application containing a OPC UA client and a simplified synoptic panel 

#### Install and run

prerequisites: NodeJS v10.19.0 or superior

    $ git clone https://github.com/pedromoritz/opcua-pubsub-example
    $ cd opcua-pubsub-example
    $ npm install
    $
    $ # start server in background
    $ node opc_ua_server.js > /dev/null &
    $
    $ # start the web application
    $ node opc_ua_client.js
    
    Now visit http://localhost:3700 on your web browser

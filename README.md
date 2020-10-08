
OPC UA PubSub Example
=====================

This OPC UA PubSub demo is built over two distinct modules:

1) a OPC UA server simulating a PLC
2) a web application containing a OPC UA client 

#### how to install and run

    $ git clone https://github.com/node-opcua/node-opcua-htmlpanel
    $ cd node-opcua-htmlpanel
    $ npm i
    $
    $ # start server in background
    $ node opc_ua_server.js > /dev/null &
    $
    $ # start the client + web application
    $ node opc_ua_client.js
    
Now visit http://localhost:3700 on your web browser


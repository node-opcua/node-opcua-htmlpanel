node-opcua-htmlpanel
====================

small HTML panel to display a OPCUA monitored variable based on node, express, socket.io  and node-opcua


![alt text](
https://raw.githubusercontent.com/node-opcua/node-opcua-htmlpanel/master/doc/image.png "...")


# how to install

## prerequiste 

*  git

## step by step install 

This steps describe how you can install and test the application  on a linux box, such as ubuntu.
The application is also working on Windows, instructions left to the reader to adapt.


    $ git clone https://github.com/node-opcua/node-opcua-htmlpanel
    $ cd node-opcua-htmlpanel
    $ npm i
    $
    $ # start the html server
    $ node app.js
    
Now visit  `http://localhost:3700` on your web browser
    
( the application connects by default to the Sterfive's demo server : opc.tcp://opcuademo.sterfive.com:26543 )
        
    

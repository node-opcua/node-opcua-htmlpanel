var express = require("express");
var port = 3700;

var opcua = require("node-opcua");
var async = require("async");
var color = require("colors");

var client = new opcua.OPCUAClient({

});

var hostname = require("os").hostname();
hostname = hostname.toLowerCase();
var endpointUrl = "opc.tcp://" + hostname + ":26543/UA/SampleServer";

var the_subscription,the_session;

async.series([
    function(callback) {
        console.log(" connecting to ", endpointUrl.cyan.bold);
        client.connect(endpointUrl,callback);
    },
    function(callback) {
        client.createSession(function (err,session){
            if (!err) {
                the_session = session;
                console.log(" session created".yellow);
            }
            callback(err);
        });
    },
    function(callback) {
        the_subscription=new opcua.ClientSubscription(the_session,{
            requestedPublishingInterval: 2000,
            requestedMaxKeepAliveCount:  2000,
            requestedLifetimeCount:      6000,
            maxNotificationsPerPublish:  1000,
            publishingEnabled: true,
            priority: 10
        });
//xx the_subscription.monitor("i=155",DataType.Value,function onchanged(dataValue){
//xx    console.log(" temperature has changed " + dataValue.value.value);
//xx });
        the_subscription.on("started",function(){
            console.log("subscription started");
            callback();

        }).on("keepalive",function(){
            console.log("keepalive");

        }).on("terminated",function(){
            console.log(" TERMINATED ------------------------------>")
        });

    }
],function(err) {
    if (!err) {
        startHTTPServer();
    } else {
        // cannot connect to client
        console.log(err);
    }
});


var nodeIdToMonitor = "ns=1;s=Temperature";

function startHTTPServer() {


    var app = express();
    app.get("/", function(req, res){
        res.send("It works!");
    });

    app.use(express.static(__dirname + '/'));

    var io = require('socket.io').listen(app.listen(port));

    io.sockets.on('connection', function (socket) {
//        socket.on('send', function (data) {
//            io.sockets.emit('message', data);
//        });
    });

    var monitoredItem = the_subscription.monitor(
        {
            nodeId: nodeIdToMonitor,
            attributeId: 13
        },
        {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        },opcua.read_service.TimestampsToReturn.Both,function(err) {
            if (err) {
                console.log("Monitor  "+ nodeIdToMonitor.toString() +  " failed");
                console.loo("ERr = ",err.message);
            }

        });

    monitoredItem.on("changed", function(dataValue){

        console.log(" value has changed " +  dataValue.toString());

        io.sockets.emit('message', {
            value: dataValue.value.value,
            timestamp: dataValue.serverTimestamp
        });
    });

}




console.log("Listening on port " + port);

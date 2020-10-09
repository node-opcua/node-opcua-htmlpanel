const express = require("express");
const chalk = require("chalk");
const socketIO = require("socket.io");
const port = 3700;

const {
    AttributeIds,
    OPCUAClient,
    TimestampsToReturn,
} = require("node-opcua");


const hostname = require("os").hostname().toLowerCase();
const endpointUrl = "opc.tcp://" + hostname + ":26543/UA/SampleServer";
const nodeIdToMonitor = "ns=1;s=TT001";

(async () => {
    try {
        const client = OPCUAClient.create({
            endpoint_must_exist: false
        });
        client.on("backoff", (retry, delay) => {
            console.log("Retrying to connect to ", endpointUrl, " attempt ", retry);
        });
        console.log(" connecting to ", chalk.cyan(endpointUrl));
        await client.connect(endpointUrl);
        console.log(" connected to ", chalk.cyan(endpointUrl));

        const session = await client.createSession();
        console.log(" session created".yellow);

        const subscription = await session.createSubscription2({
            requestedPublishingInterval: 2000,
            requestedMaxKeepAliveCount: 20,
            requestedLifetimeCount: 6000,
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            priority: 10
        });

        subscription.on("keepalive", function() {
            console.log("keepalive");
        }).on("terminated", function() {
            console.log(" TERMINATED ------------------------------>")
        });

        const app = express();
        app.set('view engine', 'html');
        app.use(express.static(__dirname + '/'));
        app.set('views', __dirname + '/');
        app.get("/", function(req, res) {
            res.render('index.html');
        });

        app.use(express.static(__dirname + '/'));

        const io = socketIO.listen(app.listen(port));

        io.sockets.on('connection', function(socket) {});

        console.log("Listening on port " + port);
        console.log("visit http://localhost:" + port);

        const itemToMonitor = {
            nodeId: nodeIdToMonitor,
            attributeId: AttributeIds.Value
        };
        const parameters = {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        };
        const monitoredItem = await subscription.monitor(itemToMonitor, parameters, TimestampsToReturn.Both);

        monitoredItem.on("changed", (dataValue) => {
            console.log(dataValue.value.toString());
            io.sockets.emit('message', {
                value: dataValue.value.value,
                timestamp: dataValue.serverTimestamp,
                nodeId: nodeIdToMonitor,
                browseName: "Temperature"
            });
        });

        let running = true;
        process.on("SIGINT", async () => {
            if (!running) {
                return;
            }
            console.log("shutting down client");
            running = false;

            await subscription.terminate();

            await session.close();
            await client.disconnect();
            console.log("Done");
            process.exit(0);

        });

    } catch (err) {
        console.log(chalk.bgRed.white("Error" + err.message));
        console.log(err);
        process.exit(-1);
    }
})();
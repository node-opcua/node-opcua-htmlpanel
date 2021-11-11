const express = require("express");
const chalk = require("chalk");
const http = require("http");
const { Server } = require("socket.io");
const port = 3700;

const { AttributeIds, OPCUAClient, TimestampsToReturn } = require("node-opcua");

const hostname = require("os").hostname().toLowerCase();
// const endpointUrl = "opc.tcp://" + hostname + ":26543/UA/SampleServer";
const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543/UA/SampleServer";
const nodeIdToMonitor = "ns=1;s=Temperature";

let client, session, subscription;

async function createOPCUAClient(io) {
  client = OPCUAClient.create({
    endpointMustExist: false,
  });
  client.on("backoff", (retry, delay) => {
    console.log("Retrying to connect to ", endpointUrl, " attempt ", retry);
  });
  console.log(" connecting to ", chalk.cyan(endpointUrl));
  await client.connect(endpointUrl);
  console.log(" connected to ", chalk.cyan(endpointUrl));

  session = await client.createSession();
  console.log(" session created".yellow);

  subscription = await session.createSubscription2({
    requestedPublishingInterval: 250,
    requestedMaxKeepAliveCount: 50,
    requestedLifetimeCount: 6000,
    maxNotificationsPerPublish: 1000,
    publishingEnabled: true,
    priority: 10,
  });

  subscription
    .on("keepalive", function () {
      console.log("keepalive");
    })
    .on("terminated", function () {
      console.log(" TERMINATED ------------------------------>");
    });

  const itemToMonitor = {
    nodeId: nodeIdToMonitor,
    attributeId: AttributeIds.Value,
  };
  const parameters = {
    samplingInterval: 100,
    discardOldest: true,
    queueSize: 100,
  };
  const monitoredItem = await subscription.monitor(
    itemToMonitor,
    parameters,
    TimestampsToReturn.Both
  );

  monitoredItem.on("changed", (dataValue) => {
    console.log(dataValue.value.toString());
    io.sockets.emit("message", {
      value: dataValue.value.value,
      timestamp: dataValue.serverTimestamp,
      nodeId: nodeIdToMonitor,
      browseName: "Temperature",
    });
  });
}

async function stopOPCUAClient() {
  if (subscription) await subscription.terminate();
  if (session) await session.close();
  if (client) await client.disconnect();
}

(async () => {
  try {
    // --------------------------------------------------------
    const app = express();
    app.set("view engine", "html");
    app.use(express.static(__dirname + "/"));
    app.set("views", __dirname + "/");
    app.get("/", function (req, res) {
      res.render("index.html");
    });
    app.use(express.static(__dirname + "/"));

    const server = http.createServer(app);

    const io = new Server(server);
    io.sockets.on("connection", function (socket) {});

    server.listen(port, () => {
      console.log("Listening on port " + port);
      console.log("visit http://localhost:" + port);
    });

    // --------------------------------------------------------
    createOPCUAClient(io);

    // detect CTRL+C and close
    process.once("SIGINT", async () => {
      console.log("shutting down client");

      await stopOPCUAClient();
      console.log("Done");
      process.exit(0);
    });
  } catch (err) {
    console.log(chalk.bgRed.white("Error" + err.message));
    console.log(err);
    process.exit(-1);
  }
})();

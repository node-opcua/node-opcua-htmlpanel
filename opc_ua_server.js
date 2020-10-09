"use strict";
const path = require("path");
const fs = require("fs");
const _ = require("underscore");
const assert = require("assert");
const chalk = require("chalk");
const yargs = require("yargs/yargs");
const envPaths = require("env-paths");

const {
    OPCUAServer,
    OPCUACertificateManager,
    Variant,
    DataType,
    VariantArrayType,
    DataValue,
    standardUnits,
    makeApplicationUrn,
    nodesets,
    install_optional_cpu_and_memory_usage_node,
    build_address_space_for_conformance_testing,
    RegisterServerMethod,
    extractFullyQualifiedDomainName
} = require("node-opcua");

Error.stackTraceLimit = Infinity;

function constructFilename(filename) {
    return path.join(__dirname, "../", filename);
}

const argv = yargs(process.argv)
    .wrap(132)
    .string("alternateHostname")
    .describe("alternateHostname")
    .number("port")
    .default("port", 26543)
    .number("maxAllowedSessionNumber")
    .describe("maxAllowedSessionNumber", "the maximum number of concurrent client session that the server will accept")
    .default("maxAllowedSessionNumber", 500)
    .number("maxAllowedSubscriptionNumber")
    .describe("maxAllowedSubscriptionNumber", "the maximum number of concurrent subscriptions")
    .boolean("silent")
    .default("silent", false)
    .describe("silent", "no trace")
    .string("alternateHostname")
    .default("alternateHostname", null)
    .number("keySize")
    .describe("keySize", "certificate keySize [1024|2048|3072|4096]")
    .default("keySize", 2048)
    .alias("k", "keySize")
    .string("applicationName")
    .describe("applicationName", "the application name")
    .default("applicationName", "NodeOPCUA-Server")
    .alias("a", "alternateHostname")
    .alias("m", "maxAllowedSessionNumber")
    .alias("n", "applicationName")
    .alias("p", "port")
    .help(true)
    .argv;

const port = argv.port;
const maxAllowedSessionNumber = argv.maxAllowedSessionNumber;
const maxConnectionsPerEndpoint = maxAllowedSessionNumber;
const maxAllowedSubscriptionNumber = argv.maxAllowedSubscriptionNumber || 50;
OPCUAServer.MAX_SUBSCRIPTION = maxAllowedSubscriptionNumber;

const os = require('os');

async function getIpAddresses() {

    const ipAddresses = [];
    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach(function(interfaceName) {
        let alias = 0;

        interfaces[interfaceName].forEach(function(iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                return;
            }
            if (alias >= 1) {
                console.log(interfaceName + ':' + alias, iface.address);
                ipAddresses.push(iface.address);
            } else {
                console.log(interfaceName, iface.address);
                ipAddresses.push(iface.address);
            }
            ++alias;
        });
    });
    return ipAddresses;
}

const userManager = {
    isValidUser: function(userName, password) {

        if (userName === "user1" && password === "password1") {
            return true;
        }
        if (userName === "user2" && password === "password2") {
            return true;
        }
        return false;
    }
};

const keySize = argv.keySize;

const productUri = argv.applicationName || "NodeOPCUA-Server";

const paths = envPaths(productUri);

(async function main() {

    const fqdn = await extractFullyQualifiedDomainName();
    console.log("FQDN = ", fqdn);

    const applicationUri = makeApplicationUrn(fqdn, productUri);
    const configFolder = paths.config;
    const pkiFolder = path.join(configFolder, "pki");
    const userPkiFolder = path.join(configFolder, "userPki");

    const userCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        name: "userPki",
        rootFolder: userPkiFolder,
    });
    await userCertificateManager.initialize();

    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        name: "pki",
        rootFolder: pkiFolder,
    });

    await serverCertificateManager.initialize();

    const certificateFile = path.join(pkiFolder, `server_certificate1.pem`);
    const privateKeyFile = serverCertificateManager.privateKey;
    assert(fs.existsSync(privateKeyFile), "expecting private key");

    if (!fs.existsSync(certificateFile)) {

        console.log("Creating self-signed certificate");

        await serverCertificateManager.createSelfSignedCertificate({
            applicationUri: applicationUri,
            dns: argv.alternateHostname ? [argv.alternateHostname, fqdn] : [fqdn],
            ip: await getIpAddresses(),
            outputFile: certificateFile,
            subject: "/CN=Sterfive/DC=Test",
            startDate: new Date(),
            validity: 365 * 10,
        })
    }
    assert(fs.existsSync(certificateFile));

    const server_options = {
        serverCertificateManager,
        userCertificateManager,
        certificateFile,
        privateKeyFile,
        port: port,
        maxAllowedSessionNumber: maxAllowedSessionNumber,
        maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,
        nodeset_filename: [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename
        ],
        serverInfo: {
            applicationName: { text: "NodeOPCUA", locale: "en" },
            applicationUri: applicationUri,
            gatewayServerUri: null,
            productUri: productUri,
            discoveryProfileUri: null,
            discoveryUrls: []
        },
        buildInfo: {
            buildNumber: "1234"
        },
        serverCapabilities: {
            maxBrowseContinuationPoints: 10,
            maxHistoryContinuationPoints: 10,
            operationLimits: {
                maxNodesPerRead: 1000,
                maxNodesPerWrite: 1000,
                maxNodesPerHistoryReadData: 100,
                maxNodesPerBrowse: 1000,
                maxNodesPerMethodCall: 200,
            }
        },
        userManager: userManager,
        isAuditing: false,
        registerServerMethod: RegisterServerMethod.LDS,
        discoveryServerEndpointUrl: "opc.tcp://localhost:4840"
    };

    process.title = "Node OPCUA Server on port : " + server_options.port;
    server_options.alternateHostname = argv.alternateHostname;
    const server = new OPCUAServer(server_options);
    const hostname = require("os").hostname();

    await server.initialize();

    function post_initialize() {
        const addressSpace = server.engine.addressSpace;
        build_address_space_for_conformance_testing(addressSpace);
        install_optional_cpu_and_memory_usage_node(server);
        addressSpace.installAlarmsAndConditionsService();
        const rootFolder = addressSpace.findNode("RootFolder");
        assert(rootFolder.browseName.toString() === "Root");
        const namespace = addressSpace.getOwnNamespace();
        const myDevices = namespace.addFolder(rootFolder.objects, { browseName: "MyDevices" });

        namespace.addVariable({
            organizedBy: myDevices,
            browseName: "Temperature",
            nodeId: "s=TT001",
            dataType: "Double",
            value: {
                refreshFunc: function(callback) {
                    const temperature = 30 + 20 * Math.sin(Date.now() / 10000);
                    const value = new Variant({ dataType: DataType.Double, value: temperature });
                    const sourceTimestamp = new Date();

                    setTimeout(function() {
                        callback(null, new DataValue({ value: value, sourceTimestamp: sourceTimestamp }));
                    }, 100);
                }
            }
        });

        const view = namespace.addView({
            organizedBy: rootFolder.views,
            browseName: "MyView"
        });

    }

    post_initialize();

    function dumpObject(obj) {
        function w(str, width) {
            const tmp = str + "                                        ";
            return tmp.substr(0, width);
        }

        return _.map(obj, function(value, key) {
            return "      " + w(key, 30) + "  : " + ((value === null) ? null : value.toString());
        }).join("\n");
    }

    console.log(chalk.yellow("  server PID          :"), process.pid);
    console.log(chalk.yellow("  silent              :"), argv.silent);

    await server.start();

    console.log(chalk.yellow("\nregistering server to :") + server.discoveryServerEndpointUrl);

    const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

    console.log(chalk.yellow("  server on port      :"), server.endpoints[0].port.toString());
    console.log(chalk.yellow("  endpointUrl         :"), endpointUrl);
    console.log(chalk.yellow("  serverInfo          :"));
    console.log(dumpObject(server.serverInfo));
    console.log(chalk.yellow("  buildInfo           :"));
    console.log(dumpObject(server.engine.buildInfo));
    console.log(chalk.yellow("  Certificate rejected folder "), server.serverCertificateManager.rejectedFolder);
    console.log(chalk.yellow("  Certificate trusted folder  "), server.serverCertificateManager.trustedFolder);
    console.log(chalk.yellow("  Server private key          "), server.serverCertificateManager.privateKey);
    console.log(chalk.yellow("  Server public key           "), server.certificateFile);
    console.log(chalk.yellow("  X509 User rejected folder   "), server.userCertificateManager.trustedFolder);
    console.log(chalk.yellow("  X509 User trusted folder    "), server.userCertificateManager.rejectedFolder);

    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    if (argv.silent) {
        console.log(" silent");
        console.log = function() {};
    }

    server.on("create_session", function(session) {
        console.log(" SESSION CREATED");
        console.log(chalk.cyan("    client application URI: "), session.clientDescription.applicationUri);
        console.log(chalk.cyan("        client product URI: "), session.clientDescription.productUri);
        console.log(chalk.cyan("   client application name: "), session.clientDescription.applicationName.toString());
        console.log(chalk.cyan("   client application type: "), session.clientDescription.applicationType.toString());
        console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
        console.log(chalk.cyan("           session timeout: "), session.sessionTimeout);
        console.log(chalk.cyan("                session id: "), session.sessionId);
    });

    server.on("session_closed", function(session, reason) {
        console.log(" SESSION CLOSED :", reason);
        console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
    });

    function w(s, w) {
        return ("000" + s).substr(-w);
    }

    function t(d) {
        return w(d.getHours(), 2) + ":" + w(d.getMinutes(), 2) + ":" + w(d.getSeconds(), 2) + ":" + w(d.getMilliseconds(), 3);
    }

    function indent(str, nb) {
        const spacer = "                                             ".slice(0, nb);
        return str.split("\n").map(function(s) {
            return spacer + s;
        }).join("\n");
    }

    function isIn(obj, arr) {
        try {
            return arr.findIndex((a) => a === obj.constructor.name.replace(/Response|Request/, "")) >= 0;

        } catch (err) {
            return true;
        }
    }

    const servicesToTrace = ["Publish", "TransferSubscriptions", "Republish", "CreateSubscription", "CreateMonitoredItems"];
    server.on("response", function(response) {

        if (argv.silent) { return; }
        if (isIn(response, servicesToTrace)) {
            console.log(response.constructor.name, response.toString());
        }
        console.log(t(response.responseHeader.timestamp), response.responseHeader.requestHandle,
            response.schema.name.padEnd(30, " "), " status = ", response.responseHeader.serviceResult.toString());

    });

    server.on("request", function(request, channel) {
        if (argv.silent) { return; }
        if (isIn(request, servicesToTrace)) {
            console.log(request.constructor.name, request.toString());
        }
        console.log(t(request.requestHeader.timestamp), request.requestHeader.requestHandle,
            request.schema.name.padEnd(30, " "), " ID =", channel.channelId.toString());
    });

    process.on("SIGINT", function() {
        console.error(chalk.red.bold(" Received server interruption from user "));
        console.error(chalk.red.bold(" shutting down ..."));
        server.shutdown(1000, function() {
            console.error(chalk.red.bold(" shutting down completed "));
            console.error(chalk.red.bold(" done "));
            console.error("");
            process.exit(-1);
        });
    });

    server.on("serverRegistered", () => {
        console.log("server has been registered");
    });
    server.on("serverUnregistered", () => {
        console.log("server has been unregistered");
    });
    server.on("serverRegistrationRenewed", () => {
        console.log("server registration has been renewed");
    });
    server.on("serverRegistrationPending", () => {
        console.log("server registration is still pending (is Local Discovery Server up and running ?)");
    });
    server.on("newChannel", (channel) => {
        console.log(chalk.bgYellow("Client connected with address = "), channel.remoteAddress, " port = ", channel.remotePort, "timeout=", channel.timeout);
    });
    server.on("closeChannel", (channel) => {
        console.log(chalk.bgCyan("Client disconnected with address = "), channel.remoteAddress, " port = ", channel.remotePort);
        if (global.gc) {
            global.gc();
        }
    });

})();
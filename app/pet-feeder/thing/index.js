//Thing implementation
PetFeederThing = require("./dist/Thing.js").PetFeederThing;

//Required bindings
Servient = require("@node-wot/core").Servient;
HttpServer = require("@node-wot/binding-http").HttpServer;
CoapServer = require("@node-wot/binding-coap").CoapServer

//Servers
var httpServer = new HttpServer({ port: 8080 });
var coapServer = new CoapServer({ port: 5683 });

//Servient object
var servient = new Servient();
servient.addServer(httpServer);
servient.addServer(coapServer);

//Exposing the thing
servient.start().then((WoT) => {
	petFeederObject = new PetFeederThing(WoT);
});

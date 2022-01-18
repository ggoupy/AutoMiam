import * as WoT from "wot-typescript-definitions";
var request = require("request");
const Ajv = require("ajv");
var ajv = new Ajv();
import * as jf from "johnny-five";
const NodeWebcam = require("node-webcam");
const fs = require("fs");


// Class controlling the arduino (hardware)
class Hardware {
    //Arduino
    public board : jf.Board;

    //MOTOR
    private servo : jf.Servo;
    private motor_on : boolean = false;

    //PHOTORESISTOR
    //To simulate a presence sensor
    public presence_sensing : boolean = false;
    private photoresistor : jf.Sensor;
    //Last luminosity recorded
    public luminosity : number = 0;
    //Threshold to detect animals near the system
    public luminosity_threshold : number =  30;

    //WEBCAM
    private webcam : any;

    constructor() {
        const servo_opts = {
            pin: 6, //Attached to pin 6
            range: [0, 180],
            startAt: 0,
            pwmRange : [100,200]
        };

        const webcam_opts = {
            //Picture related
            width: 1280,
            height: 720,
            quality: 100,
            // Number of frames to capture
            // More the frames, longer it takes to capture
            // Use higher framerate for quality. Ex: 60
            frames: 1,
            //Save shots in memory
            saveShots: true,
            // [jpeg, png] support varies
            // Webcam.OutputTypes
            output: "jpeg",
            //Which camera to use
            //Use Webcam.list() for results
            //false for default device
            device: false,
            // [location, buffer, base64]
            // Webcam.CallbackReturnTypes
            callbackReturn: "location",
            //Logging
            verbose: false
        }

        this.board = new jf.Board({
            debug: false,
            repl: false
        });

        //Camera 
        this.webcam = NodeWebcam.create(webcam_opts);

        this.board.on("ready", () => {

            //Photoresistor
            this.photoresistor = new jf.Sensor({
                pin: "A1",
                freq: 100
            });

            //Servo motor
            this.servo = new jf.Servo(servo_opts);

            //Checks luminosity changes
            this.photoresistor.on("data", this.check_sensing(this));
        });
    }

    private check_sensing(instance) {
        return function (value) {
            if (instance.luminosity > 0)
            {
                //Presence of an individual : checks for decrease
                if (instance.presence_sensing && instance.luminosity - value > instance.luminosity_threshold)
                    instance.presence_sensing = false;
                //No individual : checks for increase
                else if (!instance.presence_sensing && value - instance.luminosity > instance.luminosity_threshold)
                    instance.presence_sensing = true;
            }
            //Update luminosity
            instance.luminosity = value;
        }
    }

    is_motor_on() {
        return this.motor_on;
    }

    is_presence_sensor_on() {
        return this.presence_sensing;
    }

    private open()
    {
        this.motor_on = true;
        this.servo.max(); //Open
    }

    private close(instance)
    {
        return function() { 
            instance.servo.min(); 
            instance.motor_on = false;
        }
    }

    //Activates motor to deliver a ration
    activate() {
        this.open();
        setTimeout(this.close(this), 500); //Close after timer
    }

    //Takes a picture from the camera
    take_picture()
    {
        return new Promise((resolve,reject) => {

            //Wait motor is not activated
            if (this.motor_on) resolve(-1);

            //First save it in a file and then pass return a base64 string
            else this.webcam.capture("webcam", ( err, data ) => {
                //console.log("Souriez !");
                if (data == undefined) resolve(-1);
                else fs.readFile(data, "base64", (err,img) => {
                    resolve(img);
                });
            });
        }); 
    }
}



// Main class mapping the exposed thing
export class PetFeederThing {

    //Hardware class
    private hardware: Hardware; 

    //Amount of given food per activation
    private food_ration : number = 50; //Grams
    //Nb activations
    private nb_activation : number = 0;
    //Last activation
    private last_activation : string =  "";
    
    //WOT related
    public thing: WoT.ExposedThing;
    public WoT: WoT.WoT;
    public td: any;
    
    constructor(WoT: WoT.WoT, tdDirectory?: string) {
        this.hardware = new Hardware();
        
        //create WotDevice as a server
        this.WoT = WoT;
        this.WoT.produce(
            {
                "@context": ["https://www.w3.org/2019/wot/td/v1", { "@language": "en" }],
                "@type": "",
                id: "new:thing",
                title: "PetFeeder",
                description: "Pet Feeder smart device",
                securityDefinitions: {
                    "": {
                        scheme: "",
                    },
                },
                security: "",
                properties: {
                    food_ration: {
                        title: "Food Ration",
                        description: "Ration of food per activation (grams)",
                        type: "number",
                        readOnly: true
                    },
                    nb_activation: {
                        title: "Number Activation",
                        description: "Number of activation per day",
                        type: "number",
                        readOnly: true
                    },
                    last_activation: {
                        title: "Last Activation",
                        description: "Last activation of the day",
                        type: "string",
                        readOnly: true
                    },
                    presence_sensing: {
                        title: "Presence sensing",
                        description: "Indicates the presence of an individual in front of the system",
                        type: "boolean",
                        readOnly: true,
                        observable: true
                    },
                    last_picture: {
                        title: "Last picture",
                        description: "Last picture taken by the system",
                        type: "base64",
                        readOnly: true,
                        observable: true
                    }
                },
                actions: {
                    activate: {
                        title: "Activate",
                        description: "Activates the motor to deliver a ration of food",
                        input: {},
						out: {
                            type: "boolean"
                        }
                    },
                    picture: {
                        title: "Picture",
                        description: "Takes a picture from the camera",
                        input: {},
                        out: {
                            type: "base64"
                        }
                    },
                },
            }
        ).then((exposedThing) => {
            this.hardware.board.on("ready", () => {
                this.thing = exposedThing;
                this.td = exposedThing.getThingDescription();
                this.add_properties();
                this.add_actions();
                this.thing.expose();
                if (tdDirectory) {
                    this.register(tdDirectory);
                }
            });
        });
    }

    public register(directory: string) {
        console.log("Registering TD in directory: " + directory);
        request.post(directory, { json: this.thing.getThingDescription() }, (error, response, body) => {
            if (!error && response.statusCode < 300) {
                console.log("TD registered!");
            } else {
                console.debug(error);
                console.debug(response);
                console.warn("Failed to register TD. Will try again in 10 Seconds...");
                setTimeout(() => {
                    this.register(directory);
                }, 10000);
                return;
            }
        });
    }

    private add_properties() {
        //food_ration
        this.thing.writeProperty("food_ration", this.food_ration);
        this.thing.setPropertyReadHandler("food_ration", () => {
            return new Promise((resolve, reject) => {
                resolve(this.food_ration);
            });
        });

        //nb_activation
        this.thing.writeProperty("nb_activation", this.nb_activation);
        this.thing.setPropertyReadHandler("nb_activation", () => {
            return new Promise((resolve, reject) => {
                resolve(this.nb_activation);
            });
        });

        //last_activation
        this.thing.writeProperty("last_activation", this.last_activation);
        this.thing.setPropertyReadHandler("last_activation", () => {
            return new Promise((resolve, reject) => {
                resolve(this.last_activation);
            });
        });

        //presence_sensing
        this.thing.writeProperty("presence_sensing", false);
        this.thing.setPropertyReadHandler("presence_sensing", () => {
            return new Promise((resolve, reject) => {
                resolve(this.hardware.is_presence_sensor_on());
            });
        });

        //last_picture
        this.thing.writeProperty("last_picture", "");
        this.thing.setPropertyReadHandler("last_picture", () => {
            return new Promise((resolve, reject) => {
                resolve(this.pictureHandler(""));
            });
        });
    }


    private activateHandler(inputData) {
        return new Promise((resolve, reject) => {
            this.nb_activation += 1;
            this.last_activation = new Date().toLocaleTimeString();
            this.hardware.activate();
            //We suppose that the motor always activates itself
            //We may need to verify the activation
            resolve(true);
        });
    }

    private pictureHandler(inputData) {
        return this.hardware.take_picture();
    }

    private add_actions() {
        //Activates the motor to deliver food
        this.thing.setActionHandler("activate", (inputData) => {
            return new Promise((resolve, reject) => {
                resolve(this.activateHandler(inputData));
            });
        });

        //Takes a picture from the camera
        this.thing.setActionHandler("picture", (inputData) => {
            return new Promise((resolve, reject) => {
                resolve(this.pictureHandler(inputData));
            });
        });
    }
}

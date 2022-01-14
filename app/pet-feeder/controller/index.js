const { Servient, Helpers } = require("@node-wot/core");
const { HttpClientFactory } = require('@node-wot/binding-http');
const axios = require('axios');

// Remove console msgs from node-wot
console.debug = function() {}


const servient = new Servient();

servient.addClientFactory(new HttpClientFactory(null));

const WoTHelpers = new Helpers(servient);


//Dog Identifier API
const identifier_api = "http://127.0.0.1:5000/api";


//Pet Feeder API
const petfeeder_api = "http://localhost:8080/petfeeder"


//Makes a prediction with the python server classifier
async function model_predict(img) {
    //Server post request
    const classifier_pred = await axios.post(identifier_api + "/animals/identify", {
        'img': img
    }).catch(err => {console.log("Request error... " + err);});
    if (classifier_pred == undefined) return -1;
    const predicted = parseInt(classifier_pred.data.class_predicted);
    if (predicted == undefined) {console.log("Response error..."); return -1;}
    console.log(classifier_pred.data);
    return predicted;
}


async function getAnimalById(id) {
    return await axios.get(identifier_api + "/animals/" + id)
    .then(res => res.data)
    .catch(err => console.log(err));
}


async function updateAnimal(id, eaten) {
    axios.put(identifier_api + "/animals/eat/" + id, {
        'eaten': eaten
    })
    .catch(err => console.log(err));
}


//To delay ration given
food_timeout = false;
food_timeout_time = 10000; //Ms
processing_predict = false


// LOGIC OF THE APPLICATION 
WoTHelpers.fetch(petfeeder_api).then(async (td) => {
    try {
        servient.start().then(async (WoT) => {
            let thing = await WoT.consume(td);
            const food_ration = await thing.readProperty("food_ration");
            // We request our Thing at a given interval because there is
            // an unfixed bug with observeProperty function for HTTP requests
            setInterval(async () => {
                const is_presence_sensing = await thing.readProperty("presence_sensing");
                if (is_presence_sensing) 
                {
                    const img = await thing.invokeAction("picture");
                    if (img != -1)
                    {
                        //Classify the image
                        const id = await model_predict(img);
                        //A registered animal is detected
                        //And no food given recently and no current process
                        if (Number.isInteger(id) && id != -1 && !food_timeout && !processing_predict)
                        {
                            processing_predict = true
                            let animal = await getAnimalById(id);
                            animal = JSON.parse(animal);
                            console.log(`Coucou ${animal.name} !`);
                            //Food has been given meanwhile
                            if (food_timeout) {
                                console.log(`Reviens plus tard ${animal.name} !`);
                                return;
                            };
                            //Check if the animal has reached is max food ration
                            if (animal.current_food < animal.max_food)
                            {
                                const res = await thing.invokeAction("activate");
                                if (!res) {console.log("Error : Pet Feeder can not activate."); return;}
                                //Flag to indicate food has been given recently
                                food_timeout = true;
                                setTimeout(function() { 
                                    food_timeout = false;
                                    console.log(`Revenez manger !`);
                                }, food_timeout_time);
                                //Notify server
                                updateAnimal(id,food_ration);
                                console.log(`Bon appétit ${animal.name} !`);
                            }
                            else console.log(`Reviens demain ${animal.name} !`);
                            processing_predict = false
                        }
                    }
                }
            }, 500);
                
        });
    }
    catch (err) {
        console.error("Script error:", err);
    }
}).catch((err) => { console.error("Fetch error:", err); });

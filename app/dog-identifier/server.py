import os
import requests
from flask import Flask, json, request, abort, Response
from flask_cors import CORS
from identifier.animal import Animal
from identifier.dog_identifier import DogIdentifier, DB_DIR

api = Flask("Dog Identifier")
CORS(api)

model = DogIdentifier()


# Dict of registered dogs
registered_dogs = {}

def save_file_of(animal_id):
    return DB_DIR + str(animal_id) + "/" + str(animal_id) + ".json"

# Fill dict with database
for subdir in os.listdir(DB_DIR):
    dog_id = subdir
    file = save_file_of(dog_id)
    registered_dogs[dog_id] = Animal.from_json_file(file)
    registered_dogs[dog_id].current_food = 0 # To simulate a new day 
    model.add_identified(registered_dogs[dog_id])

def registered_to_json():
    return {key: value.__dict__ for key, value in registered_dogs.items()}


# POST REQUEST to identifiy a dog 
@api.route('/api/animals/identify', methods=['POST'])
def identify():
    img = request.json['img']
    class_predicted,accuracy = model.dog_identifier(img)
    return json.dumps({"class_predicted":str(class_predicted), "accuracy":str(accuracy)})


# GET REQUEST to get all registered dogs
@api.route('/api/animals', methods=['GET'])
def getAnimals():
    return json.dumps(registered_to_json())


# GET REQUEST to get all registered dogs
@api.route('/api/animals/<animal_id>', methods=['GET'])
def getAnimalById(animal_id):
    if animal_id in registered_dogs:
        return json.dumps(registered_dogs[animal_id].to_json())
    else:
        abort(404)


# UPDATE REQUEST to modify a dog food
@api.route('/api/animals/eat/<animal_id>', methods=['PUT'])
def updateAnimalFood(animal_id):
    if animal_id in registered_dogs:
        registered_dogs[animal_id].current_food += int(request.json['eaten'])
        # Save in DB
        registered_dogs[animal_id].save_file(save_file_of(animal_id))
        return Response(status=204)
    else:
        abort(404)


# POST REQUEST to add a dog 
@api.route('/api/animals/add', methods=['GET','POST'])
def addAnimal():
    data = request.form.to_dict()
    new_id = str(len(registered_dogs))
    path = save_file_of(new_id)
    data["id"] = new_id
    data["img"] = data["img"].split(",")[1] #Remove info part
    if not os.path.exists(DB_DIR + new_id):
    	os.makedirs(DB_DIR + new_id)
    res = Animal.register(data, path)
    if res == None:
        return Response(status=400)
    else:
        model.add_identified(res)
        registered_dogs[new_id] = res
        return Response(status=201)



# Run
if __name__ == '__main__':
    api.run() 

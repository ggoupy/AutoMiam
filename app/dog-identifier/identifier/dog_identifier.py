import os, sys, json, time, io, random
from base64 import b64decode
import numpy as np
from PIL import Image
import tensorflow as tf
import tensorflow.keras.backend as K
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing import image
from tensorflow.keras.layers import Input,Flatten,Lambda,Dense
from tensorflow.keras.applications.resnet_v2 import ResNet50V2, preprocess_input


###################### Constants ######################

# Database Directory = registered animals (relative to base dir)
DB_DIR = "./identifier/db/"
# Size of input images (width,height,channels)
IMG_SHAPE = (224, 224, 3)
# weights save file (relative to base dir)
WEIGHTS_FILE = "./identifier/Identifier_weights.h5"
# Preprocess function for model inputs
PREPROCESS_FN = preprocess_input

#######################################################
#######################################################



###################### PRESIAMESE NETWORK ######################

# Preprocess an image for NN feeding miam
# Crops it to width = height, and resize it to IMG_SHAPE
def preprocess_image(img, img_shape=IMG_SHAPE[0:2]):
    width, height = img.size # Get dimensions
    size = min(width,height)
    left = (width - size)/2
    top = (height - size)/2
    right = (width + size)/2
    bottom = (height + size)/2
    # Crop the center of the image
    #img = img.crop((left, top, right, bottom))
    return img.resize(img_shape)

# Sub net of the siamese network
def base_model(input_shape=IMG_SHAPE):
    inputs = Input(input_shape)
    base = ResNet50V2(include_top=False, weights="imagenet", input_tensor=inputs)
    base.trainable = False
    out = Flatten()(base.output)
    model = Model(base.input,out, name="BaseConvNet")
    return model

# Siamese network
def identifier_model(input_shape=IMG_SHAPE):
    # Tensors for the two input images
    left_input = Input(input_shape)
    right_input = Input(input_shape)
    # Base model
    base = base_model(input_shape)
    # Feature vectors (encodings) for the two images
    encoded_l = base(left_input)
    encoded_r = base(right_input)
    # Customized layer to compute the absolute difference between the encodings
    L1_layer = Lambda(lambda tensors:K.abs(tensors[0] - tensors[1]))
    L1_distance = L1_layer([encoded_l, encoded_r])
    # Dense layer with a sigmoid unit to generate the similarity score
    prediction = Dense(1,activation='sigmoid')(L1_distance)
    # Connects the inputs with the outputs
    siamese_net = Model(inputs=[left_input,right_input],outputs=prediction, name="SiameseNetwork")
    # Returns the model
    return siamese_net

def get_identifier():
    model = identifier_model()
    model.load_weights(WEIGHTS_FILE)
    return model

#######################################################
#######################################################



###################### IDENTIFIER CLASS ######################

class DogIdentifier:
    def __init__(self):
        self.classifier = ResNet50V2(weights='imagenet')
        self.identifier = get_identifier()
        self.identified = {}

    def add_identified(self, dct):
        self.identified[dct.id] = self.__base64_to_tensor(dct.img)

    def __base64_to_tensor(self, imbase64, preprocess_fn=PREPROCESS_FN):
        # PIL Image object
        img = Image.open(io.BytesIO(b64decode(imbase64)))
        # Preprocess the image
        img = preprocess_image(img)
        # Convert PIL.Image.Image type to 3D tensor with shape IMG_SHAPE
        img = image.img_to_array(img)
        # Convert 3D tensor to 4D tensor with shape (1, IMG_SHAPE) and return 4D tensor
        img = np.expand_dims(img, axis=0)
        # Pre process (or not) for model
        if preprocess_fn != None:
            return preprocess_fn(img)
        else:
            return img

    def __path_to_tensor(self, img_path, preprocess_fn=PREPROCESS_FN):
        # Moads RGB image as PIL.Image.Image type
        img = image.load_img(img_path)
        # Preprocess the image
        img = preprocess_image(img)
        # Convert PIL.Image.Image type to 3D tensor with shape IMG_SHAPE
        img = image.img_to_array(img)
        # Convert 3D tensor to 4D tensor with shape (1, IMG_SHAPE) and return 4D tensor
        img = np.expand_dims(img, axis=0)
        # Pre process (or not) for model
        if preprocess_fn != None:
            return preprocess_fn(img)
        else:
            return img

    def __get_identified(self, input_img):
        similarities = {}
        for key in self.identified:
            similarities[key] = self.identifier.predict([self.identified[key],input_img])[0][0]
        max_ind = max(similarities, key=similarities.get)
        max_val = similarities[max_ind]
        return max_ind,max_val

    def is_dog(self, input_img):
        predicted = self.classifier.predict(input_img)
        (class_predicted, accuracy) = (np.argmax(predicted), np.max(predicted))
        if accuracy < 0.5:
            return (False, accuracy)
        #Classes of the dogs
        return (True if (class_predicted <= 268) & (class_predicted >= 151) else False, accuracy)

    # Returns prediction for the given image
    def dog_identifier_from_path(self, img_path):
        if len(self.identified) == 0:
            return -1, 1
        input_img = self.__path_to_tensor(img_path) #Convert to tensor
        #Check if predicted is a dog class
        (isdog, accuracy) = self.is_dog(input_img)
        if isdog:
            #Dog class, find the dog among the db
            return self.__get_identified(input_img)
        else:
            #Not a dog 
            return -1, accuracy

    # Returns prediction for the given image
    def dog_identifier(self, imbuffer):
        if len(self.identified) == 0:
            return -1, 1
        input_img = self.__base64_to_tensor(imbuffer) #Convert to tensor
        #Check if predicted is a dog class
        (isdog, accuracy) = self.is_dog(input_img)
        if isdog:
            #Dog class, find the dog among the db
            return self.__get_identified(input_img)
        else:
            #Not a dog 
            return -1, accuracy

#######################################################
#######################################################
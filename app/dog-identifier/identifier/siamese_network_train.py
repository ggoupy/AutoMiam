import random, os
import numpy as np
import matplotlib.pyplot as plt
import tensorflow.keras.backend as K
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.preprocessing import image
from sklearn.model_selection import train_test_split
from tensorflow.keras.layers import Input,Flatten,Lambda,Dense
from tensorflow.keras.applications.resnet_v2 import ResNet50V2, preprocess_input


# Constants
# Size of input images (width,height,channels)
IMG_SHAPE = (224, 224, 3)
# Percentage of test dataset
TEST_SIZE = 0.33
# Directory of the training data
TRAINING_DIR = "./dogs_training_large/"
# weights save file
WEIGHTS_FILE = "Identifier_weights.h5"
# Preprocess function for model inputs
PREPROCESS_FN = preprocess_input


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


# Loads an image into a vector of shape IMG_SHAPE
def load_image_3d(img_path, preprocess_fn=PREPROCESS_FN):
    # Loads RGB image as PIL.Image.Image type
    img = image.load_img(img_path)
    # Preprocess image 
    img = preprocess_image(img)
    # Converts PIL.Image.Image type to 3D tensor
    img = image.img_to_array(img)
    # Pre process (or not) for model
    if preprocess_fn != None:
        return preprocess_fn(img)
    else:
        return img


# Loads an image into a vector of shape (1, IMG_SHAPE)
def load_image_4d(img_path, preprocess_fn=PREPROCESS_FN):
    # Loads RGB image as PIL.Image.Image type
    img = image.load_img(img_path)
    # Preprocess image 
    img = preprocess_image(img)
    # Converts PIL.Image.Image type to 3D tensor
    img = image.img_to_array(img)
    # Converts 3D tensor to 4D tensor with shape (1, IMG_SHAPE)
    img = np.expand_dims(img, axis=0)
    # Pre process (or not) for model
    if preprocess_fn != None:
        return preprocess_fn(img)
    else:
        return img


# Creates pairs from given X,Y for siamese network
def create_pairs(images, labels):
    random.seed(1)
    pairImages = []
    pairLabels = []
    numClasses = len(np.unique(labels))
    idx = [np.where(labels == i)[0] for i in range(0, numClasses)]
    for idxA in range(len(images)):
        currentImage = images[idxA]
        label = labels[idxA]
        idxB = np.random.choice(idx[label])
        posImage = images[idxB]
        pairImages.append([currentImage, posImage])
        pairLabels.append([1])
        negIdx = np.where(labels != label)[0]
        negImage = images[np.random.choice(negIdx)]
        pairImages.append([currentImage, negImage])
        pairLabels.append([0])
    return (np.array(pairImages), np.array(pairLabels))


# Sub net of the siamese network
def base_model(input_shape=IMG_SHAPE):
    inputs = Input(input_shape)
    base = ResNet50V2(include_top=False, weights="imagenet", input_tensor=inputs)
    base.trainable = False
    out = Flatten()(base.output)
    model = Model(base.input,out, name="BaseConvNet")
    return model
    #x = base_model(inputs)
    #x = Flatten()(x)
    #x = Dense(1024, activation='relu')(x)
    #x = Dropout(dropout_rate)(x)
    #x = Dense(512, activation='relu')(x)
    #x = Dropout(dropout_rate)(x)
    #model = Model(inputs, x)
    #x = base(inputs)
    #x = GlobalAveragePooling2D()(x)
    #outputs = Dense(embedding)(x)
    #model = Model(inputs, outputs)


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


# Gets the training data from given dir
def load_dataset(training_dir=TRAINING_DIR):
    X = []
    Y = []
    # Reads all the images in the current category
    for subdir in os.listdir(training_dir):
        classid = int(subdir)
        for filename in os.listdir(f"{training_dir}{classid}/"):
            img = load_image_3d(f"{training_dir}{classid}/"+filename)
            X.append(img)
            Y.append(classid)
    X = np.stack(X)
    Y = np.vstack(Y)
    # Splits into train & dev sets
    X_train, X_test, y_train, y_test = train_test_split(X, Y, test_size=0.33)
    #print(X_train.shape, X_test.shape, y_train.shape, y_test.shape)
    # Creates and return pairs
    (pairTrain, labelTrain) = create_pairs(X_train,y_train.ravel())
    (pairTest, labelTest) = create_pairs(X_test, y_test.ravel())
    return (pairTrain, pairTest, labelTrain, labelTest)


def get_identifier():
    model = identifier_model()
    model.load_weights(WEIGHTS_FILE)
    return model


# Creates a model, train it and save weights into file
def train_save_model():
    # Dataset
    (pairTrain, pairTest, labelTrain, labelTest) = load_dataset()

    # Model
    model = identifier_model()
    model.summary()

    # Compile
    #optimizer = Adam(learning_rate=0.00001)
    #model.compile(loss="binary_crossentropy", optimizer=optimizer)
    model.compile(loss='binary_crossentropy',
                          optimizer=Adam(learning_rate=0.0001),
                          metrics=['binary_crossentropy', 'acc'])

    # Train
    # Notes
    # best params found : batch_size=1, epochs=12
    # By preprocessing inputs with ResNet, 100% detect differents, but worst at detecting sames 
    model.fit(x=[[pairTrain[:, 0], pairTrain[:, 1]]], y=labelTrain[:], 
              validation_data=([[pairTest[:, 0], pairTest[:, 1]]], labelTest[:]), batch_size=16, epochs=10, use_multiprocessing=True)

    # Save into file
    model.save_weights(WEIGHTS_FILE)


def test(model):
    # Test
    img1 = load_image_4d("./dogs/0.jpg")
    print("Japp vs Mina")
    count = 0
    for i in range(1,31):
        img2 = load_image_4d(f"./dogs_training/1/{i}.jpg")
        [[val]] = model.predict([img1,img2])
        if val < 0.9:
            count+=1
    print(f"\t=> {(count/30)*100}")
    print()

    print("Japp vs Japp")
    count = 0
    for i in range(1,31):
        img2 = load_image_4d(f"./dogs_training/0/{i}.jpg")
        [[val]] = model.predict([img1,img2])
        if val > 0.9:
            count+=1
    print(f"\t=> {(count/30)*100}")
    print()

    img1 = load_image_4d("./dogs/1.jpg")
    count = 0
    print("Mina vs Japp")
    for i in range(1,31):
        img2 = load_image_4d(f"./dogs_training/0/{i}.jpg")
        [[val]] = model.predict([img1,img2])
        if val < 0.9:
            count+=1
    print(f"\t=> {(count/30)*100}")
    print()

    print("Mina vs Mina")
    count = 0
    for i in range(1,31):
        img2 = load_image_4d(f"./dogs_training/1/{i}.jpg")
        [[val]] = model.predict([img1,img2])
        if val > 0.9:
            count+=1
    print(f"\t=> {(count/30)*100}")
    print()



def train_test():
    train_save_model()
    test(get_identifier())

import json, os

class Animal:
	def __init__(self, id, name, img, max_food, current_food=0):
		self.id = id;
		self.name = name;
		self.img = img;
		self.max_food = max_food;
		self.current_food = current_food;

	def save_file(self, path):
		with open(path, 'w') as outfile:
			json.dump(self.__dict__, outfile, ensure_ascii=False)

	def to_json(self):
		return json.dumps(self, default=lambda o: o.__dict__)

	@staticmethod
	def from_json_file(path):
		with open(path) as jsonObj:
			dct = json.loads(jsonObj.read())
			return Animal(dct['id'], dct['name'], dct['img'], dct['max_food'], dct['current_food'])
		
	@staticmethod
	def register(dct, path):
		try:
			animal = Animal(dct['id'], dct['name'], dct['img'], dct['max_food'], 0)
			animal.save_file(path)
			return animal
		except:
			return None

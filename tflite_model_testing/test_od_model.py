import argparse
import glob
import os
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix
import tensorflow as tf

from tflite_interpreter_helper import get_prediction


TEST_IMAGE_BASE = 'testing_images'

# score cutoff for detecting missing teeth
THRESHOLD = 0.3


def main(args):
	# Pepare the tflite interpreter.
	interpreter = tf.lite.Interpreter(args.model_path)

	# This is required for setting and getting tensors.
	interpreter.allocate_tensors()

	# Get the true labels.
	# Here we transform the labels stored in the xml formate into the number of missing teeth.
	images = {}
	for image_path in glob.glob(os.path.join(TEST_IMAGE_BASE, '*.jpg')):
		label_path = image_path.replace('.jpg', '.xml')

		try:
			tree = ET.parse(label_path)
		except FileNotFoundError:
			print('{} not found, skipping'.format(label_path))
			continue

		root = tree.getroot()

		n_missing = 0
		for object_ in root.iter('object'):
			name = object_.find('name').text

			if name == 'missing':
				n_missing += 1

		images[image_path] = {'true_label': n_missing}

	# Iterate through each labeled image and get the predicted label.
	print('Processing {} labeled images.'.format(len(images)))
	for image_path in images:
		image = Image.open(image_path)
		image_array = np.asarray(image)

		# Turn the image array into a batch of one.
		image_array = image_array[np.newaxis, :]

		# The four output arrays are:
		# - normalized bounding boxes (left, top, right, bottom)
		# - labels, 0: missing tooth, 1: gear
		# - scores
		# - the number of output detections
		outputs = get_prediction(interpreter, image_array)

		bbox, labels, scores, _ = outputs

		# Remove the batch size dimension
		labels = labels[0]
		scores = scores[0]

		# Get the predicted number of missing teeth
		n_missing = 0
		for label, score in zip(labels, scores):
			if label == 0.0 and score >= THRESHOLD:
				n_missing += 1

		images[image_path]['pred_label'] = n_missing

	# Calculate and print metrics.
	y_true = []
	y_pred = []
	for image_path, info_dict in images.items():
		y_true.append(info_dict['true_label'])
		y_pred.append(info_dict['pred_label'])

	print('Threshold: {}'.format(THRESHOLD))

	accuracy = accuracy_score(y_true, y_pred)
	print('Accuracy: {}'.format(accuracy))

	binary_accuracy = accuracy_score(np.array(y_true) == 0, np.array(y_pred) == 0)
	print('Binary accuracy: {}'.format(binary_accuracy))

	print('Confusion matrix:')
	print(confusion_matrix(y_true, y_pred))


if __name__ == '__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument(
		'--model_path',
		default='models/model_od_5_2_2019.tflite')

	args = parser.parse_args()

	main(args)
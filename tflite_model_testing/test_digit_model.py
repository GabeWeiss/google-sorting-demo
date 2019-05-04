import argparse
import csv
import glob
import os

import numpy as np
from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix
import tensorflow as tf

from tflite_interpreter_helper import get_prediction


TEST_IMAGE_BASE = 'testing_images'

# in the TEST_IMAGE_BASE directory
LABELS_CSV = 'testing_labels.csv'


def main(args):
	# Pepare the tflite interpreter.
	interpreter = tf.lite.Interpreter(args.model_path)

	# This is required for setting and getting tensors.
	interpreter.allocate_tensors()

	# Get the true labels.
	images = {}
	with open(os.path.join(TEST_IMAGE_BASE, LABELS_CSV), 'r') as f:
		reader = csv.reader(f)
		for row in reader:
			images[row[0]] = {'true_label': int(row[1])}

	# Iterate through each labeled image and get the predicted label.
	print('Processing {} labeled images.'.format(len(images)))
	for image_filename in images:
		image_path = os.path.join(TEST_IMAGE_BASE, image_filename)

		image = Image.open(image_path)
		image_array = np.asarray(image)

		# Turn the image array into a batch of one.
		image_array = image_array[np.newaxis, :]

		outputs = get_prediction(interpreter, image_array)

		# For classification there is only one output, which is an array of shape (1, 10) for the batch of 1 and 10 classes.
		quantized_scores = outputs[0][0]

		# Convert the quantized score back to float.
		quantization_step = interpreter.get_output_details()[0]['quantization'][0]
		quantization_min = interpreter.get_output_details()[0]['quantization'][1]
		float_scores = quantization_step * (quantized_scores - quantization_min)

		images[image_filename]['pred_label'] = float_scores.argmax()
		images[image_filename]['pred_score'] = float_scores.max()

	# Calculate and print metrics.
	y_true = []
	y_pred = []
	for image_filename, info_dict in images.items():
		y_true.append(info_dict['true_label'])
		y_pred.append(info_dict['pred_label'])

	accuracy = accuracy_score(y_true, y_pred)
	print('Accuracy: {}'.format(accuracy))

	print('Confusion matrix:')
	print(confusion_matrix(y_true, y_pred))


if __name__ == '__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument(
		'--model_path',
		default='models/model_digit_bt_4_26_2019.tflite')

	args = parser.parse_args()

	main(args)
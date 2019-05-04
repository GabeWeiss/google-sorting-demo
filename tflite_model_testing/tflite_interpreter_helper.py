import tensorflow as tf


def get_prediction(interpreter, image_array):
	# Get the index of the tensor that should hold the input.
	# get_input_details() returns additional information about the input tensors.
	# Here we know that there is only one input.
	input_index = interpreter.get_input_details()[0]["index"]

	# Get the index of the tensor that will hold the output.
	# get_output_details() returns additional information about the output tensors.
	# For the classification model there is only one output, while for the detection model there are 4 outputs.
	output_indices = [output_info['index'] for output_info in interpreter.get_output_details()]

	# Feed the image array to the model.
	interpreter.set_tensor(input_index, image_array)

	# Run the model.
	interpreter.invoke()

	# Retrieve the model output.
	outputs = [interpreter.get_tensor(output_index) for output_index in output_indices]

	return outputs

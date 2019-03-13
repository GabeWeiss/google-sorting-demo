# Copyright 2019 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
FROM resin/aarch64-alpine as opencv-python
RUN [ "cross-build-start" ]
RUN apk --update add --virtual build-deps python3 python3-dev py3-numpy py-numpy-dev curl cmake build-base ninja zlib-dev linux-headers
RUN curl -L https://github.com/opencv/opencv/archive/3.4.3.tar.gz | tar xvz
RUN mkdir /build /install
WORKDIR /build
RUN cmake -G Ninja /opencv-3.4.3 \
          -DBUILD_PERF_TESTS=OFF \
          -DBUILD_TESTS=OFF \
          -DWITH_OPENCL=OFF \
          -DWITH_JPEG=OFF \
          -DWITH_JASPER=OFF \
          -DWITH_WEBP=OFF \
          -DWITH_TIFF=OFF \
          -DWITH_PNG=OFF \
          -DWITH_OPENEXR=OFF \
          -DWITH_IPP=OFF \
          -DWITH_ITT=OFF \
          -DWITH_PROTOBUF=OFF \
          -DWITH_V4L=ON \
          -DOPENCV_PYTHON3_VERSION=3.6 \
          -DCMAKE_INSTALL_PREFIX=/install
RUN ninja -j28
RUN ninja install
RUN find /install
RUN [ "cross-build-end" ]
FROM resin/aarch64-alpine
RUN [ "cross-build-start" ]
RUN apk --update --no-cache add python3 py3-numpy py3-paho-mqtt libstdc++
RUN [ "cross-build-end" ]
COPY --from=opencv-python \
     /install/lib64/ /usr/local/lib64/
COPY --from=opencv-python \
    /install/lib/ /usr/local/lib/
ENV LD_LIBRARY_PATH /usr/local/lib64:/usr/local/lib
ENV PYTHONPATH /usr/local/lib/python3.6/site-packages:/tmp/iot-edge-sdk-linux-python
RUN [ "cross-build-start" ]
COPY google_cloud_edge-0.8-py2.py3-none-any.whl /tmp/
RUN python3 -m pip install /tmp/google_cloud_edge-0.8-py2.py3-none-any.whl
RUN [ "cross-build-end" ]
WORKDIR /app
COPY capture.py /app/
ENTRYPOINT ["/usr/bin/python3", "/app/capture.py"]

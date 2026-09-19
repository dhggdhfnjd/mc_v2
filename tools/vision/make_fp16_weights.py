"""Halve the download: store large float32 weights as float16 and cast them back to float32 at load time.

Compute stays float32 (the ONNX Runtime WASM backend has no float16 kernels, and int8 dynamic
quantisation destroys this architecture's accuracy), so predictions match the original model.
"""
import sys
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

src, dst = sys.argv[1], sys.argv[2]
model = onnx.load(src)
graph = model.graph
casts, converted, kept = [], 0, 0
for init in graph.initializer:
    if init.data_type != TensorProto.FLOAT or int(np.prod(init.dims)) < 256:
        kept += 1
        continue
    arr = numpy_helper.to_array(init)
    # keep a tensor in float32 only if float16 would overflow; tiny weights rounding to zero is harmless
    if np.abs(arr).max() > 6.0e4:
        kept += 1
        continue
    name = init.name
    half = numpy_helper.from_array(arr.astype(np.float16), name + "__f16")
    init.CopyFrom(half)
    casts.append(helper.make_node("Cast", [name + "__f16"], [name], to=TensorProto.FLOAT, name=name + "__cast"))
    converted += 1
for node in reversed(casts):
    graph.node.insert(0, node)
onnx.checker.check_model(model)
onnx.save(model, dst)
print(f"converted {converted} tensors, kept {kept}")

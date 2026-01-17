#include <jni.h>
#include "NitroVoidhashOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::voidhash::initialize(vm);
}

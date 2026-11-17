# Third-party notices

This package is licensed under the MIT License in [LICENSE.md](LICENSE.md), except for the
third-party material below, which keeps its original license.

## Flutter engine text input and accessibility

The keyboard client of the `ui` module (`PaywallTextInput.kt`, `TextEditingState.kt`,
`TextInputConfig.kt` and `KeyboardInsets.kt` in `ui/src/main/java/com/voidhash/ui`) is adapted
from the Android embedder of the [Flutter](https://github.com/flutter/flutter) engine
(`TextInputPlugin.java`, `InputConnectionAdaptor.java`, `ListenableEditingState.java`,
`TextEditingDelta.java` and `ImeSyncDeferringInsetsCallback.java` in
`shell/platform/android/io/flutter/plugin/editing`). The text field handling of its accessibility
bridge (`PaywallAccessibility.kt`) is adapted from the same embedder's `AccessibilityBridge.java`
in `shell/platform/android/io/flutter/view`. Those files name the upstream copyright in their
header, and the adapted material is licensed under the BSD-3-Clause license:

```
Copyright 2013 The Flutter Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the following
      disclaimer in the documentation and/or other materials provided
      with the distribution.
    * Neither the name of Google Inc. nor the names of its
      contributors may be used to endorse or promote products derived
      from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

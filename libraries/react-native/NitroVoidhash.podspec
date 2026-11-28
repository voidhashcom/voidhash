require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroVoidhash"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/voidhashcom/react-native-voidhash.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]

  s.pod_target_xcconfig = {
    # C++ compiler flags, mainly for folly.
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES"
  }

  load 'nitrogen/generated/ios/NitroVoidhash+autolinking.rb'
  add_nitrogen_files(s)

  # The iOS SDK this bridge runs on, from Swift Package Manager: the public repository at this
  # package's own version, since the React Native, iOS and Android SDKs are released together.
  # Podfile globals, which the config plugin writes into the app target, choose what is linked:
  # `$VoidhashRenderer = true` adds the flow renderer (`VoidhashUI`), and
  # `$VoidhashNativeSdkPods = true` takes the SDK from pods the Podfile declares with `:path`
  # instead, to build it from source.
  # A prerelease build names, in `voidhash.nativeSdkVersion`, the released version it runs on.
  native_sdk_version = package.dig("voidhash", "nativeSdkVersion") || package["version"]
  voidhash_products = ["VoidhashCore", "Voidhash"]
  voidhash_products << "VoidhashUI" if defined?($VoidhashRenderer) && $VoidhashRenderer
  if defined?($VoidhashNativeSdkPods) && $VoidhashNativeSdkPods
    voidhash_products.each { |product| s.dependency product }
  else
    unless defined?(spm_dependency)
      raise "#{s.name} installs the Voidhash iOS SDK with Swift Package Manager through React Native's `spm_dependency`, which needs React Native 0.75 or later."
    end
    spm_dependency(s,
      url: "https://github.com/voidhashcom/voidhash",
      requirement: { kind: "exactVersion", version: native_sdk_version },
      products: voidhash_products
    )
  end
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end

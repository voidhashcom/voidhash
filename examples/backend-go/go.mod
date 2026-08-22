module github.com/voidhashcom/voidhash/examples/backend-go

go 1.22

require github.com/voidhashcom/voidhash-go v0.0.0

require (
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/google/uuid v1.5.0 // indirect
	github.com/oapi-codegen/runtime v1.1.1 // indirect
)

// The SDK is vendored next to this example inside the Voidhash repository.
// A real project deletes this replace and runs:
//
//	go get github.com/voidhashcom/voidhash-go
replace github.com/voidhashcom/voidhash-go => ../../libraries/go

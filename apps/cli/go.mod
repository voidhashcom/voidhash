module github.com/voidhashcom/voidhash/apps/cli

go 1.22

toolchain go1.26.7

require (
	github.com/spf13/cobra v1.10.2
	github.com/spf13/pflag v1.0.10
	github.com/voidhashcom/voidhash/libraries/go v0.0.0
	golang.org/x/term v0.27.0
)

require (
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/google/uuid v1.5.0 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/oapi-codegen/runtime v1.1.1 // indirect
	golang.org/x/sys v0.28.0 // indirect
)

replace github.com/voidhashcom/voidhash/libraries/go => ../../libraries/go

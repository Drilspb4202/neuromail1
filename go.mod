module mailslurp-example

go 1.23.0

toolchain go1.24.1

require (
	github.com/antihax/optional v1.0.0
	github.com/mailslurp/mailslurp-client-go v0.0.0
)

require (
	github.com/golang/protobuf v1.2.0 // indirect
	golang.org/x/net v0.37.0 // indirect
	golang.org/x/oauth2 v0.28.0 // indirect
	google.golang.org/appengine v1.4.0 // indirect
)

replace github.com/mailslurp/mailslurp-client-go => ./mailslurp-client-go

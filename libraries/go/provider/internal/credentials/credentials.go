// Package credentials lets providertest sign requests for a provider.Handler
// without the handler's signing secret becoming part of its public API.
package credentials

// Of returns the source slug and signing secret of a *provider.Handler.
// Package provider sets it when it is initialized.
var Of func(handler any) (source, secret string)

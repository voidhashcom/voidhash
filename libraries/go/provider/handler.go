// Package provider implements a payment source's provider endpoint: the
// HTTPS endpoint Voidhash calls to import a source's catalog and history, to
// refresh a subscription, and to cancel subscriptions and refund charges at
// the source.
//
// Implement any of [CatalogLister], [HistoryLister], [SubscriptionGetter],
// [SubscriptionCanceler] and [TransactionRefunder] on one value and mount the handler [NewHandler] builds for it:
//
//	h, err := provider.NewHandler("paddle", os.Getenv("VOIDHASH_PROVIDER_SECRET"), &Paddle{})
//	mux.Handle("POST /voidhash/provider", h)
//
// The handler verifies each request's signature, answers `describe` itself,
// validates what the implementation returns and replies in the protocol's
// shape. It uses only the standard library.
package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"runtime/debug"
	"sort"
	"time"

	"github.com/voidhashcom/voidhash-go/internal/signature"
	"github.com/voidhashcom/voidhash-go/provider/internal/credentials"
)

const (
	protocolVersion    = 1
	signatureHeader    = "x-voidhash-signature"
	timestampHeader    = "x-voidhash-timestamp"
	signatureTolerance = 300 * time.Second
	maxBodyBytes       = 1 << 20

	hiddenProviderErrorMessage = "The provider failed to handle the request"

	operationDescribe           = "describe"
	operationCatalogList        = "catalog.list"
	operationHistoryList        = "history.list"
	operationSubscriptionGet    = "subscription.get"
	operationSubscriptionCancel = "subscription.cancel"
	operationTransactionRefund  = "transaction.refund"
)

var errorStatus = map[string]int{
	"invalid_signature":     http.StatusUnauthorized,
	"invalid_request":       http.StatusBadRequest,
	"unsupported_operation": http.StatusNotFound,
	"not_found":             http.StatusNotFound,
	"unavailable":           http.StatusServiceUnavailable,
	"invalid_result":        http.StatusInternalServerError,
	"provider_error":        http.StatusInternalServerError,
}

func init() {
	credentials.Of = func(handler any) (string, string) {
		h := handler.(*Handler)
		return h.source, h.secret
	}
}

// Handler answers Voidhash's requests to a payment source's provider
// endpoint. Create one with [NewHandler]; it is safe for concurrent use.
type Handler struct {
	source string
	secret string
	impl   any
	now    func() time.Time
}

// NewHandler builds the endpoint handler for the source with the given slug,
// verifying requests with its signing secret (vhps_...). impl must implement
// at least one of [CatalogLister], [HistoryLister], [SubscriptionGetter],
// [SubscriptionCanceler] and [TransactionRefunder]; the operations it implements are the ones the endpoint supports.
func NewHandler(source, secret string, impl any) (*Handler, error) {
	if source == "" {
		return nil, errors.New("provider: source is required")
	}
	if secret == "" {
		return nil, errors.New("provider: signing secret is required")
	}
	h := &Handler{source: source, secret: secret, impl: impl, now: time.Now}
	if len(h.operations()) == 1 {
		return nil, errors.New("provider: impl must implement at least one of CatalogLister, HistoryLister, SubscriptionGetter, SubscriptionCanceler and TransactionRefunder")
	}
	return h, nil
}

// operations lists the supported operations, sorted, including describe.
func (h *Handler) operations() []string {
	operations := []string{operationDescribe}
	if _, ok := h.impl.(CatalogLister); ok {
		operations = append(operations, operationCatalogList)
	}
	if _, ok := h.impl.(HistoryLister); ok {
		operations = append(operations, operationHistoryList)
	}
	if _, ok := h.impl.(SubscriptionGetter); ok {
		operations = append(operations, operationSubscriptionGet)
	}
	if _, ok := h.impl.(SubscriptionCanceler); ok {
		operations = append(operations, operationSubscriptionCancel)
	}
	if _, ok := h.impl.(TransactionRefunder); ok {
		operations = append(operations, operationTransactionRefund)
	}
	sort.Strings(operations)
	return operations
}

type requestEnvelope struct {
	ProtocolVersion json.RawMessage `json:"protocolVersion"`
	ID              json.RawMessage `json:"id"`
	Source          json.RawMessage `json:"source"`
	Environment     json.RawMessage `json:"environment"`
	Operation       json.RawMessage `json:"operation"`
	Input           json.RawMessage `json:"input"`
}

// failure is a protocol error the handler answers with.
type failure struct {
	code    string
	message string
}

// ServeHTTP verifies, dispatches and answers one request.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err != nil {
		writeFailure(w, nil, failure{"invalid_request", "The request body could not be read"})
		return
	}
	timestamps := r.Header.Values(timestampHeader)
	signatures := r.Header.Values(signatureHeader)
	if len(timestamps) != 1 || len(signatures) != 1 ||
		!signature.Verify(body, signatures[0], timestamps[0], h.secret, signatureTolerance, h.now()) {
		writeFailure(w, nil, failure{"invalid_signature", "The request signature is missing, wrong or expired"})
		return
	}

	var envelope requestEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		writeFailure(w, nil, failure{"invalid_request", "The request body is not a JSON object"})
		return
	}
	var id *string
	_ = json.Unmarshal(envelope.ID, &id)

	result, fail := h.handle(r.Context(), envelope, id)
	if fail != nil {
		writeFailure(w, id, *fail)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		ID     *string `json:"id"`
		Result any     `json:"result"`
	}{id, result})
}

func (h *Handler) handle(ctx context.Context, envelope requestEnvelope, id *string) (any, *failure) {
	var version float64
	if json.Unmarshal(envelope.ProtocolVersion, &version) != nil || version != protocolVersion {
		return nil, &failure{"invalid_request", fmt.Sprintf("Only protocol version %d is supported", protocolVersion)}
	}
	if id == nil {
		return nil, &failure{"invalid_request", "id must be a string"}
	}
	var source string
	if json.Unmarshal(envelope.Source, &source) != nil || source != h.source {
		return nil, &failure{"invalid_request", fmt.Sprintf("This endpoint serves the source %q", h.source)}
	}
	var environment Environment
	if json.Unmarshal(envelope.Environment, &environment) != nil ||
		(environment != EnvironmentProduction && environment != EnvironmentTest) {
		return nil, &failure{"invalid_request", "environment must be production or test"}
	}
	var operation string
	if json.Unmarshal(envelope.Operation, &operation) != nil {
		return nil, &failure{"invalid_request", "operation must be a string"}
	}

	switch operation {
	case operationDescribe:
		return h.describe(), nil

	case operationCatalogList:
		lister, ok := h.impl.(CatalogLister)
		if !ok {
			break
		}
		input, err := decodeInput(envelope.Input)
		if err != nil {
			return nil, invalidInput(err)
		}
		req := CatalogRequest{RequestID: *id, Environment: environment}
		if req.Cursor, err = input.cursor(); err != nil {
			return nil, invalidInput(err)
		}
		page, err := lister.ListCatalog(ctx, req)
		if err != nil {
			return nil, providerFailure(err, environment)
		}
		if err := validateCatalogPage(page); err != nil {
			return nil, invalidResult(err)
		}
		if page.Items == nil {
			page.Items = []CatalogProduct{}
		}
		return page, nil

	case operationHistoryList:
		lister, ok := h.impl.(HistoryLister)
		if !ok {
			break
		}
		input, err := decodeInput(envelope.Input)
		if err != nil {
			return nil, invalidInput(err)
		}
		req := HistoryRequest{RequestID: *id, Environment: environment}
		if req.Kind, err = input.historyKind(); err != nil {
			return nil, invalidInput(err)
		}
		if req.Cursor, err = input.cursor(); err != nil {
			return nil, invalidInput(err)
		}
		if req.Before, err = input.time("before"); err != nil {
			return nil, invalidInput(err)
		}
		page, err := lister.ListHistory(ctx, req)
		if err != nil {
			return nil, providerFailure(err, environment)
		}
		items, err := historyItems(req.Kind, page)
		if err != nil {
			return nil, invalidResult(err)
		}
		return struct {
			Items      any     `json:"items"`
			NextCursor *string `json:"nextCursor"`
		}{items, page.NextCursor}, nil

	case operationSubscriptionGet:
		getter, ok := h.impl.(SubscriptionGetter)
		if !ok {
			break
		}
		input, err := decodeInput(envelope.Input)
		if err != nil {
			return nil, invalidInput(err)
		}
		req := SubscriptionRequest{RequestID: *id, Environment: environment}
		if req.ID, err = input.boundedString("id", maxRecordIDLength); err != nil {
			return nil, invalidInput(err)
		}
		subscription, err := getter.GetSubscription(ctx, req)
		if err != nil {
			return nil, providerFailure(err, environment)
		}
		if subscription != nil {
			if err := validateSubscription(*subscription); err != nil {
				return nil, invalidResult(fmt.Errorf("subscription.%w", err))
			}
		}
		return struct {
			Subscription *Subscription `json:"subscription"`
		}{subscription}, nil

	case operationSubscriptionCancel:
		canceler, ok := h.impl.(SubscriptionCanceler)
		if !ok {
			break
		}
		input, err := decodeInput(envelope.Input)
		if err != nil {
			return nil, invalidInput(err)
		}
		req := CancelRequest{RequestID: *id, Environment: environment}
		if req.ID, err = input.boundedString("id", maxRecordIDLength); err != nil {
			return nil, invalidInput(err)
		}
		if req.AtPeriodEnd, err = input.boolean("atPeriodEnd"); err != nil {
			return nil, invalidInput(err)
		}
		subscription, err := canceler.CancelSubscription(ctx, req)
		if err != nil {
			return nil, providerFailure(err, environment)
		}
		if err := validateSubscription(subscription); err != nil {
			return nil, invalidResult(fmt.Errorf("subscription.%w", err))
		}
		return struct {
			Subscription Subscription `json:"subscription"`
		}{subscription}, nil

	case operationTransactionRefund:
		refunder, ok := h.impl.(TransactionRefunder)
		if !ok {
			break
		}
		input, err := decodeInput(envelope.Input)
		if err != nil {
			return nil, invalidInput(err)
		}
		req := RefundRequest{RequestID: *id, Environment: environment}
		if req.TransactionID, err = input.boundedString("transactionId", maxRecordIDLength); err != nil {
			return nil, invalidInput(err)
		}
		if req.Amount, err = input.minorAmount("amount"); err != nil {
			return nil, invalidInput(err)
		}
		if req.Reason, err = input.reason(); err != nil {
			return nil, invalidInput(err)
		}
		refund, err := refunder.RefundTransaction(ctx, req)
		if err != nil {
			return nil, providerFailure(err, environment)
		}
		if err := validateTransaction(refund); err != nil {
			return nil, invalidResult(fmt.Errorf("refund.%w", err))
		}
		if refund.Type != TransactionRefund {
			return nil, invalidResult(fmt.Errorf("refund.type must be refund, not %q", refund.Type))
		}
		return struct {
			Refund Transaction `json:"refund"`
		}{refund}, nil
	}
	return nil, &failure{"unsupported_operation", fmt.Sprintf("This endpoint does not implement %q", operation)}
}

type sdkInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

func (h *Handler) describe() any {
	return struct {
		ProtocolVersion int      `json:"protocolVersion"`
		Source          string   `json:"source"`
		Operations      []string `json:"operations"`
		SDK             sdkInfo  `json:"sdk"`
	}{protocolVersion, h.source, h.operations(), sdkInfo{"voidhash-go", moduleVersion()}}
}

// moduleVersion is the version of this module in the running binary, or
// "devel" when it is not built as a dependency.
func moduleVersion() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "devel"
	}
	for _, dep := range info.Deps {
		if dep.Path == "github.com/voidhashcom/voidhash-go" {
			return dep.Version
		}
	}
	return "devel"
}

// historyItems returns the page's records of the requested kind, validated.
func historyItems(kind HistoryKind, page HistoryPage) (any, error) {
	if len(page.Subscriptions) > 0 && len(page.Transactions) > 0 {
		return nil, errors.New("a history page holds either subscriptions or transactions, not both")
	}
	if kind == HistorySubscriptions {
		if len(page.Transactions) > 0 {
			return nil, errors.New("a page of subscriptions holds transactions")
		}
		if err := validatePageLength(len(page.Subscriptions)); err != nil {
			return nil, err
		}
		for i, subscription := range page.Subscriptions {
			if err := validateSubscription(subscription); err != nil {
				return nil, fmt.Errorf("items[%d].%w", i, err)
			}
		}
		if page.Subscriptions == nil {
			return []Subscription{}, nil
		}
		return page.Subscriptions, nil
	}
	if len(page.Subscriptions) > 0 {
		return nil, errors.New("a page of transactions holds subscriptions")
	}
	if err := validatePageLength(len(page.Transactions)); err != nil {
		return nil, err
	}
	for i, transaction := range page.Transactions {
		if err := validateTransaction(transaction); err != nil {
			return nil, fmt.Errorf("items[%d].%w", i, err)
		}
	}
	if page.Transactions == nil {
		return []Transaction{}, nil
	}
	return page.Transactions, nil
}

func invalidInput(err error) *failure {
	return &failure{"invalid_request", "Invalid input: " + err.Error()}
}

func invalidResult(err error) *failure {
	return &failure{"invalid_result", "The provider returned an invalid result: " + err.Error()}
}

// providerFailure answers an error from the implementation: an [*Error] with
// a known code as it is, anything else as provider_error, whose message only
// the test environment sees.
func providerFailure(err error, environment Environment) *failure {
	var providerErr *Error
	if errors.As(err, &providerErr) {
		switch providerErr.Code {
		case CodeInvalidRequest, CodeNotFound, CodeUnavailable:
			return &failure{string(providerErr.Code), providerErr.Message}
		}
	}
	if environment == EnvironmentTest {
		return &failure{"provider_error", err.Error()}
	}
	return &failure{"provider_error", hiddenProviderErrorMessage}
}

func writeFailure(w http.ResponseWriter, id *string, fail failure) {
	type errorBody struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	writeJSON(w, errorStatus[fail.code], struct {
		ID    *string   `json:"id"`
		Error errorBody `json:"error"`
	}{id, errorBody{fail.code, fail.message}})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	encoded, err := json.Marshal(body)
	if err != nil {
		status = http.StatusInternalServerError
		encoded = []byte(`{"id":null,"error":{"code":"invalid_result","message":"The result could not be encoded"}}`)
	}
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	w.Write(encoded)
}

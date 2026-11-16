package voidhash

import (
	"context"
	"net/http"
	"time"

	"github.com/voidhashcom/voidhash-go/api"
)

// PaymentSourcesService reports payments from providers Voidhash does not
// integrate natively. Pick a source with [PaymentSourcesService.Source].
type PaymentSourcesService struct {
	client *Client
}

// Source returns a handle that reports payments for the payment source with
// the given id (pp_conf_...), the last part of the address of its page in
// Studio. The source's slug names it only to its provider endpoint.
func (s *PaymentSourcesService) Source(paymentProviderID string) *PaymentSource {
	return &PaymentSource{client: s.client, paymentProviderID: paymentProviderID}
}

// PaymentSource reports transactions and subscription states for one payment
// source. Every record is addressed by the source's own id: sending the same
// record again returns the recorded result, and a different record under a
// recorded id fails with a 409 [*APIError] whose Code is
// "transaction_conflict".
type PaymentSource struct {
	client            *Client
	paymentProviderID string
}

// PaymentSourceEnvironment is the environment a payment belongs to.
type PaymentSourceEnvironment = api.PaymentSourceEnvironment

const (
	PaymentSourceProduction = api.PaymentSourceEnvironmentProduction
	PaymentSourceTest       = api.PaymentSourceEnvironmentTest
)

// PaymentSourceSubscriptionStatus is a subscription's state at the source.
type PaymentSourceSubscriptionStatus = api.RecordPaymentSourceSubscriptionBodyStatus

const (
	PaymentSourceSubscriptionTrialing = api.RecordPaymentSourceSubscriptionBodyStatusTrialing
	PaymentSourceSubscriptionActive   = api.RecordPaymentSourceSubscriptionBodyStatusActive
	PaymentSourceSubscriptionPastDue  = api.RecordPaymentSourceSubscriptionBodyStatusPastDue
	PaymentSourceSubscriptionCanceled = api.RecordPaymentSourceSubscriptionBodyStatusCanceled
	PaymentSourceSubscriptionExpired  = api.RecordPaymentSourceSubscriptionBodyStatusExpired
)

// ChargeParams describes a charge. Name the buyer with DistinctID, CustomerID
// or both. Amounts are integers in minor units (cents).
type ChargeParams struct {
	// DistinctID is the buyer's distinct id, as the client SDKs identify them.
	DistinctID *string
	// CustomerID is the source's own id for the buyer.
	CustomerID *string
	// ProductKey is the source's product key, mapped to a product in Voidhash.
	ProductKey string
	Amount     int64
	// Currency is a three-letter ISO 4217 code.
	Currency string
	// Fee is the source's commission.
	Fee        *int64
	Tax        *int64
	OccurredAt time.Time
	// SubscriptionID, PeriodStart and PeriodEnd name the subscription period
	// the charge pays for. Leave them unset for a one-time purchase.
	SubscriptionID *string
	PeriodStart    *time.Time
	PeriodEnd      *time.Time
	// Environment defaults to production.
	Environment PaymentSourceEnvironment
}

// RefundParams describes a refund of a recorded charge. It takes the charge's
// buyer, product and environment; any of them repeated here must match.
type RefundParams struct {
	// RefundsTransactionID is the id of the charge the refund returns money for.
	RefundsTransactionID string
	// Amount is what the refund returns, in minor units; refunding everything
	// left of the charge ends its access.
	Amount int64
	// Currency must be the charge's.
	Currency   string
	Fee        *int64
	Tax        *int64
	OccurredAt time.Time
	DistinctID *string
	CustomerID *string
	ProductKey *string
	// Environment defaults to production.
	Environment PaymentSourceEnvironment
}

// SubscriptionParams describes a subscription's latest state. It carries no
// money: report what each period costs with [PaymentSource.Charge].
type SubscriptionParams struct {
	// DistinctID is the subscriber's distinct id, as the client SDKs identify them.
	DistinctID *string
	// CustomerID is the source's own id for the subscriber.
	CustomerID         *string
	ProductKey         string
	Status             PaymentSourceSubscriptionStatus
	CurrentPeriodStart time.Time
	CurrentPeriodEnd   time.Time
	// IsAutoRenewing reports a subscription that renews at the end of the
	// current period.
	IsAutoRenewing bool
	// CanceledAt is when access ended for a canceled subscription; UpdatedAt
	// is used when it is unset.
	CanceledAt *time.Time
	// UpdatedAt orders a subscription's states: a state older than the
	// recorded one is answered superseded and changes nothing.
	UpdatedAt time.Time
	// Environment defaults to production.
	Environment PaymentSourceEnvironment
}

// Charge records a charge under the source's transaction id.
func (s *PaymentSource) Charge(ctx context.Context, transactionID string, params ChargeParams) (*PaymentSourceTransaction, error) {
	return s.recordTransaction(ctx, transactionID, api.RecordPaymentSourceTransactionBody{
		Type:           api.RecordPaymentSourceTransactionBodyTypeCharge,
		DistinctId:     params.DistinctID,
		Customer:       paymentSourceCustomer(params.CustomerID),
		ProductKey:     &params.ProductKey,
		Amount:         int(params.Amount),
		Currency:       params.Currency,
		Fee:            optionalInt(params.Fee),
		Tax:            optionalInt(params.Tax),
		OccurredAt:     formatPaymentSourceTime(params.OccurredAt),
		SubscriptionId: params.SubscriptionID,
		PeriodStart:    optionalPaymentSourceTime(params.PeriodStart),
		PeriodEnd:      optionalPaymentSourceTime(params.PeriodEnd),
		Environment:    paymentSourceEnvironment(params.Environment),
	})
}

// Refund records a refund under the source's transaction id.
func (s *PaymentSource) Refund(ctx context.Context, transactionID string, params RefundParams) (*PaymentSourceTransaction, error) {
	return s.recordTransaction(ctx, transactionID, api.RecordPaymentSourceTransactionBody{
		Type:                 api.RecordPaymentSourceTransactionBodyTypeRefund,
		RefundsTransactionId: &params.RefundsTransactionID,
		DistinctId:           params.DistinctID,
		Customer:             paymentSourceCustomer(params.CustomerID),
		ProductKey:           params.ProductKey,
		Amount:               int(params.Amount),
		Currency:             params.Currency,
		Fee:                  optionalInt(params.Fee),
		Tax:                  optionalInt(params.Tax),
		OccurredAt:           formatPaymentSourceTime(params.OccurredAt),
		Environment:          paymentSourceEnvironment(params.Environment),
	})
}

func (s *PaymentSource) recordTransaction(ctx context.Context, transactionID string, body api.RecordPaymentSourceTransactionBody) (*PaymentSourceTransaction, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	transaction := &PaymentSourceTransaction{}
	err = s.client.call(transaction, func() (*http.Response, error) {
		return s.client.core.PaymentSourcesUpsertTransaction(ctx, projectID, s.paymentProviderID, transactionID, body)
	})
	return transaction, err
}

// Subscription records a subscription's latest state under the source's
// subscription id.
func (s *PaymentSource) Subscription(ctx context.Context, subscriptionID string, params SubscriptionParams) (*PaymentSourceSubscription, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	subscription := &PaymentSourceSubscription{}
	err = s.client.call(subscription, func() (*http.Response, error) {
		return s.client.core.PaymentSourcesUpsertSubscription(ctx, projectID, s.paymentProviderID, subscriptionID, api.RecordPaymentSourceSubscriptionBody{
			DistinctId:         params.DistinctID,
			Customer:           paymentSourceCustomer(params.CustomerID),
			ProductKey:         params.ProductKey,
			Status:             params.Status,
			CurrentPeriodStart: formatPaymentSourceTime(params.CurrentPeriodStart),
			CurrentPeriodEnd:   formatPaymentSourceTime(params.CurrentPeriodEnd),
			IsAutoRenewing:     params.IsAutoRenewing,
			CanceledAt:         optionalPaymentSourceTime(params.CanceledAt),
			UpdatedAt:          formatPaymentSourceTime(params.UpdatedAt),
			Environment:        paymentSourceEnvironment(params.Environment),
		})
	})
	return subscription, err
}

// CancelSubscriptionParams describes how to cancel a subscription at its
// source.
type CancelSubscriptionParams struct {
	// IsImmediate ends access at once; false (the default) keeps it until the
	// current period ends.
	IsImmediate bool
}

// CancelSubscription asks the source to cancel a recorded subscription,
// through the source's provider endpoint, and records the state it answers
// with. When the endpoint cannot act it fails with a 409 [*APIError] (Code
// "payment_source_endpoint_not_configured", "..._unsupported" or
// "..._rejected") or a 503 one ("payment_source_endpoint_unavailable" or
// "..._invalid_response"), whose Message says why.
func (s *PaymentSource) CancelSubscription(ctx context.Context, subscriptionID string, params CancelSubscriptionParams) (*PaymentSourceSubscription, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	subscription := &PaymentSourceSubscription{}
	err = s.client.call(subscription, func() (*http.Response, error) {
		return s.client.core.PaymentSourcesCancelSubscription(ctx, projectID, s.paymentProviderID, subscriptionID, api.CancelPaymentSourceSubscriptionBody{
			IsImmediate: &params.IsImmediate,
		})
	})
	return subscription, err
}

// RefundTransactionParams describes a refund for the source to make.
type RefundTransactionParams struct {
	// Amount is what to return, in minor units; nil refunds everything left
	// of the charge.
	Amount *int64
	// Reason is passed to the source.
	Reason *string
}

// RefundTransaction asks the source to refund a recorded charge, through the
// source's provider endpoint, and records the refund it answers with. To
// report a refund the source already made, use [PaymentSource.Refund]. It
// fails like [PaymentSource.CancelSubscription] when the endpoint cannot act.
func (s *PaymentSource) RefundTransaction(ctx context.Context, transactionID string, params RefundTransactionParams) (*PaymentSourceTransaction, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	transaction := &PaymentSourceTransaction{}
	err = s.client.call(transaction, func() (*http.Response, error) {
		return s.client.core.PaymentSourcesRefundTransaction(ctx, projectID, s.paymentProviderID, transactionID, api.RefundPaymentSourceTransactionBody{
			Amount: optionalInt(params.Amount),
			Reason: params.Reason,
		})
	})
	return transaction, err
}

func paymentSourceCustomer(customerID *string) *api.PaymentSourceCustomer {
	if customerID == nil {
		return nil
	}
	return &api.PaymentSourceCustomer{ExternalId: *customerID}
}

func paymentSourceEnvironment(environment PaymentSourceEnvironment) *PaymentSourceEnvironment {
	if environment == "" {
		return nil
	}
	return &environment
}

func optionalInt(value *int64) *int {
	if value == nil {
		return nil
	}
	converted := int(*value)
	return &converted
}

// formatPaymentSourceTime writes a date as an ISO 8601 UTC string with
// milliseconds.
func formatPaymentSourceTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func optionalPaymentSourceTime(t *time.Time) *string {
	if t == nil {
		return nil
	}
	formatted := formatPaymentSourceTime(*t)
	return &formatted
}

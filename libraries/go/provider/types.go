package provider

import (
	"context"
	"encoding/json"
	"time"
)

// CatalogLister lists the products a source sells, so Voidhash can import them
// as products. Implement it to answer `catalog.list`.
type CatalogLister interface {
	ListCatalog(ctx context.Context, req CatalogRequest) (CatalogPage, error)
}

// HistoryLister pages through a source's past subscriptions and transactions,
// so Voidhash can import them. Implement it to answer `history.list`.
type HistoryLister interface {
	ListHistory(ctx context.Context, req HistoryRequest) (HistoryPage, error)
}

// SubscriptionGetter returns a subscription's current state, so Voidhash can
// refresh one whose period ended without a renewal. Implement it to answer
// `subscription.get`. Return a nil subscription when the source does not know
// the id.
type SubscriptionGetter interface {
	GetSubscription(ctx context.Context, req SubscriptionRequest) (*Subscription, error)
}

// SubscriptionCanceler cancels a subscription at the source when Voidhash
// asks for it, for example from the dashboard. Implement it to answer
// `subscription.cancel`. Return the subscription's state afterwards; Voidhash
// records it as if the source had pushed it.
type SubscriptionCanceler interface {
	CancelSubscription(ctx context.Context, req CancelRequest) (Subscription, error)
}

// TransactionRefunder refunds a charge at the source when Voidhash asks for
// it. Implement it to answer `transaction.refund`. Return the refund, a
// [Transaction] of type [TransactionRefund]; Voidhash records it as if the
// source had pushed it.
type TransactionRefunder interface {
	RefundTransaction(ctx context.Context, req RefundRequest) (Transaction, error)
}

// Environment is the environment a request is for.
type Environment string

const (
	EnvironmentProduction Environment = "production"
	EnvironmentTest       Environment = "test"
)

// CatalogRequest asks for one page of the catalog.
type CatalogRequest struct {
	// RequestID is unique per request; useful in logs.
	RequestID   string
	Environment Environment
	// Cursor is the NextCursor of the previous page, or nil for the first page.
	Cursor *string
}

// CatalogPage is one page of the catalog.
type CatalogPage struct {
	Items []CatalogProduct `json:"items"`
	// NextCursor continues the catalog; nil on the last page.
	NextCursor *string `json:"nextCursor"`
}

// ProductKind is what kind of purchase a catalog product is.
type ProductKind string

const (
	ProductKindSubscription ProductKind = "subscription"
	ProductKindOneTime      ProductKind = "one_time"
	ProductKindConsumable   ProductKind = "consumable"
)

// CatalogProduct is one product a source sells.
type CatalogProduct struct {
	// Key is the product key payments name in ProductKey.
	Key  string      `json:"key"`
	Name string      `json:"name"`
	Kind ProductKind `json:"kind"`
}

// HistoryKind selects which records a history page holds.
type HistoryKind string

const (
	HistorySubscriptions HistoryKind = "subscriptions"
	HistoryTransactions  HistoryKind = "transactions"
)

// HistoryRequest asks for one page of past records of one kind.
type HistoryRequest struct {
	// RequestID is unique per request; useful in logs.
	RequestID   string
	Environment Environment
	Kind        HistoryKind
	// Cursor is the NextCursor of the previous page, or nil for the first page.
	Cursor *string
	// Before is when the import started. Return records created before it;
	// later ones reach Voidhash through the push endpoints.
	Before time.Time
}

// HistoryPage is one page of history. Fill Subscriptions when the request's
// Kind is [HistorySubscriptions] and Transactions when it is
// [HistoryTransactions]; the other must stay empty.
type HistoryPage struct {
	Subscriptions []Subscription
	Transactions  []Transaction
	// NextCursor continues the history; nil on the last page.
	NextCursor *string
}

// SubscriptionRequest asks for one subscription's current state.
type SubscriptionRequest struct {
	// RequestID is unique per request; useful in logs.
	RequestID   string
	Environment Environment
	// ID is the source's id of the subscription.
	ID string
}

// CancelRequest asks to cancel one subscription.
type CancelRequest struct {
	// RequestID is unique per request; useful in logs.
	RequestID   string
	Environment Environment
	// ID is the source's id of the subscription.
	ID string
	// AtPeriodEnd keeps access until the current period ends; false cancels
	// at once.
	AtPeriodEnd bool
}

// RefundRequest asks to refund one charge.
type RefundRequest struct {
	// RequestID is unique per request; useful in logs.
	RequestID   string
	Environment Environment
	// TransactionID is the source's id of the charge.
	TransactionID string
	// Amount is what to return, in minor units; nil refunds everything left
	// of the charge.
	Amount *int64
	// Reason is why the refund was asked for, when given.
	Reason *string
}

// Customer identifies a buyer by the source's own customer id.
type Customer struct {
	ExternalID string `json:"externalId"`
}

// TransactionType is whether a transaction takes or returns money.
type TransactionType string

const (
	TransactionCharge TransactionType = "charge"
	TransactionRefund TransactionType = "refund"
)

// Transaction is a charge or refund, in the shape the push endpoint takes it,
// with its id. Amounts are integers in minor units (cents).
type Transaction struct {
	ID         string          `json:"id"`
	Type       TransactionType `json:"type"`
	DistinctID *string         `json:"distinctId,omitempty"`
	Customer   *Customer       `json:"customer,omitempty"`
	ProductKey *string         `json:"productKey,omitempty"`
	Amount     int64           `json:"amount"`
	// Currency is a three-letter ISO 4217 code.
	Currency string `json:"currency"`
	// Fee is the source's commission.
	Fee        *int64    `json:"fee,omitempty"`
	Tax        *int64    `json:"tax,omitempty"`
	OccurredAt time.Time `json:"occurredAt"`
	// SubscriptionID, PeriodStart and PeriodEnd name the subscription period
	// a charge pays for.
	SubscriptionID *string    `json:"subscriptionId,omitempty"`
	PeriodStart    *time.Time `json:"periodStart,omitempty"`
	PeriodEnd      *time.Time `json:"periodEnd,omitempty"`
	// RefundsTransactionID is the charge a refund returns money for.
	RefundsTransactionID *string `json:"refundsTransactionId,omitempty"`
}

// MarshalJSON writes dates as ISO 8601 UTC strings with milliseconds.
func (t Transaction) MarshalJSON() ([]byte, error) {
	type plain Transaction
	return json.Marshal(struct {
		plain
		OccurredAt  string  `json:"occurredAt"`
		PeriodStart *string `json:"periodStart,omitempty"`
		PeriodEnd   *string `json:"periodEnd,omitempty"`
	}{plain(t), formatTime(t.OccurredAt), formatOptionalTime(t.PeriodStart), formatOptionalTime(t.PeriodEnd)})
}

// SubscriptionStatus is a subscription's state at the source.
type SubscriptionStatus string

const (
	SubscriptionTrialing SubscriptionStatus = "trialing"
	SubscriptionActive   SubscriptionStatus = "active"
	SubscriptionPastDue  SubscriptionStatus = "past_due"
	SubscriptionCanceled SubscriptionStatus = "canceled"
	SubscriptionExpired  SubscriptionStatus = "expired"
)

// Subscription is a subscription's latest state, in the shape the push
// endpoint takes it, with its id.
type Subscription struct {
	ID                 string             `json:"id"`
	DistinctID         *string            `json:"distinctId,omitempty"`
	Customer           *Customer          `json:"customer,omitempty"`
	ProductKey         string             `json:"productKey"`
	Status             SubscriptionStatus `json:"status"`
	CurrentPeriodStart time.Time          `json:"currentPeriodStart"`
	CurrentPeriodEnd   time.Time          `json:"currentPeriodEnd"`
	WillRenew          bool               `json:"willRenew"`
	CanceledAt         *time.Time         `json:"canceledAt,omitempty"`
	// UpdatedAt orders a subscription's states; an older one never replaces
	// a newer one.
	UpdatedAt time.Time `json:"updatedAt"`
}

// MarshalJSON writes dates as ISO 8601 UTC strings with milliseconds.
func (s Subscription) MarshalJSON() ([]byte, error) {
	type plain Subscription
	return json.Marshal(struct {
		plain
		CurrentPeriodStart string  `json:"currentPeriodStart"`
		CurrentPeriodEnd   string  `json:"currentPeriodEnd"`
		CanceledAt         *string `json:"canceledAt,omitempty"`
		UpdatedAt          string  `json:"updatedAt"`
	}{plain(s), formatTime(s.CurrentPeriodStart), formatTime(s.CurrentPeriodEnd), formatOptionalTime(s.CanceledAt), formatTime(s.UpdatedAt)})
}

func formatTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func formatOptionalTime(t *time.Time) *string {
	if t == nil {
		return nil
	}
	formatted := formatTime(*t)
	return &formatted
}

// ErrorCode is a failure a provider can report on purpose.
type ErrorCode string

const (
	// CodeInvalidRequest reports that the input cannot be served.
	CodeInvalidRequest ErrorCode = "invalid_request"
	// CodeNotFound reports that nothing exists for the input.
	CodeNotFound ErrorCode = "not_found"
	// CodeUnavailable reports that the source's upstream is down; Voidhash
	// retries later.
	CodeUnavailable ErrorCode = "unavailable"
)

// Error is a failure a provider reports on purpose; the handler answers with
// its Code and Message as they are. It is found with errors.As, so it may be
// wrapped. Any other error is answered as `provider_error`, with its message
// shown only in the test environment.
type Error struct {
	Code    ErrorCode
	Message string
}

// Error implements the error interface.
func (e *Error) Error() string {
	return string(e.Code) + ": " + e.Message
}

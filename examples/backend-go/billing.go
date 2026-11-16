package main

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/voidhashcom/voidhash-go/provider"
)

// billingPageSize is how many records one history page holds.
const billingPageSize = 100

// billingProducts is what Nimbus sells through its own billing provider. The
// keys map to the Nimbus products in Voidhash when the catalog is imported.
var billingProducts = []provider.CatalogProduct{
	{Key: "pro-monthly", Name: "Nimbus Pro monthly", Kind: provider.ProductKindSubscription},
	{Key: "pro-annual", Name: "Nimbus Pro annual", Kind: provider.ProductKindSubscription},
	{Key: "pro-lifetime", Name: "Nimbus Pro lifetime", Kind: provider.ProductKindOneTime},
}

// billingPrices are the products' prices in euro cents.
var billingPrices = map[string]int64{"pro-monthly": 499, "pro-annual": 3999, "pro-lifetime": 9999}

// fakeBilling stands in for a payment provider Voidhash does not integrate
// natively, such as Paddle or an in-house invoicing system. It keeps its
// checkouts, subscriptions and transactions in memory; a real integration
// calls the provider's API in the same places.
//
// It implements every operation of the provider endpoint, so Voidhash can
// import its catalog and history, refresh a subscription, and cancel and
// refund from Studio.
type fakeBilling struct {
	mu            sync.Mutex
	nextID        int
	checkouts     map[string]billingCheckout
	subscriptions []billingRecord[provider.Subscription]
	transactions  []billingRecord[provider.Transaction]
	// events remembers applied webhook events, so a redelivery returns the
	// same records instead of charging twice.
	events map[string]billingPayment
}

// billingCheckout is a checkout open at the provider. It carries the buyer's
// Voidhash distinct id, the way a real provider's checkout carries it in its
// metadata, so the payment it ends in names the same person.
type billingCheckout struct {
	distinctID string
	productKey string
}

type billingRecord[T any] struct {
	createdAt time.Time
	value     T
}

// billingPayment is a paid subscription period: the subscription's state
// afterwards and the charge for the period.
type billingPayment struct {
	subscription provider.Subscription
	charge       provider.Transaction
}

func newFakeBilling() *fakeBilling {
	return &fakeBilling{checkouts: map[string]billingCheckout{}, events: map[string]billingPayment{}}
}

func (b *fakeBilling) newIDLocked(prefix string) string {
	b.nextID++
	return fmt.Sprintf("%s_%d", prefix, b.nextID)
}

// ListCatalog answers `catalog.list`. The catalog fits one page.
func (b *fakeBilling) ListCatalog(context.Context, provider.CatalogRequest) (provider.CatalogPage, error) {
	return provider.CatalogPage{Items: billingProducts}, nil
}

// ListHistory answers `history.list`: records created before req.Before,
// oldest first, a page at a time. The cursor is the next record's offset.
func (b *fakeBilling) ListHistory(_ context.Context, req provider.HistoryRequest) (provider.HistoryPage, error) {
	offset := 0
	if req.Cursor != nil {
		parsed, err := strconv.Atoi(*req.Cursor)
		if err != nil || parsed < 0 {
			return provider.HistoryPage{}, &provider.Error{Code: provider.CodeInvalidRequest, Message: "Unknown cursor"}
		}
		offset = parsed
	}

	b.mu.Lock()
	defer b.mu.Unlock()
	if req.Kind == provider.HistorySubscriptions {
		items, next := historyPage(b.subscriptions, req.Before, offset)
		return provider.HistoryPage{Subscriptions: items, NextCursor: next}, nil
	}
	items, next := historyPage(b.transactions, req.Before, offset)
	return provider.HistoryPage{Transactions: items, NextCursor: next}, nil
}

func historyPage[T any](records []billingRecord[T], before time.Time, offset int) ([]T, *string) {
	var items []T
	for i := offset; i < len(records); i++ {
		if !records[i].createdAt.Before(before) {
			continue
		}
		if len(items) == billingPageSize {
			next := strconv.Itoa(i)
			return items, &next
		}
		items = append(items, records[i].value)
	}
	return items, nil
}

// GetSubscription answers `subscription.get`; nil tells Voidhash the
// subscription does not exist.
func (b *fakeBilling) GetSubscription(_ context.Context, req provider.SubscriptionRequest) (*provider.Subscription, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if i := b.subscriptionIndexLocked(req.ID); i >= 0 {
		subscription := b.subscriptions[i].value
		return &subscription, nil
	}
	return nil, nil
}

// CancelSubscription answers `subscription.cancel` with the state afterwards.
func (b *fakeBilling) CancelSubscription(_ context.Context, req provider.CancelRequest) (provider.Subscription, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	i := b.subscriptionIndexLocked(req.ID)
	if i < 0 {
		return provider.Subscription{}, &provider.Error{Code: provider.CodeNotFound, Message: "No subscription " + req.ID}
	}
	subscription := &b.subscriptions[i].value
	now := time.Now()
	subscription.WillRenew = false
	if !req.AtPeriodEnd {
		subscription.Status = provider.SubscriptionCanceled
		subscription.CanceledAt = &now
	}
	subscription.UpdatedAt = now
	return *subscription, nil
}

// RefundTransaction answers `transaction.refund` with the refund it made. It
// refuses to return more than is left of the charge.
func (b *fakeBilling) RefundTransaction(_ context.Context, req provider.RefundRequest) (provider.Transaction, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	var charge *provider.Transaction
	left := int64(0)
	for _, record := range b.transactions {
		switch transaction := record.value; {
		case transaction.ID == req.TransactionID && transaction.Type == provider.TransactionCharge:
			charge = &transaction
			left += transaction.Amount
		case transaction.RefundsTransactionID != nil && *transaction.RefundsTransactionID == req.TransactionID:
			left -= transaction.Amount
		}
	}
	if charge == nil {
		return provider.Transaction{}, &provider.Error{Code: provider.CodeNotFound, Message: "No charge " + req.TransactionID}
	}
	amount := left
	if req.Amount != nil {
		amount = *req.Amount
	}
	if amount <= 0 || amount > left {
		return provider.Transaction{}, &provider.Error{
			Code:    provider.CodeInvalidRequest,
			Message: fmt.Sprintf("%d of %s is left to refund", left, req.TransactionID),
		}
	}

	now := time.Now()
	refund := provider.Transaction{
		ID:                   b.newIDLocked("re"),
		Type:                 provider.TransactionRefund,
		DistinctID:           charge.DistinctID,
		ProductKey:           charge.ProductKey,
		Amount:               amount,
		Currency:             charge.Currency,
		OccurredAt:           now,
		RefundsTransactionID: &charge.ID,
	}
	b.transactions = append(b.transactions, billingRecord[provider.Transaction]{now, refund})
	return refund, nil
}

// errUnknownProduct is the provider refusing a checkout for a product it
// does not sell.
var errUnknownProduct = errors.New("no such product")

// createCheckout plays the provider's API opening a hosted checkout for the
// buyer with distinctID. The app sends the buyer to the returned URL; when
// they pay, the provider sends a `checkout.completed` webhook.
func (b *fakeBilling) createCheckout(distinctID, productKey string) (string, time.Time, error) {
	if _, ok := billingPrices[productKey]; !ok {
		return "", time.Time{}, fmt.Errorf("%w: %s", errUnknownProduct, productKey)
	}

	b.mu.Lock()
	defer b.mu.Unlock()
	id := b.newIDLocked("chk")
	b.checkouts[id] = billingCheckout{distinctID: distinctID, productKey: productKey}
	return "https://billing.example/checkout/" + id, time.Now().Add(time.Hour), nil
}

// completeCheckout plays the buyer paying for a subscription checkout: it
// starts the subscription and charges its first period. eventID makes a
// redelivered webhook return the same records.
func (b *fakeBilling) completeCheckout(eventID, checkoutID string) (billingPayment, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if payment, ok := b.events[eventID]; ok {
		return payment, nil
	}
	checkout, ok := b.checkouts[checkoutID]
	if !ok {
		return billingPayment{}, fmt.Errorf("no checkout %s", checkoutID)
	}
	if !isSubscriptionProduct(checkout.productKey) {
		return billingPayment{}, fmt.Errorf("%s is not a subscription; this example only completes subscription checkouts", checkout.productKey)
	}
	delete(b.checkouts, checkoutID)

	now := time.Now().UTC()
	subscription := provider.Subscription{
		ID:                 b.newIDLocked("sub"),
		DistinctID:         &checkout.distinctID,
		ProductKey:         checkout.productKey,
		Status:             provider.SubscriptionActive,
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   periodEnd(checkout.productKey, now),
		WillRenew:          true,
		UpdatedAt:          now,
	}
	b.subscriptions = append(b.subscriptions, billingRecord[provider.Subscription]{now, subscription})
	return b.chargePeriodLocked(eventID, subscription), nil
}

// renewSubscription plays the provider charging a subscription's next period.
func (b *fakeBilling) renewSubscription(eventID, subscriptionID string) (billingPayment, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if payment, ok := b.events[eventID]; ok {
		return payment, nil
	}
	i := b.subscriptionIndexLocked(subscriptionID)
	if i < 0 {
		return billingPayment{}, fmt.Errorf("no subscription %s", subscriptionID)
	}
	subscription := &b.subscriptions[i].value
	if !subscription.WillRenew {
		return billingPayment{}, fmt.Errorf("subscription %s does not renew", subscriptionID)
	}
	subscription.CurrentPeriodStart = subscription.CurrentPeriodEnd
	subscription.CurrentPeriodEnd = periodEnd(subscription.ProductKey, subscription.CurrentPeriodStart)
	subscription.UpdatedAt = time.Now().UTC()
	return b.chargePeriodLocked(eventID, *subscription), nil
}

// chargePeriodLocked records the charge for the subscription's current
// period and remembers the payment under eventID.
func (b *fakeBilling) chargePeriodLocked(eventID string, subscription provider.Subscription) billingPayment {
	now := time.Now().UTC()
	charge := provider.Transaction{
		ID:             b.newIDLocked("txn"),
		Type:           provider.TransactionCharge,
		DistinctID:     subscription.DistinctID,
		Customer:       subscription.Customer,
		ProductKey:     &subscription.ProductKey,
		Amount:         billingPrices[subscription.ProductKey],
		Currency:       "EUR",
		OccurredAt:     now,
		SubscriptionID: &subscription.ID,
		PeriodStart:    &subscription.CurrentPeriodStart,
		PeriodEnd:      &subscription.CurrentPeriodEnd,
	}
	b.transactions = append(b.transactions, billingRecord[provider.Transaction]{now, charge})
	payment := billingPayment{subscription: subscription, charge: charge}
	b.events[eventID] = payment
	return payment
}

func (b *fakeBilling) subscriptionIndexLocked(id string) int {
	for i, record := range b.subscriptions {
		if record.value.ID == id {
			return i
		}
	}
	return -1
}

func isSubscriptionProduct(key string) bool {
	return key == "pro-monthly" || key == "pro-annual"
}

// periodEnd is when a period of the subscription product that starts at
// start ends.
func periodEnd(productKey string, start time.Time) time.Time {
	if productKey == "pro-annual" {
		return start.AddDate(1, 0, 0)
	}
	return start.AddDate(0, 1, 0)
}

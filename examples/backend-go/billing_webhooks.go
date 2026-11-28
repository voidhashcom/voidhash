package main

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"
	"time"

	voidhash "github.com/voidhashcom/voidhash/libraries/go"
)

type checkoutRequest struct {
	DistinctID string `json:"distinctId"`
	ProductKey string `json:"productKey"`
}

type checkoutResponse struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// handleCreateCheckout starts a purchase for the app. Nimbus creates the
// checkout at its billing provider itself and stores the buyer's Voidhash
// distinct id on it, so the payment the provider reports later names them.
// A real service takes the distinct id from the session, not the body.
func (s *server) handleCreateCheckout(w http.ResponseWriter, r *http.Request) {
	var request checkoutRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	distinctID := strings.TrimSpace(request.DistinctID)
	if distinctID == "" || request.ProductKey == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "distinctId and productKey are required")
		return
	}

	url, expiresAt, err := s.billing.createCheckout(distinctID, request.ProductKey)
	if errors.Is(err, errUnknownProduct) {
		writeError(w, http.StatusNotFound, "product_not_found", err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusBadGateway, "billing_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, checkoutResponse{URL: url, ExpiresAt: expiresAt})
}

// billingEvent is a webhook from the billing provider. Real providers sign
// their webhooks; verify that signature with the provider's SDK where this
// example compares a shared secret.
type billingEvent struct {
	// ID is the provider's event id; a redelivery carries the same one.
	ID             string `json:"id"`
	Type           string `json:"type"`
	CheckoutID     string `json:"checkoutId"`
	SubscriptionID string `json:"subscriptionId"`
}

// handleBillingWebhook applies a billing provider event and reports the
// resulting payment to Voidhash before acknowledging. A failed push answers
// 502, so the provider redelivers; Voidhash records each charge and state
// under the provider's own id, so pushing them again is safe.
func (s *server) handleBillingWebhook(w http.ResponseWriter, r *http.Request) {
	if s.billingWebhookSecret == "" || s.paymentSource == nil {
		writeError(w, http.StatusServiceUnavailable, "billing_not_configured",
			"set BILLING_WEBHOOK_SECRET and VOIDHASH_PAYMENT_SOURCE_ID to accept billing provider webhooks")
		return
	}
	if subtle.ConstantTimeCompare([]byte(r.Header.Get("x-billing-secret")), []byte(s.billingWebhookSecret)) != 1 {
		writeError(w, http.StatusUnauthorized, "invalid_webhook", "x-billing-secret does not match")
		return
	}
	var event billingEvent
	if err := decodeJSON(w, r, &event); err != nil || event.ID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "expected {id, type, checkoutId | subscriptionId}")
		return
	}

	var payment billingPayment
	var err error
	switch event.Type {
	case "checkout.completed":
		payment, err = s.billing.completeCheckout(event.ID, event.CheckoutID)
	case "subscription.renewed":
		payment, err = s.billing.renewSubscription(event.ID, event.SubscriptionID)
	default:
		writeJSON(w, http.StatusOK, webhookAck{Received: true, Event: event.Type})
		return
	}
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_event", err.Error())
		return
	}

	if err := s.pushPayment(r.Context(), payment); err != nil {
		s.logger.Error("reporting a payment to Voidhash failed", "event", event.Type, "error", err)
		writeError(w, http.StatusBadGateway, "upstream_error", err.Error())
		return
	}
	// The buyer's access just changed; drop the cached answer.
	if payment.subscription.DistinctID != nil {
		s.entitlements.Invalidate(*payment.subscription.DistinctID)
	}
	writeJSON(w, http.StatusOK, webhookAck{Received: true, Event: event.Type})
}

// pushPayment reports a paid period: the charge, which carries the money and
// names the period it pays for, and the subscription's state afterwards. The
// charge goes first because a subscription state waits for its period's
// charge before it grants access.
func (s *server) pushPayment(ctx context.Context, payment billingPayment) error {
	charge, subscription := payment.charge, payment.subscription
	var customerID *string
	if charge.Customer != nil {
		customerID = &charge.Customer.ExternalID
	}

	transaction, err := s.paymentSource.Charge(ctx, charge.ID, voidhash.ChargeParams{
		DistinctID:     charge.DistinctID,
		CustomerID:     customerID,
		ProductKey:     *charge.ProductKey,
		Amount:         charge.Amount,
		Currency:       charge.Currency,
		OccurredAt:     charge.OccurredAt,
		SubscriptionID: charge.SubscriptionID,
		PeriodStart:    charge.PeriodStart,
		PeriodEnd:      charge.PeriodEnd,
	})
	if err != nil {
		return err
	}
	recorded, err := s.paymentSource.Subscription(ctx, subscription.ID, voidhash.SubscriptionParams{
		DistinctID:         subscription.DistinctID,
		CustomerID:         customerID,
		ProductKey:         subscription.ProductKey,
		Status:             voidhash.PaymentSourceSubscriptionStatus(subscription.Status),
		CurrentPeriodStart: subscription.CurrentPeriodStart,
		CurrentPeriodEnd:   subscription.CurrentPeriodEnd,
		IsAutoRenewing:     subscription.WillRenew,
		CanceledAt:         subscription.CanceledAt,
		UpdatedAt:          subscription.UpdatedAt,
	})
	if err != nil {
		return err
	}
	s.logger.Info("payment reported",
		"transaction", charge.ID, "transactionStatus", transaction.Status,
		"subscription", subscription.ID, "subscriptionStatus", recorded.Status,
	)
	return nil
}

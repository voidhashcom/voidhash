package provider

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"
	"unicode/utf16"
)

const (
	maxIdentifierLength = 255
	maxRecordIDLength   = 200
	maxPageItems        = 1000
	maxSafeInteger      = 1<<53 - 1
	maxReasonLength     = 500
)

// input is an operation's input object, decoded field by field.
type input map[string]json.RawMessage

func decodeInput(raw json.RawMessage) (input, error) {
	var fields input
	if err := json.Unmarshal(raw, &fields); err != nil || fields == nil {
		return nil, errors.New("input must be an object")
	}
	return fields, nil
}

// cursor reads the required, nullable `cursor` field.
func (in input) cursor() (*string, error) {
	raw, ok := in["cursor"]
	if !ok {
		return nil, errors.New("cursor is required")
	}
	var cursor *string
	if err := json.Unmarshal(raw, &cursor); err != nil {
		return nil, errors.New("cursor must be a string or null")
	}
	return cursor, nil
}

func (in input) historyKind() (HistoryKind, error) {
	var kind HistoryKind
	if err := json.Unmarshal(in["kind"], &kind); err != nil ||
		(kind != HistorySubscriptions && kind != HistoryTransactions) {
		return "", errors.New("kind must be subscriptions or transactions")
	}
	return kind, nil
}

func (in input) time(field string) (time.Time, error) {
	var value string
	if err := json.Unmarshal(in[field], &value); err != nil {
		return time.Time{}, fmt.Errorf("%s must be an ISO 8601 date", field)
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("%s must be an ISO 8601 date", field)
	}
	return parsed, nil
}

func (in input) boolean(field string) (bool, error) {
	var value *bool
	if err := json.Unmarshal(in[field], &value); err != nil || value == nil {
		return false, fmt.Errorf("%s must be a boolean", field)
	}
	return *value, nil
}

// boundedString reads a required string field of 1 to limit characters.
func (in input) boundedString(field string, limit int) (string, error) {
	var value string
	if err := json.Unmarshal(in[field], &value); err != nil {
		return "", fmt.Errorf("%s must be a string", field)
	}
	if err := validateLength(field, value, limit); err != nil {
		return "", err
	}
	return value, nil
}

// nullable reads a required field whose value may be null into target, a
// pointer to a pointer.
func (in input) nullable(field string, target any) error {
	raw, ok := in[field]
	if !ok {
		return fmt.Errorf("%s is required", field)
	}
	return json.Unmarshal(raw, target)
}

// minorAmount reads a required, nullable, non-negative integer field. JSON
// numbers are read as the protocol's senders write them, so 500.0 is 500.
func (in input) minorAmount(field string) (*int64, error) {
	var value *float64
	if err := in.nullable(field, &value); err != nil {
		return nil, fmt.Errorf("%s must be a non-negative integer or null", field)
	}
	if value == nil {
		return nil, nil
	}
	if *value < 0 || *value != math.Trunc(*value) || *value > maxSafeInteger {
		return nil, fmt.Errorf("%s must be a non-negative integer or null", field)
	}
	amount := int64(*value)
	return &amount, nil
}

func (in input) reason() (*string, error) {
	var reason *string
	if err := in.nullable("reason", &reason); err != nil {
		return nil, errors.New("reason must be a string or null")
	}
	if reason != nil && utf16Length(*reason) > maxReasonLength {
		return nil, fmt.Errorf("reason must be at most %d characters", maxReasonLength)
	}
	return reason, nil
}

func validateCatalogPage(page CatalogPage) error {
	if err := validatePageLength(len(page.Items)); err != nil {
		return err
	}
	for i, product := range page.Items {
		prefix := fmt.Sprintf("items[%d].", i)
		if err := validateLength(prefix+"key", product.Key, maxIdentifierLength); err != nil {
			return err
		}
		if err := validateLength(prefix+"name", product.Name, maxIdentifierLength); err != nil {
			return err
		}
		switch product.Kind {
		case ProductKindSubscription, ProductKindOneTime, ProductKindConsumable:
		default:
			return fmt.Errorf("%skind must be subscription, one_time or consumable, not %q", prefix, product.Kind)
		}
	}
	return nil
}

func validatePageLength(items int) error {
	if items > maxPageItems {
		return fmt.Errorf("a page holds at most %d items, not %d", maxPageItems, items)
	}
	return nil
}

// validateTransaction checks a transaction against the protocol. Errors name
// the field relative to the transaction.
func validateTransaction(t Transaction) error {
	if err := validateLength("id", t.ID, maxRecordIDLength); err != nil {
		return err
	}
	if t.Type != TransactionCharge && t.Type != TransactionRefund {
		return fmt.Errorf("type must be charge or refund, not %q", t.Type)
	}
	if err := validateBuyer(t.DistinctID, t.Customer); err != nil {
		return err
	}
	if err := validateOptionalLength("productKey", t.ProductKey, maxIdentifierLength); err != nil {
		return err
	}
	if err := validateMinorAmount("amount", &t.Amount); err != nil {
		return err
	}
	if !isCurrencyCode(t.Currency) {
		return fmt.Errorf("currency must be a three-letter code, not %q", t.Currency)
	}
	if err := validateMinorAmount("fee", t.Fee); err != nil {
		return err
	}
	if err := validateMinorAmount("tax", t.Tax); err != nil {
		return err
	}
	if err := validateTime("occurredAt", &t.OccurredAt); err != nil {
		return err
	}
	if err := validateOptionalLength("subscriptionId", t.SubscriptionID, maxRecordIDLength); err != nil {
		return err
	}
	if err := validateTime("periodStart", t.PeriodStart); err != nil {
		return err
	}
	if err := validateTime("periodEnd", t.PeriodEnd); err != nil {
		return err
	}
	return validateOptionalLength("refundsTransactionId", t.RefundsTransactionID, maxRecordIDLength)
}

// validateSubscription checks a subscription against the protocol. Errors
// name the field relative to the subscription.
func validateSubscription(s Subscription) error {
	if err := validateLength("id", s.ID, maxRecordIDLength); err != nil {
		return err
	}
	if err := validateBuyer(s.DistinctID, s.Customer); err != nil {
		return err
	}
	if err := validateLength("productKey", s.ProductKey, maxIdentifierLength); err != nil {
		return err
	}
	switch s.Status {
	case SubscriptionTrialing, SubscriptionActive, SubscriptionPastDue, SubscriptionCanceled, SubscriptionExpired:
	default:
		return fmt.Errorf("status must be trialing, active, past_due, canceled or expired, not %q", s.Status)
	}
	if err := validateTime("currentPeriodStart", &s.CurrentPeriodStart); err != nil {
		return err
	}
	if err := validateTime("currentPeriodEnd", &s.CurrentPeriodEnd); err != nil {
		return err
	}
	if err := validateTime("canceledAt", s.CanceledAt); err != nil {
		return err
	}
	return validateTime("updatedAt", &s.UpdatedAt)
}

func validateBuyer(distinctID *string, customer *Customer) error {
	if err := validateOptionalLength("distinctId", distinctID, maxIdentifierLength); err != nil {
		return err
	}
	if customer == nil {
		return nil
	}
	return validateLength("customer.externalId", customer.ExternalID, maxIdentifierLength)
}

// validateLength requires 1 to limit characters, counted in UTF-16 code
// units as the protocol schema counts them.
func validateLength(field, value string, limit int) error {
	length := utf16Length(value)
	if length < 1 || length > limit {
		return fmt.Errorf("%s must be 1 to %d characters, not %d", field, limit, length)
	}
	return nil
}

func utf16Length(value string) int {
	return len(utf16.Encode([]rune(value)))
}

func validateOptionalLength(field string, value *string, limit int) error {
	if value == nil {
		return nil
	}
	return validateLength(field, *value, limit)
}

func validateMinorAmount(field string, value *int64) error {
	if value != nil && *value < 0 {
		return fmt.Errorf("%s must be a non-negative integer of minor units, not %d", field, *value)
	}
	return nil
}

// validateTime requires a set date that ISO 8601 can carry; nil is unset.
func validateTime(field string, value *time.Time) error {
	if value == nil {
		return nil
	}
	if value.IsZero() {
		return fmt.Errorf("%s must be set", field)
	}
	if year := value.UTC().Year(); year < 1 || year > 9999 {
		return fmt.Errorf("%s must be between years 1 and 9999", field)
	}
	return nil
}

func isCurrencyCode(currency string) bool {
	if len(currency) != 3 {
		return false
	}
	for _, c := range currency {
		if (c < 'A' || c > 'Z') && (c < 'a' || c > 'z') {
			return false
		}
	}
	return true
}

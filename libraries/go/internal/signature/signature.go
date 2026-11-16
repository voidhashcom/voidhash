// Package signature signs and verifies the `v1=` HMAC-SHA256 scheme Voidhash
// uses for webhook deliveries and payment source provider requests.
package signature

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

const prefix = "v1="

// Sign returns `v1=` and the lowercase hex HMAC-SHA256 of
// `${timestamp}.${payload}`, keyed by the raw UTF-8 secret.
func Sign(payload []byte, timestamp, secret string) string {
	return prefix + hex.EncodeToString(digest(payload, timestamp, secret))
}

// Verify checks a signature and that its timestamp is within tolerance of now,
// in either direction. Signatures with another scheme and timestamps that are
// not canonical unix seconds are rejected. The digest is compared in constant
// time.
func Verify(payload []byte, signature, timestamp, secret string, tolerance time.Duration, now time.Time) bool {
	timestampSeconds, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || strconv.FormatInt(timestampSeconds, 10) != timestamp {
		return false
	}
	signedAt := time.Unix(timestampSeconds, 0)
	if now.Sub(signedAt) > tolerance || signedAt.Sub(now) > tolerance {
		return false
	}
	if !strings.HasPrefix(signature, prefix) {
		return false
	}
	provided, err := hex.DecodeString(strings.TrimPrefix(signature, prefix))
	if err != nil {
		return false
	}
	return hmac.Equal(digest(payload, timestamp, secret), provided)
}

func digest(payload []byte, timestamp, secret string) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(payload)
	return mac.Sum(nil)
}

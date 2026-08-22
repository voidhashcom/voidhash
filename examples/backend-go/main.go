// Command backend-go is the Nimbus reference backend for the Voidhash Go SDK.
//
// Nimbus is a notes app with a Pro tier: free accounts keep three notes, Pro is
// unlimited and can export. That is enough of a product to exercise identity,
// entitlement checks, analytics capture and webhooks against a real project.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	voidhash "github.com/voidhashcom/voidhash-go"
)

const (
	defaultPort            = "8080"
	shutdownGracePeriod    = 10 * time.Second
	voidhashRequestTimeout = 10 * time.Second
)

type config struct {
	SecretKey      string
	PublishableKey string
	WebhookSecret  string
	BaseURL        string
	IngestURL      string
	Port           string
}

// loadConfig reads the process environment and rejects anything the server
// cannot start without.
func loadConfig() (config, error) {
	cfg := config{
		SecretKey:      strings.TrimSpace(os.Getenv("VOIDHASH_SECRET_KEY")),
		PublishableKey: strings.TrimSpace(os.Getenv("VOIDHASH_PUBLISHABLE_KEY")),
		WebhookSecret:  strings.TrimSpace(os.Getenv("VOIDHASH_WEBHOOK_SECRET")),
		BaseURL:        strings.TrimSpace(os.Getenv("VOIDHASH_BASE_URL")),
		IngestURL:      strings.TrimSpace(os.Getenv("VOIDHASH_INGEST_URL")),
		Port:           strings.TrimSpace(os.Getenv("PORT")),
	}
	if cfg.SecretKey == "" {
		return config{}, errors.New(
			"VOIDHASH_SECRET_KEY is required: copy the vh_sk_… key from Studio → Project settings → API keys",
		)
	}
	if !strings.HasPrefix(cfg.SecretKey, "vh_sk_") {
		return config{}, errors.New(
			"VOIDHASH_SECRET_KEY must be a secret key (vh_sk_…); publishable keys (vh_pk_…) belong in the mobile apps",
		)
	}
	if cfg.IngestURL == "" {
		cfg.IngestURL = voidhash.DefaultIngestURL
	}
	if cfg.Port == "" {
		cfg.Port = defaultPort
	}
	return cfg, nil
}

func newVoidhashClient(cfg config) (*voidhash.Client, error) {
	options := []voidhash.Option{
		voidhash.WithHTTPClient(&http.Client{Timeout: voidhashRequestTimeout}),
	}
	if cfg.BaseURL != "" {
		options = append(options, voidhash.WithBaseURL(cfg.BaseURL))
	}
	if cfg.IngestURL != "" {
		options = append(options, voidhash.WithIngestURL(cfg.IngestURL))
	}
	// Event ingest authenticates on the publishable key, not the secret key,
	// so the client needs both to capture.
	if cfg.PublishableKey != "" {
		options = append(options, voidhash.WithPublishableKey(cfg.PublishableKey))
	}
	client, err := voidhash.New(cfg.SecretKey, options...)
	if err != nil {
		return nil, fmt.Errorf("creating voidhash client: %w", err)
	}
	return client, nil
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("nimbus exited", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	client, err := newVoidhashClient(cfg)
	if err != nil {
		return err
	}
	if cfg.WebhookSecret == "" {
		logger.Warn("VOIDHASH_WEBHOOK_SECRET is not set; POST /webhooks/voidhash will refuse deliveries")
	}
	if cfg.PublishableKey == "" {
		logger.Warn("VOIDHASH_PUBLISHABLE_KEY is not set; analytics events will not be captured")
	}

	srv := newServer(client, cfg, logger)
	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	listenErr := make(chan error, 1)
	go func() {
		logger.Info("nimbus listening", "addr", httpServer.Addr, "baseUrl", srv.baseURL())
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			listenErr <- fmt.Errorf("http server: %w", err)
			return
		}
		listenErr <- nil
	}()

	select {
	case err := <-listenErr:
		return err
	case <-ctx.Done():
		logger.Info("shutting down")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownGracePeriod)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	return <-listenErr
}

package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// NotificationsService sends server-to-server push notifications.
type NotificationsService struct {
	client *Client
}

// Send delivers a push notification to the devices of the persons and
// distinct ids it names. It answers once the send is accepted; deliveries
// continue in the background. Distinct ids that name no person are reported
// in UnresolvedDistinctIds rather than refused.
func (s *NotificationsService) Send(ctx context.Context, notification Notification) (*SendNotificationResponse, error) {
	return s.send(ctx, notification, nil)
}

// SendWithIdempotencyKey is [NotificationsService.Send] made safe to retry:
// sending again with the same key returns the first send instead of notifying
// anyone twice.
func (s *NotificationsService) SendWithIdempotencyKey(ctx context.Context, notification Notification, idempotencyKey string) (*SendNotificationResponse, error) {
	return s.send(ctx, notification, &api.PushNotificationsCreateParams{IdempotencyKey: &idempotencyKey})
}

func (s *NotificationsService) send(ctx context.Context, notification Notification, params *api.PushNotificationsCreateParams) (*SendNotificationResponse, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	response := &SendNotificationResponse{}
	err = s.client.call(response, func() (*http.Response, error) {
		return s.client.core.PushNotificationsCreate(ctx, projectID, params, notification)
	})
	return response, err
}

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

// Send delivers a push notification to the persons or distinct ids in params.
func (s *NotificationsService) Send(ctx context.Context, notification Notification) (*SendNotificationResponse, error) {
	response := &SendNotificationResponse{}
	err := s.client.call(response, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.NotificationsSendNotification(ctx, notification)
	})
	return response, err
}

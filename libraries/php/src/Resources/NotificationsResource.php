<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ClientException;
use Voidhash\Generated\Core\Model\SendNotificationBodyJsonEncoding;
use Voidhash\Generated\Core\Model\SendNotificationResponseJsonEncoding;

final class NotificationsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    public function send(SendNotificationBodyJsonEncoding $notification): SendNotificationResponseJsonEncoding
    {
        try {
            return $this->core->notificationsSendNotification($notification)
                ?? throw new ApiException(500);
        } catch (ClientException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}

<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\AcceptedPushNotificationJsonEncoding;
use Voidhash\Generated\Core\Model\CreatePushNotificationBodyJsonEncoding;
use Voidhash\Internal\ProjectScope;

final class NotificationsResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /**
     * Sends a push notification to the devices of the persons it names. It is
     * accepted at once and delivered in the background; distinct ids that name
     * no person come back in `unresolvedDistinctIds`.
     */
    public function send(CreatePushNotificationBodyJsonEncoding $notification): AcceptedPushNotificationJsonEncoding
    {
        return $this->core->pushNotificationsCreate($this->project->id(), $notification)
            ?? throw ApiException::unexpectedResponse();
    }
}

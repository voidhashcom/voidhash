<?php

namespace Voidhash\Generated\Core\Model;

class CreatePushNotificationConfigurationBodyJsonEncoding
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The push service: `fcm` for Firebase Cloud Messaging, `apns` for the Apple Push Notification service.
     *
     * @var string
     */
    protected $type;
    /**
     * The push service: `fcm` for Firebase Cloud Messaging, `apns` for the Apple Push Notification service.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The push service: `fcm` for Firebase Cloud Messaging, `apns` for the Apple Push Notification service.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
}
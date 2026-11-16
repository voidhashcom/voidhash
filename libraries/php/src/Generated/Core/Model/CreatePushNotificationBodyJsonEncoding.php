<?php

namespace Voidhash\Generated\Core\Model;

class CreatePushNotificationBodyJsonEncoding
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
     * Ids of persons to notify on every device they registered; at least one of `personIds` and `distinctIds` is required.
     *
     * @var list<string>|null
     */
    protected $personIds;
    /**
     * Distinct ids of persons to notify; ones that name no person are reported in `unresolvedDistinctIds`, not refused.
     *
     * @var list<string>|null
     */
    protected $distinctIds;
    /**
     * The notification's title.
     *
     * @var string
     */
    protected $title;
    /**
     * The notification's text.
     *
     * @var string
     */
    protected $body;
    /**
     * Custom data delivered to the app with the notification. Through FCM, values other than strings arrive JSON-encoded.
     *
     * @var array<string, mixed>|null
     */
    protected $data;
    /**
     * The sound to play, such as `default`.
     *
     * @var string|null
     */
    protected $sound;
    /**
     * The number to show on the app icon on Apple devices.
     *
     * @var int|null
     */
    protected $badge;
    /**
     * `high` asks the push service to deliver at once; `default` lets it deliver when it saves the device power. Defaults to `default`.
     *
     * @var string|null
     */
    protected $priority;
    /**
     * How many seconds the Apple Push Notification service keeps trying to deliver it to a device registered with APNs. FCM uses the configuration's `androidTtl` instead.
     *
     * @var int|null
     */
    protected $ttlSeconds;
    /**
     * The Android notification channel to post it in.
     *
     * @var string|null
     */
    protected $channelId;
    /**
     * Notifications with the same collapse id replace each other on a device.
     *
     * @var string|null
     */
    protected $collapseId;
    /**
     * Ids of persons to notify on every device they registered; at least one of `personIds` and `distinctIds` is required.
     *
     * @return list<string>|null
     */
    public function getPersonIds(): ?array
    {
        return $this->personIds;
    }
    /**
     * Ids of persons to notify on every device they registered; at least one of `personIds` and `distinctIds` is required.
     *
     * @param list<string>|null $personIds
     *
     * @return self
     */
    public function setPersonIds(?array $personIds): self
    {
        $this->initialized['personIds'] = true;
        $this->personIds = $personIds;
        return $this;
    }
    /**
     * Distinct ids of persons to notify; ones that name no person are reported in `unresolvedDistinctIds`, not refused.
     *
     * @return list<string>|null
     */
    public function getDistinctIds(): ?array
    {
        return $this->distinctIds;
    }
    /**
     * Distinct ids of persons to notify; ones that name no person are reported in `unresolvedDistinctIds`, not refused.
     *
     * @param list<string>|null $distinctIds
     *
     * @return self
     */
    public function setDistinctIds(?array $distinctIds): self
    {
        $this->initialized['distinctIds'] = true;
        $this->distinctIds = $distinctIds;
        return $this;
    }
    /**
     * The notification's title.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * The notification's title.
     *
     * @param string $title
     *
     * @return self
     */
    public function setTitle(string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * The notification's text.
     *
     * @return string
     */
    public function getBody(): string
    {
        return $this->body;
    }
    /**
     * The notification's text.
     *
     * @param string $body
     *
     * @return self
     */
    public function setBody(string $body): self
    {
        $this->initialized['body'] = true;
        $this->body = $body;
        return $this;
    }
    /**
     * Custom data delivered to the app with the notification. Through FCM, values other than strings arrive JSON-encoded.
     *
     * @return array<string, mixed>|null
     */
    public function getData(): ?iterable
    {
        return $this->data;
    }
    /**
     * Custom data delivered to the app with the notification. Through FCM, values other than strings arrive JSON-encoded.
     *
     * @param array<string, mixed>|null $data
     *
     * @return self
     */
    public function setData(?iterable $data): self
    {
        $this->initialized['data'] = true;
        $this->data = $data;
        return $this;
    }
    /**
     * The sound to play, such as `default`.
     *
     * @return string|null
     */
    public function getSound(): ?string
    {
        return $this->sound;
    }
    /**
     * The sound to play, such as `default`.
     *
     * @param string|null $sound
     *
     * @return self
     */
    public function setSound(?string $sound): self
    {
        $this->initialized['sound'] = true;
        $this->sound = $sound;
        return $this;
    }
    /**
     * The number to show on the app icon on Apple devices.
     *
     * @return int|null
     */
    public function getBadge(): ?int
    {
        return $this->badge;
    }
    /**
     * The number to show on the app icon on Apple devices.
     *
     * @param int|null $badge
     *
     * @return self
     */
    public function setBadge(?int $badge): self
    {
        $this->initialized['badge'] = true;
        $this->badge = $badge;
        return $this;
    }
    /**
     * `high` asks the push service to deliver at once; `default` lets it deliver when it saves the device power. Defaults to `default`.
     *
     * @return string|null
     */
    public function getPriority(): ?string
    {
        return $this->priority;
    }
    /**
     * `high` asks the push service to deliver at once; `default` lets it deliver when it saves the device power. Defaults to `default`.
     *
     * @param string|null $priority
     *
     * @return self
     */
    public function setPriority(?string $priority): self
    {
        $this->initialized['priority'] = true;
        $this->priority = $priority;
        return $this;
    }
    /**
     * How many seconds the Apple Push Notification service keeps trying to deliver it to a device registered with APNs. FCM uses the configuration's `androidTtl` instead.
     *
     * @return int|null
     */
    public function getTtlSeconds(): ?int
    {
        return $this->ttlSeconds;
    }
    /**
     * How many seconds the Apple Push Notification service keeps trying to deliver it to a device registered with APNs. FCM uses the configuration's `androidTtl` instead.
     *
     * @param int|null $ttlSeconds
     *
     * @return self
     */
    public function setTtlSeconds(?int $ttlSeconds): self
    {
        $this->initialized['ttlSeconds'] = true;
        $this->ttlSeconds = $ttlSeconds;
        return $this;
    }
    /**
     * The Android notification channel to post it in.
     *
     * @return string|null
     */
    public function getChannelId(): ?string
    {
        return $this->channelId;
    }
    /**
     * The Android notification channel to post it in.
     *
     * @param string|null $channelId
     *
     * @return self
     */
    public function setChannelId(?string $channelId): self
    {
        $this->initialized['channelId'] = true;
        $this->channelId = $channelId;
        return $this;
    }
    /**
     * Notifications with the same collapse id replace each other on a device.
     *
     * @return string|null
     */
    public function getCollapseId(): ?string
    {
        return $this->collapseId;
    }
    /**
     * Notifications with the same collapse id replace each other on a device.
     *
     * @param string|null $collapseId
     *
     * @return self
     */
    public function setCollapseId(?string $collapseId): self
    {
        $this->initialized['collapseId'] = true;
        $this->collapseId = $collapseId;
        return $this;
    }
}
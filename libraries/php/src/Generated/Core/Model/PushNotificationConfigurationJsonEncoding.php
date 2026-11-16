<?php

namespace Voidhash\Generated\Core\Model;

class PushNotificationConfigurationJsonEncoding
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
     * The configuration's id, `push_conf_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the configuration belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The push service: `fcm` for Firebase Cloud Messaging, `apns` for the Apple Push Notification service.
     *
     * @var string
     */
    protected $type;
    /**
     * The configuration's display name, the push service's name by default.
     *
     * @var string
     */
    protected $name;
    /**
     * What the credentials are for: the Firebase project id for FCM, the app's bundle id for APNs; null until first enabled.
     *
     * @var string|null
     */
    protected $key;
    /**
     * Whether push notifications are sent through this service.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * The non-secret settings. FCM: `projectId`, `androidPriority`, `androidTtl`, `apnsPriority` and `hasServiceAccountJson`. APNs: `teamId`, `keyId`, `bundleId`, `environment` (`production` or `sandbox`) and `hasPrivateKey`.
     *
     * @var array<string, mixed>
     */
    protected $configuration;
    /**
     * When the configuration was added, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the configuration last changed, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $updatedAt;
    /**
     * The configuration's id, `push_conf_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The configuration's id, `push_conf_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The project the configuration belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the configuration belongs to.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
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
    /**
     * The configuration's display name, the push service's name by default.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The configuration's display name, the push service's name by default.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * What the credentials are for: the Firebase project id for FCM, the app's bundle id for APNs; null until first enabled.
     *
     * @return string|null
     */
    public function getKey(): ?string
    {
        return $this->key;
    }
    /**
     * What the credentials are for: the Firebase project id for FCM, the app's bundle id for APNs; null until first enabled.
     *
     * @param string|null $key
     *
     * @return self
     */
    public function setKey(?string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * Whether push notifications are sent through this service.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether push notifications are sent through this service.
     *
     * @param bool $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
    /**
     * The non-secret settings. FCM: `projectId`, `androidPriority`, `androidTtl`, `apnsPriority` and `hasServiceAccountJson`. APNs: `teamId`, `keyId`, `bundleId`, `environment` (`production` or `sandbox`) and `hasPrivateKey`.
     *
     * @return array<string, mixed>
     */
    public function getConfiguration(): iterable
    {
        return $this->configuration;
    }
    /**
     * The non-secret settings. FCM: `projectId`, `androidPriority`, `androidTtl`, `apnsPriority` and `hasServiceAccountJson`. APNs: `teamId`, `keyId`, `bundleId`, `environment` (`production` or `sandbox`) and `hasPrivateKey`.
     *
     * @param array<string, mixed> $configuration
     *
     * @return self
     */
    public function setConfiguration(iterable $configuration): self
    {
        $this->initialized['configuration'] = true;
        $this->configuration = $configuration;
        return $this;
    }
    /**
     * When the configuration was added, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the configuration was added, as an ISO 8601 timestamp.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the configuration last changed, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * When the configuration last changed, as an ISO 8601 timestamp.
     *
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}
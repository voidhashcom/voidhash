<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePushNotificationConfigurationBodyJsonEncoding
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
     * The new display name.
     *
     * @var string|null
     */
    protected $name;
    /**
     * Whether push notifications are sent through this service. Enabling validates the settings and credentials.
     *
     * @var bool|null
     */
    protected $isEnabled;
    /**
     * Settings to change; fields left out, credentials included, keep their stored values. FCM takes `projectId`, `serviceAccountJson` (the service account key file's contents), `androidPriority` (`high` or `normal`), `androidTtl` (such as `2419200s`) and `apnsPriority` (`5` or `10`); APNs takes `teamId`, `keyId`, `privateKeyContent` (the `.p8` key), `bundleId` and `environment` (`production` or `sandbox`).
     *
     * @var array<string, mixed>|null
     */
    protected $configuration;
    /**
     * The new display name.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new display name.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * Whether push notifications are sent through this service. Enabling validates the settings and credentials.
     *
     * @return bool|null
     */
    public function getIsEnabled(): ?bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether push notifications are sent through this service. Enabling validates the settings and credentials.
     *
     * @param bool|null $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(?bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
    /**
     * Settings to change; fields left out, credentials included, keep their stored values. FCM takes `projectId`, `serviceAccountJson` (the service account key file's contents), `androidPriority` (`high` or `normal`), `androidTtl` (such as `2419200s`) and `apnsPriority` (`5` or `10`); APNs takes `teamId`, `keyId`, `privateKeyContent` (the `.p8` key), `bundleId` and `environment` (`production` or `sandbox`).
     *
     * @return array<string, mixed>|null
     */
    public function getConfiguration(): ?iterable
    {
        return $this->configuration;
    }
    /**
     * Settings to change; fields left out, credentials included, keep their stored values. FCM takes `projectId`, `serviceAccountJson` (the service account key file's contents), `androidPriority` (`high` or `normal`), `androidTtl` (such as `2419200s`) and `apnsPriority` (`5` or `10`); APNs takes `teamId`, `keyId`, `privateKeyContent` (the `.p8` key), `bundleId` and `environment` (`production` or `sandbox`).
     *
     * @param array<string, mixed>|null $configuration
     *
     * @return self
     */
    public function setConfiguration(?iterable $configuration): self
    {
        $this->initialized['configuration'] = true;
        $this->configuration = $configuration;
        return $this;
    }
}
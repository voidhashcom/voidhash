<?php

namespace Voidhash\Generated\Core\Model;

class RegisterDeviceBodyJsonEncoding
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
     * The device's platform.
     *
     * @var string
     */
    protected $platform;
    /**
     * The push service that delivers to the device: `fcm` (Firebase) or `apns` (Apple).
     *
     * @var string
     */
    protected $provider;
    /**
     * The device's push credential: an FCM registration token, or the APNs device token as hex.
     *
     * @var string
     */
    protected $platformToken;
    /**
     * The app's bundle id, which APNs delivers to; required with `apns`.
     *
     * @var string|null
     */
    protected $bundleId;
    /**
     * The APNs environment the token belongs to: `sandbox` for development builds, `production` otherwise. Required with `apns`, ignored by FCM.
     *
     * @var string|null
     */
    protected $environment;
    /**
     * The device-token id an earlier install of the app registered, which is removed now that it is replaced.
     *
     * @var string|null
     */
    protected $previousPushDeviceTokenId;
    /**
     * The device's platform.
     *
     * @return string
     */
    public function getPlatform(): string
    {
        return $this->platform;
    }
    /**
     * The device's platform.
     *
     * @param string $platform
     *
     * @return self
     */
    public function setPlatform(string $platform): self
    {
        $this->initialized['platform'] = true;
        $this->platform = $platform;
        return $this;
    }
    /**
     * The push service that delivers to the device: `fcm` (Firebase) or `apns` (Apple).
     *
     * @return string
     */
    public function getProvider(): string
    {
        return $this->provider;
    }
    /**
     * The push service that delivers to the device: `fcm` (Firebase) or `apns` (Apple).
     *
     * @param string $provider
     *
     * @return self
     */
    public function setProvider(string $provider): self
    {
        $this->initialized['provider'] = true;
        $this->provider = $provider;
        return $this;
    }
    /**
     * The device's push credential: an FCM registration token, or the APNs device token as hex.
     *
     * @return string
     */
    public function getPlatformToken(): string
    {
        return $this->platformToken;
    }
    /**
     * The device's push credential: an FCM registration token, or the APNs device token as hex.
     *
     * @param string $platformToken
     *
     * @return self
     */
    public function setPlatformToken(string $platformToken): self
    {
        $this->initialized['platformToken'] = true;
        $this->platformToken = $platformToken;
        return $this;
    }
    /**
     * The app's bundle id, which APNs delivers to; required with `apns`.
     *
     * @return string|null
     */
    public function getBundleId(): ?string
    {
        return $this->bundleId;
    }
    /**
     * The app's bundle id, which APNs delivers to; required with `apns`.
     *
     * @param string|null $bundleId
     *
     * @return self
     */
    public function setBundleId(?string $bundleId): self
    {
        $this->initialized['bundleId'] = true;
        $this->bundleId = $bundleId;
        return $this;
    }
    /**
     * The APNs environment the token belongs to: `sandbox` for development builds, `production` otherwise. Required with `apns`, ignored by FCM.
     *
     * @return string|null
     */
    public function getEnvironment(): ?string
    {
        return $this->environment;
    }
    /**
     * The APNs environment the token belongs to: `sandbox` for development builds, `production` otherwise. Required with `apns`, ignored by FCM.
     *
     * @param string|null $environment
     *
     * @return self
     */
    public function setEnvironment(?string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * The device-token id an earlier install of the app registered, which is removed now that it is replaced.
     *
     * @return string|null
     */
    public function getPreviousPushDeviceTokenId(): ?string
    {
        return $this->previousPushDeviceTokenId;
    }
    /**
     * The device-token id an earlier install of the app registered, which is removed now that it is replaced.
     *
     * @param string|null $previousPushDeviceTokenId
     *
     * @return self
     */
    public function setPreviousPushDeviceTokenId(?string $previousPushDeviceTokenId): self
    {
        $this->initialized['previousPushDeviceTokenId'] = true;
        $this->previousPushDeviceTokenId = $previousPushDeviceTokenId;
        return $this;
    }
}
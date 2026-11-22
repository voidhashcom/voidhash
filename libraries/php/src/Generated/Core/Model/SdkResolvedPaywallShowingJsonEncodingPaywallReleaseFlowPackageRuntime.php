<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackageRuntime
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
     * The flow runtime version the release was built for, as `major.minor.patch`; a runtime module of the same major version and not older also runs it.
     *
     * @var string
     */
    protected $version;
    /**
     * The SHA-256 hash of the runtime module's bytes, as hex; verify the download against it.
     *
     * @var string
     */
    protected $sha256;
    /**
     * Where to download the runtime module; its content never changes, so cache it by `sha256`.
     *
     * @var string
     */
    protected $url;
    /**
     * The runtime module's signature, as hex; empty for a module too old to be offered for download. SDKs run a downloaded module only when this signature verifies under a key built into the SDK, and otherwise show the flow with the runtime built into the SDK when it can.
     *
     * @var string
     */
    protected $signature;
    /**
     * The flow runtime version the release was built for, as `major.minor.patch`; a runtime module of the same major version and not older also runs it.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * The flow runtime version the release was built for, as `major.minor.patch`; a runtime module of the same major version and not older also runs it.
     *
     * @param string $version
     *
     * @return self
     */
    public function setVersion(string $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
    /**
     * The SHA-256 hash of the runtime module's bytes, as hex; verify the download against it.
     *
     * @return string
     */
    public function getSha256(): string
    {
        return $this->sha256;
    }
    /**
     * The SHA-256 hash of the runtime module's bytes, as hex; verify the download against it.
     *
     * @param string $sha256
     *
     * @return self
     */
    public function setSha256(string $sha256): self
    {
        $this->initialized['sha256'] = true;
        $this->sha256 = $sha256;
        return $this;
    }
    /**
     * Where to download the runtime module; its content never changes, so cache it by `sha256`.
     *
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * Where to download the runtime module; its content never changes, so cache it by `sha256`.
     *
     * @param string $url
     *
     * @return self
     */
    public function setUrl(string $url): self
    {
        $this->initialized['url'] = true;
        $this->url = $url;
        return $this;
    }
    /**
     * The runtime module's signature, as hex; empty for a module too old to be offered for download. SDKs run a downloaded module only when this signature verifies under a key built into the SDK, and otherwise show the flow with the runtime built into the SDK when it can.
     *
     * @return string
     */
    public function getSignature(): string
    {
        return $this->signature;
    }
    /**
     * The runtime module's signature, as hex; empty for a module too old to be offered for download. SDKs run a downloaded module only when this signature verifies under a key built into the SDK, and otherwise show the flow with the runtime built into the SDK when it can.
     *
     * @param string $signature
     *
     * @return self
     */
    public function setSignature(string $signature): self
    {
        $this->initialized['signature'] = true;
        $this->signature = $signature;
        return $this;
    }
}
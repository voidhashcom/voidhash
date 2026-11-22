<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationDefaultAnswerJsonEncodingRequirements
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
     * The flow package format of the answer's build (`flowPackage.abiVersion`): an SDK that reads an older format skips it.
     *
     * @var int
     */
    protected $packageFormat;
    /**
     * The native components the build uses without a fallback, which the app's SDK must provide for the build to show.
     *
     * @var list<PaywallLocationDefaultAnswerJsonEncodingRequirementsNativeComponentsItem>
     */
    protected $nativeComponents;
    /**
     * The flow package format of the answer's build (`flowPackage.abiVersion`): an SDK that reads an older format skips it.
     *
     * @return int
     */
    public function getPackageFormat(): int
    {
        return $this->packageFormat;
    }
    /**
     * The flow package format of the answer's build (`flowPackage.abiVersion`): an SDK that reads an older format skips it.
     *
     * @param int $packageFormat
     *
     * @return self
     */
    public function setPackageFormat(int $packageFormat): self
    {
        $this->initialized['packageFormat'] = true;
        $this->packageFormat = $packageFormat;
        return $this;
    }
    /**
     * The native components the build uses without a fallback, which the app's SDK must provide for the build to show.
     *
     * @return list<PaywallLocationDefaultAnswerJsonEncodingRequirementsNativeComponentsItem>
     */
    public function getNativeComponents(): array
    {
        return $this->nativeComponents;
    }
    /**
     * The native components the build uses without a fallback, which the app's SDK must provide for the build to show.
     *
     * @param list<PaywallLocationDefaultAnswerJsonEncodingRequirementsNativeComponentsItem> $nativeComponents
     *
     * @return self
     */
    public function setNativeComponents(array $nativeComponents): self
    {
        $this->initialized['nativeComponents'] = true;
        $this->nativeComponents = $nativeComponents;
        return $this;
    }
}
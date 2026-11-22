<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationDefaultAnswerJsonEncodingRequirementsNativeComponentsItem
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
     * The native component's id.
     *
     * @var string
     */
    protected $id;
    /**
     * The version the build was published against, which the app's must be compatible with; null for any version.
     *
     * @var string|null
     */
    protected $version;
    /**
     * The native component's id.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The native component's id.
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
     * The version the build was published against, which the app's must be compatible with; null for any version.
     *
     * @return string|null
     */
    public function getVersion(): ?string
    {
        return $this->version;
    }
    /**
     * The version the build was published against, which the app's must be compatible with; null for any version.
     *
     * @param string|null $version
     *
     * @return self
     */
    public function setVersion(?string $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
}
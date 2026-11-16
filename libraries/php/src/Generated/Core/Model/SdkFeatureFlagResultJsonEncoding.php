<?php

namespace Voidhash\Generated\Core\Model;

class SdkFeatureFlagResultJsonEncoding
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
     * Whether the flag is on for the person.
     *
     * @var bool
     */
    protected $enabled;
    /**
     * The flag's key.
     *
     * @var string
     */
    protected $key;
    /**
     * The JSON payload of the person's variant; null when there is none.
     *
     * @var mixed|null
     */
    protected $payload;
    /**
     * The key of the variant the person is assigned; null when the flag has no variant for them.
     *
     * @var string|null
     */
    protected $variantKey;
    /**
     * Whether the flag is on for the person.
     *
     * @return bool
     */
    public function getEnabled(): bool
    {
        return $this->enabled;
    }
    /**
     * Whether the flag is on for the person.
     *
     * @param bool $enabled
     *
     * @return self
     */
    public function setEnabled(bool $enabled): self
    {
        $this->initialized['enabled'] = true;
        $this->enabled = $enabled;
        return $this;
    }
    /**
     * The flag's key.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The flag's key.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * The JSON payload of the person's variant; null when there is none.
     *
     * @return mixed
     */
    public function getPayload()
    {
        return $this->payload;
    }
    /**
     * The JSON payload of the person's variant; null when there is none.
     *
     * @param mixed $payload
     *
     * @return self
     */
    public function setPayload($payload): self
    {
        $this->initialized['payload'] = true;
        $this->payload = $payload;
        return $this;
    }
    /**
     * The key of the variant the person is assigned; null when the flag has no variant for them.
     *
     * @return string|null
     */
    public function getVariantKey(): ?string
    {
        return $this->variantKey;
    }
    /**
     * The key of the variant the person is assigned; null when the flag has no variant for them.
     *
     * @param string|null $variantKey
     *
     * @return self
     */
    public function setVariantKey(?string $variantKey): self
    {
        $this->initialized['variantKey'] = true;
        $this->variantKey = $variantKey;
        return $this;
    }
}
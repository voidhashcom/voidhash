<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaymentProviderBodyJsonEncoding
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
     * Where the project takes payments: `app_store`, `google_play` or `stripe`, or a `payment_source` that reports its own purchases through the API, such as bank transfers or vouchers.
     *
     * @var string
     */
    protected $type;
    /**
     * A payment source's display name, its slug by default. A store is named after the store.
     *
     * @var string|null
     */
    protected $name;
    /**
     * A payment source's `{ "slug": ... }`, which it keeps, optionally with its `endpoint` and `testEndpoint`, each `{ "url", "signingSecret" }`. A store takes its settings in a later update.
     *
     * @var array<string, mixed>|null
     */
    protected $configuration;
    /**
     * Where the project takes payments: `app_store`, `google_play` or `stripe`, or a `payment_source` that reports its own purchases through the API, such as bank transfers or vouchers.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Where the project takes payments: `app_store`, `google_play` or `stripe`, or a `payment_source` that reports its own purchases through the API, such as bank transfers or vouchers.
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
     * A payment source's display name, its slug by default. A store is named after the store.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * A payment source's display name, its slug by default. A store is named after the store.
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
     * A payment source's `{ "slug": ... }`, which it keeps, optionally with its `endpoint` and `testEndpoint`, each `{ "url", "signingSecret" }`. A store takes its settings in a later update.
     *
     * @return array<string, mixed>|null
     */
    public function getConfiguration(): ?iterable
    {
        return $this->configuration;
    }
    /**
     * A payment source's `{ "slug": ... }`, which it keeps, optionally with its `endpoint` and `testEndpoint`, each `{ "url", "signingSecret" }`. A store takes its settings in a later update.
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
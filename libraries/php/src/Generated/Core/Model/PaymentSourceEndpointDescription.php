<?php

namespace Voidhash\Generated\Core\Model;

class PaymentSourceEndpointDescription
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
     * The operations the endpoint implements.
     *
     * @var list<string>
     */
    protected $operations;
    /**
     * The SDK that serves the endpoint; null when the endpoint does not say.
     *
     * @var PaymentSourceEndpointDescriptionSdk|null
     */
    protected $sdk;
    /**
     * The operations the endpoint implements.
     *
     * @return list<string>
     */
    public function getOperations(): array
    {
        return $this->operations;
    }
    /**
     * The operations the endpoint implements.
     *
     * @param list<string> $operations
     *
     * @return self
     */
    public function setOperations(array $operations): self
    {
        $this->initialized['operations'] = true;
        $this->operations = $operations;
        return $this;
    }
    /**
     * The SDK that serves the endpoint; null when the endpoint does not say.
     *
     * @return PaymentSourceEndpointDescriptionSdk|null
     */
    public function getSdk(): ?PaymentSourceEndpointDescriptionSdk
    {
        return $this->sdk;
    }
    /**
     * The SDK that serves the endpoint; null when the endpoint does not say.
     *
     * @param PaymentSourceEndpointDescriptionSdk|null $sdk
     *
     * @return self
     */
    public function setSdk(?PaymentSourceEndpointDescriptionSdk $sdk): self
    {
        $this->initialized['sdk'] = true;
        $this->sdk = $sdk;
        return $this;
    }
}
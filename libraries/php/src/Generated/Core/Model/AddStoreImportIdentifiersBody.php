<?php

namespace Voidhash\Generated\Core\Model;

class AddStoreImportIdentifiersBody
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
     * The purchases to add, 1 to 1,000 per request. One already added to this import is kept as it was.
     *
     * @var list<StoreImportIdentifier>
     */
    protected $identifiers;
    /**
     * The purchases to add, 1 to 1,000 per request. One already added to this import is kept as it was.
     *
     * @return list<StoreImportIdentifier>
     */
    public function getIdentifiers(): array
    {
        return $this->identifiers;
    }
    /**
     * The purchases to add, 1 to 1,000 per request. One already added to this import is kept as it was.
     *
     * @param list<StoreImportIdentifier> $identifiers
     *
     * @return self
     */
    public function setIdentifiers(array $identifiers): self
    {
        $this->initialized['identifiers'] = true;
        $this->identifiers = $identifiers;
        return $this;
    }
}
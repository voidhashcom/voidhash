<?php

namespace Voidhash\Generated\Core\Model;

class InboxSelectionBodyJsonEncoding
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
     * @var list<string>
     */
    protected $itemIds;
    /**
     * @return list<string>
     */
    public function getItemIds(): array
    {
        return $this->itemIds;
    }
    /**
     * @param list<string> $itemIds
     *
     * @return self
     */
    public function setItemIds(array $itemIds): self
    {
        $this->initialized['itemIds'] = true;
        $this->itemIds = $itemIds;
        return $this;
    }
}
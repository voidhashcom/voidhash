<?php

namespace Voidhash\Generated\Core\Model;

class PageInfo
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
     * @var string|null
     */
    protected $endCursor;
    /**
     * @var bool
     */
    protected $hasNextPage;
    /**
     * @return string|null
     */
    public function getEndCursor(): ?string
    {
        return $this->endCursor;
    }
    /**
     * @param string|null $endCursor
     *
     * @return self
     */
    public function setEndCursor(?string $endCursor): self
    {
        $this->initialized['endCursor'] = true;
        $this->endCursor = $endCursor;
        return $this;
    }
    /**
     * @return bool
     */
    public function getHasNextPage(): bool
    {
        return $this->hasNextPage;
    }
    /**
     * @param bool $hasNextPage
     *
     * @return self
     */
    public function setHasNextPage(bool $hasNextPage): self
    {
        $this->initialized['hasNextPage'] = true;
        $this->hasNextPage = $hasNextPage;
        return $this;
    }
}
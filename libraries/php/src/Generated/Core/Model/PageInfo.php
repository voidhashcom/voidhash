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
     * The `cursor` that reads the next page; null on the last page. Pass it back as it is.
     *
     * @var string|null
     */
    protected $endCursor;
    /**
     * Whether more items follow this page.
     *
     * @var bool
     */
    protected $hasNextPage;
    /**
     * The `cursor` that reads the next page; null on the last page. Pass it back as it is.
     *
     * @return string|null
     */
    public function getEndCursor(): ?string
    {
        return $this->endCursor;
    }
    /**
     * The `cursor` that reads the next page; null on the last page. Pass it back as it is.
     *
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
     * Whether more items follow this page.
     *
     * @return bool
     */
    public function getHasNextPage(): bool
    {
        return $this->hasNextPage;
    }
    /**
     * Whether more items follow this page.
     *
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
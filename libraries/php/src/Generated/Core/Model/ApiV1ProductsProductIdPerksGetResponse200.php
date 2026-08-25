<?php

namespace Voidhash\Generated\Core\Model;

class ApiV1ProductsProductIdPerksGetResponse200
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
     * @var list<ProductPerkJsonEncoding>
     */
    protected $data;
    /**
     * @var PageInfo
     */
    protected $pageInfo;
    /**
     * @return list<ProductPerkJsonEncoding>
     */
    public function getData(): array
    {
        return $this->data;
    }
    /**
     * @param list<ProductPerkJsonEncoding> $data
     *
     * @return self
     */
    public function setData(array $data): self
    {
        $this->initialized['data'] = true;
        $this->data = $data;
        return $this;
    }
    /**
     * @return PageInfo
     */
    public function getPageInfo(): PageInfo
    {
        return $this->pageInfo;
    }
    /**
     * @param PageInfo $pageInfo
     *
     * @return self
     */
    public function setPageInfo(PageInfo $pageInfo): self
    {
        $this->initialized['pageInfo'] = true;
        $this->pageInfo = $pageInfo;
        return $this;
    }
}
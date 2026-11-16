<?php

namespace Voidhash\Generated\Core\Model;

class ApiV1ProjectsProjectIdFeatureFlagOverridesGetResponse200
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
     * The items on this page, in list order.
     *
     * @var list<FeatureFlagOverrideJsonEncoding>
     */
    protected $data;
    /**
     * Where this page ends.
     *
     * @var PageInfo
     */
    protected $pageInfo;
    /**
     * The items on this page, in list order.
     *
     * @return list<FeatureFlagOverrideJsonEncoding>
     */
    public function getData(): array
    {
        return $this->data;
    }
    /**
     * The items on this page, in list order.
     *
     * @param list<FeatureFlagOverrideJsonEncoding> $data
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
     * Where this page ends.
     *
     * @return PageInfo
     */
    public function getPageInfo(): PageInfo
    {
        return $this->pageInfo;
    }
    /**
     * Where this page ends.
     *
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
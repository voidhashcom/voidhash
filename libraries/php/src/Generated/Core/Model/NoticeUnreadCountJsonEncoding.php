<?php

namespace Voidhash\Generated\Core\Model;

class NoticeUnreadCountJsonEncoding
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
     * The organization counted, `org_...`.
     *
     * @var string
     */
    protected $organizationId;
    /**
     * How many notices in the person's inbox are unread.
     *
     * @var int
     */
    protected $count;
    /**
     * The organization counted, `org_...`.
     *
     * @return string
     */
    public function getOrganizationId(): string
    {
        return $this->organizationId;
    }
    /**
     * The organization counted, `org_...`.
     *
     * @param string $organizationId
     *
     * @return self
     */
    public function setOrganizationId(string $organizationId): self
    {
        $this->initialized['organizationId'] = true;
        $this->organizationId = $organizationId;
        return $this;
    }
    /**
     * How many notices in the person's inbox are unread.
     *
     * @return int
     */
    public function getCount(): int
    {
        return $this->count;
    }
    /**
     * How many notices in the person's inbox are unread.
     *
     * @param int $count
     *
     * @return self
     */
    public function setCount(int $count): self
    {
        $this->initialized['count'] = true;
        $this->count = $count;
        return $this;
    }
}
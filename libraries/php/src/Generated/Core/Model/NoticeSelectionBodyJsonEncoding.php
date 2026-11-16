<?php

namespace Voidhash\Generated\Core\Model;

class NoticeSelectionBodyJsonEncoding
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
     * Ids of the person's notices, `notice_...`, up to 200.
     *
     * @var list<string>
     */
    protected $noticeIds;
    /**
     * Ids of the person's notices, `notice_...`, up to 200.
     *
     * @return list<string>
     */
    public function getNoticeIds(): array
    {
        return $this->noticeIds;
    }
    /**
     * Ids of the person's notices, `notice_...`, up to 200.
     *
     * @param list<string> $noticeIds
     *
     * @return self
     */
    public function setNoticeIds(array $noticeIds): self
    {
        $this->initialized['noticeIds'] = true;
        $this->noticeIds = $noticeIds;
        return $this;
    }
}
<?php

namespace Voidhash\Generated\Core\Model;

class SendNotificationBodyJsonEncoding
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
     * @var list<string>|null
     */
    protected $personIds;
    /**
     * @var list<string>|null
     */
    protected $distinctIds;
    /**
     * @var string
     */
    protected $title;
    /**
     * @var string
     */
    protected $body;
    /**
     * @var array<string, mixed>|null
     */
    protected $data;
    /**
     * @var string|null
     */
    protected $sound;
    /**
     * @var mixed|null
     */
    protected $badge;
    /**
     * @var string|null
     */
    protected $priority;
    /**
     * @var mixed|null
     */
    protected $ttl;
    /**
     * @var string|null
     */
    protected $channelId;
    /**
     * @var string|null
     */
    protected $collapseId;
    /**
     * @var string|null
     */
    protected $idempotencyKey;
    /**
     * @return list<string>|null
     */
    public function getPersonIds(): ?array
    {
        return $this->personIds;
    }
    /**
     * @param list<string>|null $personIds
     *
     * @return self
     */
    public function setPersonIds(?array $personIds): self
    {
        $this->initialized['personIds'] = true;
        $this->personIds = $personIds;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getDistinctIds(): ?array
    {
        return $this->distinctIds;
    }
    /**
     * @param list<string>|null $distinctIds
     *
     * @return self
     */
    public function setDistinctIds(?array $distinctIds): self
    {
        $this->initialized['distinctIds'] = true;
        $this->distinctIds = $distinctIds;
        return $this;
    }
    /**
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * @param string $title
     *
     * @return self
     */
    public function setTitle(string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * @return string
     */
    public function getBody(): string
    {
        return $this->body;
    }
    /**
     * @param string $body
     *
     * @return self
     */
    public function setBody(string $body): self
    {
        $this->initialized['body'] = true;
        $this->body = $body;
        return $this;
    }
    /**
     * @return array<string, mixed>|null
     */
    public function getData(): ?iterable
    {
        return $this->data;
    }
    /**
     * @param array<string, mixed>|null $data
     *
     * @return self
     */
    public function setData(?iterable $data): self
    {
        $this->initialized['data'] = true;
        $this->data = $data;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getSound(): ?string
    {
        return $this->sound;
    }
    /**
     * @param string|null $sound
     *
     * @return self
     */
    public function setSound(?string $sound): self
    {
        $this->initialized['sound'] = true;
        $this->sound = $sound;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getBadge()
    {
        return $this->badge;
    }
    /**
     * @param mixed $badge
     *
     * @return self
     */
    public function setBadge($badge): self
    {
        $this->initialized['badge'] = true;
        $this->badge = $badge;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPriority(): ?string
    {
        return $this->priority;
    }
    /**
     * @param string|null $priority
     *
     * @return self
     */
    public function setPriority(?string $priority): self
    {
        $this->initialized['priority'] = true;
        $this->priority = $priority;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getTtl()
    {
        return $this->ttl;
    }
    /**
     * @param mixed $ttl
     *
     * @return self
     */
    public function setTtl($ttl): self
    {
        $this->initialized['ttl'] = true;
        $this->ttl = $ttl;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getChannelId(): ?string
    {
        return $this->channelId;
    }
    /**
     * @param string|null $channelId
     *
     * @return self
     */
    public function setChannelId(?string $channelId): self
    {
        $this->initialized['channelId'] = true;
        $this->channelId = $channelId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCollapseId(): ?string
    {
        return $this->collapseId;
    }
    /**
     * @param string|null $collapseId
     *
     * @return self
     */
    public function setCollapseId(?string $collapseId): self
    {
        $this->initialized['collapseId'] = true;
        $this->collapseId = $collapseId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getIdempotencyKey(): ?string
    {
        return $this->idempotencyKey;
    }
    /**
     * @param string|null $idempotencyKey
     *
     * @return self
     */
    public function setIdempotencyKey(?string $idempotencyKey): self
    {
        $this->initialized['idempotencyKey'] = true;
        $this->idempotencyKey = $idempotencyKey;
        return $this;
    }
}
<?php

namespace Voidhash\Generated\Core\Model;

class ApiKeyJsonEncoding
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
     * @var string
     */
    protected $end;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var bool
     */
    protected $isPublic;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var string
     */
    protected $prefix;
    /**
     * @var string
     */
    protected $projectId;
    /**
     * @var string|null
     */
    protected $rawKey;
    /**
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * @param string $end
     *
     * @return self
     */
    public function setEnd(string $end): self
    {
        $this->initialized['end'] = true;
        $this->end = $end;
        return $this;
    }
    /**
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * @return bool
     */
    public function getIsPublic(): bool
    {
        return $this->isPublic;
    }
    /**
     * @param bool $isPublic
     *
     * @return self
     */
    public function setIsPublic(bool $isPublic): self
    {
        $this->initialized['isPublic'] = true;
        $this->isPublic = $isPublic;
        return $this;
    }
    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * @return string
     */
    public function getPrefix(): string
    {
        return $this->prefix;
    }
    /**
     * @param string $prefix
     *
     * @return self
     */
    public function setPrefix(string $prefix): self
    {
        $this->initialized['prefix'] = true;
        $this->prefix = $prefix;
        return $this;
    }
    /**
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getRawKey(): ?string
    {
        return $this->rawKey;
    }
    /**
     * @param string|null $rawKey
     *
     * @return self
     */
    public function setRawKey(?string $rawKey): self
    {
        $this->initialized['rawKey'] = true;
        $this->rawKey = $rawKey;
        return $this;
    }
}
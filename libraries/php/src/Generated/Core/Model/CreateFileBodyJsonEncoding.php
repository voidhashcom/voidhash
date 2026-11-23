<?php

namespace Voidhash\Generated\Core\Model;

class CreateFileBodyJsonEncoding
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
     * What an entry is: a `folder`, or a file whose content is read and written through its own group: a `board` (`boards.*`), a `dashboard`, or a `report` (`reports.*`).
     *
     * @var string
     */
    protected $kind;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var string|null
     */
    protected $parentId;
    /**
     * What an entry is: a `folder`, or a file whose content is read and written through its own group: a `board` (`boards.*`), a `dashboard`, or a `report` (`reports.*`).
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What an entry is: a `folder`, or a file whose content is read and written through its own group: a `board` (`boards.*`), a `dashboard`, or a `report` (`reports.*`).
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
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
     * @return string|null
     */
    public function getParentId(): ?string
    {
        return $this->parentId;
    }
    /**
     * @param string|null $parentId
     *
     * @return self
     */
    public function setParentId(?string $parentId): self
    {
        $this->initialized['parentId'] = true;
        $this->parentId = $parentId;
        return $this;
    }
}